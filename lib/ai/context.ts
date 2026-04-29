import 'server-only';

import { sql } from '@/lib/db';
import { calculate } from '@/lib/calculations';
import {
  GENDER_LABELS,
  MEAL_TYPE_LABELS,
  PERIOD_LABELS,
  TRAINING_FREQ_LABELS,
  type MealLog,
  type Profile,
} from '@/lib/types';

export interface UserContext {
  profile: Profile | null;
  target: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    weeklyDeltaKg: number;
    goal: 'cut' | 'bulk' | 'maintain';
  } | null;
  recentLogs: MealLog[];
  dailyTotals: DailyTotal[];
  stats: ContextStats;
}

export interface DailyTotal {
  date: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  count: number;
}

export interface ContextStats {
  totalLogs: number;
  daysLogged: number;
  avgDailyCalories: number;
  avgDailyProtein: number;
  avgDailyFat: number;
  avgDailyCarbs: number;
  consecutiveDaysLogged: number;
  caloriesAdherencePct: number; // 目標達成率の中央値 (%)
  proteinAdherencePct: number;
  hasFood: boolean;
  hasMealType: boolean;
}

/**
 * ユーザーのプロフィールと食事履歴を読み出して、
 * AI 用の構造化コンテキストを返す。
 * デフォルト過去14日。
 */
export async function buildUserContext(
  userId: string,
  daysBack = 14,
): Promise<UserContext> {
  const profileRows = (await sql`
    select * from profiles where user_id = ${userId} limit 1
  `) as Profile[];
  const profile = profileRows[0] ?? null;

  let target: UserContext['target'] = null;
  if (profile) {
    const r = calculate({
      heightCm: Number(profile.height_cm),
      weightKg: Number(profile.current_weight_kg),
      bodyFatPct: Number(profile.body_fat_pct),
      age: Number(profile.age),
      gender: profile.gender,
      trainingFreq: profile.training_freq,
      targetWeightKg: Number(profile.target_weight_kg),
      targetBodyFatPct: Number(profile.target_body_fat_pct),
      period: profile.target_period,
    });
    const rec =
      r.recommendedFormula === 'katchMcArdle' ? r.katchMcArdle : r.mifflin;
    target = {
      calories: rec.targetCalories,
      protein_g: rec.protein_g,
      fat_g: rec.fat_g,
      carbs_g: rec.carbs_g,
      weeklyDeltaKg: rec.weeklyDeltaKg,
      goal: rec.goal,
    };
  }

  const logs = (await sql`
    select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
           to_char(time, 'HH24:MI') as time,
           meal_type, food_name,
           calories, protein_g, fat_g, carbs_g, memo, created_at
    from meal_logs
    where user_id = ${userId}
      and date >= current_date - (${daysBack}::int) * interval '1 day'
    order by date desc, time desc nulls last, created_at desc
  `) as MealLog[];

  // 日別集計
  const byDate = new Map<string, DailyTotal>();
  for (const l of logs) {
    const d = byDate.get(l.date) ?? {
      date: l.date,
      calories: 0,
      protein_g: 0,
      fat_g: 0,
      carbs_g: 0,
      count: 0,
    };
    d.calories += Number(l.calories);
    d.protein_g += Number(l.protein_g);
    d.fat_g += Number(l.fat_g);
    d.carbs_g += Number(l.carbs_g);
    d.count += 1;
    byDate.set(l.date, d);
  }
  const dailyTotals = Array.from(byDate.values()).sort(
    (a, b) => (a.date < b.date ? 1 : -1),
  );

  // 統計
  const stats = computeStats(dailyTotals, target, logs);

  return {
    profile,
    target,
    recentLogs: logs.slice(0, 30), // プロンプトに含める最新分
    dailyTotals,
    stats,
  };
}

function computeStats(
  daily: DailyTotal[],
  target: UserContext['target'],
  logs: MealLog[],
): ContextStats {
  const daysLogged = daily.length;
  const totalLogs = logs.length;

  const avg = (key: keyof DailyTotal): number => {
    if (daysLogged === 0) return 0;
    const sum = daily.reduce((a, d) => a + (d[key] as number), 0);
    return Math.round(sum / daysLogged);
  };

  // 連続日数（今日 or 昨日から遡って）
  const todayStr = new Date().toISOString().slice(0, 10);
  const datesSet = new Set(daily.map((d) => d.date));
  let consecutive = 0;
  const cursor = new Date();
  // 今日の記録がなければ昨日からスタート
  if (!datesSet.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const s = cursor.toISOString().slice(0, 10);
    if (datesSet.has(s)) {
      consecutive++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  // 達成率の中央値
  const median = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
  };
  let caloriesAdherence = 0;
  let proteinAdherence = 0;
  if (target && daysLogged > 0) {
    caloriesAdherence = median(
      daily.map((d) => Math.round((d.calories / target.calories) * 100)),
    );
    proteinAdherence = median(
      daily.map((d) => Math.round((d.protein_g / target.protein_g) * 100)),
    );
  }

  return {
    totalLogs,
    daysLogged,
    avgDailyCalories: avg('calories'),
    avgDailyProtein: avg('protein_g'),
    avgDailyFat: avg('fat_g'),
    avgDailyCarbs: avg('carbs_g'),
    consecutiveDaysLogged: consecutive,
    caloriesAdherencePct: caloriesAdherence,
    proteinAdherencePct: proteinAdherence,
    hasFood: logs.some((l) => !!l.food_name),
    hasMealType: logs.some((l) => !!l.meal_type),
  };
}

/**
 * AI用の自然言語コンテキスト要約を構築。システムプロンプトに含める。
 */
export function formatContextForAI(ctx: UserContext): string {
  const parts: string[] = [];

  if (ctx.profile) {
    const p = ctx.profile;
    parts.push(
      `【ユーザープロフィール】\n性別: ${GENDER_LABELS[p.gender]} / 年齢: ${p.age}歳 / 身長: ${Number(
        p.height_cm,
      )}cm / 体重: ${Number(p.current_weight_kg)}kg / 体脂肪率: ${Number(
        p.body_fat_pct,
      )}% / 筋トレ頻度: ${TRAINING_FREQ_LABELS[p.training_freq]} / 目標: ${Number(
        p.target_weight_kg,
      )}kg / 体脂肪${Number(p.target_body_fat_pct)}% を ${
        PERIOD_LABELS[p.target_period]
      }で達成`,
    );
  } else {
    parts.push('【ユーザープロフィール】未入力（プロフィール未登録）');
  }

  if (ctx.target) {
    const t = ctx.target;
    const goalJa =
      t.goal === 'cut' ? '減量' : t.goal === 'bulk' ? '増量' : '維持';
    parts.push(
      `【推奨1日摂取量】${t.calories}kcal（${goalJa}フェーズ・週次変化目標 ${t.weeklyDeltaKg}kg/週） / P${t.protein_g}g / F${t.fat_g}g / C${t.carbs_g}g`,
    );
  }

  const s = ctx.stats;
  parts.push(
    `【記録状況】過去14日: 記録日数 ${s.daysLogged}日 / 食事件数 ${s.totalLogs}件 / 連続記録 ${s.consecutiveDaysLogged}日`,
  );

  if (s.daysLogged > 0) {
    parts.push(
      `【1日平均】${s.avgDailyCalories}kcal / P${s.avgDailyProtein}g F${s.avgDailyFat}g C${s.avgDailyCarbs}g`,
    );
    if (ctx.target) {
      parts.push(
        `【目標達成率(中央値)】カロリー ${s.caloriesAdherencePct}% / タンパク質 ${s.proteinAdherencePct}%`,
      );
    }
  }

  if (ctx.dailyTotals.length > 0) {
    const recent = ctx.dailyTotals.slice(0, 7);
    parts.push(
      `【直近7日の日別合計】\n${recent
        .map(
          (d) =>
            `- ${d.date}: ${Math.round(d.calories)}kcal / P${Math.round(
              d.protein_g,
            )} F${Math.round(d.fat_g)} C${Math.round(d.carbs_g)} (${d.count}件)`,
        )
        .join('\n')}`,
    );
  }

  if (ctx.recentLogs.length > 0) {
    parts.push(
      `【直近の食事記録(最大10件)】\n${ctx.recentLogs
        .slice(0, 10)
        .map((l) => {
          const meal = l.meal_type ? MEAL_TYPE_LABELS[l.meal_type] : '';
          const tm = l.time ? ` ${l.time}` : '';
          const food = l.food_name ? ` ${l.food_name}` : '';
          return `- ${l.date}${tm} ${meal}${food}: ${Math.round(
            Number(l.calories),
          )}kcal P${Math.round(Number(l.protein_g))} F${Math.round(
            Number(l.fat_g),
          )} C${Math.round(Number(l.carbs_g))}`;
        })
        .join('\n')}`,
    );
  }

  return parts.join('\n\n');
}

/** AIアシスタント共通のシステムプロンプト */
export function buildSystemPrompt(ctx: UserContext): string {
  const userInfo = formatContextForAI(ctx);
  return `あなたは経験豊富なスポーツ栄養士兼パーソナルトレーナーです。最新のスポーツ栄養学（ISSN Position Stand、ACSM Guidelines）と運動生理学の知見に基づき、日本語で的確かつ実践的なアドバイスを提供します。

【あなたの役割】
- ユーザーの食事記録と身体データを踏まえ、エビデンスに基づくアドバイスを行う
- 専門用語は使ってよいが、難しい概念は短い補足を添える
- 過度に長くせず、要点を簡潔にまとめる（基本3-5文程度。質問が複雑な場合のみ詳述）
- 数値は具体的に（"タンパク質を増やしましょう" ではなく "あと20gほど増やすと目標到達" のように）
- 医療相談・診断は行わず、必要なら医師・管理栄養士への相談を促す
- 危険な極端ダイエットや誤情報は明確に否定する

【ユーザー情報】
${userInfo}

【出力形式】
- マークダウンの強調(**)、見出し(##)、箇条書き(-)が使えます
- 絵文字を1〜2個まで適切に使ってよい`;
}
