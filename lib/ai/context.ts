import 'server-only';

import { sql } from '@/lib/db';
import { calculate } from '@/lib/calculations';
import { linearRegression, daysBetween } from '@/lib/stats';
import {
  BOWEL_LABELS,
  FATIGUE_LABELS,
  GENDER_LABELS,
  MEAL_TYPE_LABELS,
  PERIOD_LABELS,
  QUALITY_LABELS,
  TRAINING_FREQ_LABELS,
  type DailyLog,
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
  /** 過去30日の朝の記録 */
  dailyLogs: DailyLog[];
  /** 体重トレンド分析 */
  weightTrend: WeightTrend | null;
}

export interface WeightTrend {
  /** 期間の開始 ~ 終了 */
  fromDate: string;
  toDate: string;
  daysLogged: number;
  startWeight: number;
  endWeight: number;
  deltaKg: number;
  weeklyDeltaKg: number;
  predicted30dKg: number | null;
  r2: number;
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
  // コンディション系
  avgSleepHours: number | null;
  avgSleepQuality: number | null;
  avgFatigue: number | null;
  avgMood: number | null;
  bowelMode: string | null;
  dailyLogsCount: number;
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

  // 朝の記録 (daily_logs) を取得（過去30日）
  const dailyLogs = (await sql`
    select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
           weight_kg, body_fat_pct,
           sleep_hours, sleep_quality, fatigue, mood, bowel,
           memo, custom_fields, created_at, updated_at
    from daily_logs
    where user_id = ${userId}
      and date >= current_date - (${daysBack}::int) * interval '1 day'
    order by date asc
  `) as unknown as DailyLog[];

  // 体重トレンド分析
  const weightTrend = computeWeightTrend(dailyLogs);

  // 統計
  const stats = computeStats(dailyTotals, target, logs, dailyLogs);

  return {
    profile,
    target,
    recentLogs: logs.slice(0, 30),
    dailyTotals,
    stats,
    dailyLogs,
    weightTrend,
  };
}

function computeWeightTrend(logs: DailyLog[]): WeightTrend | null {
  const weighted = logs.filter((l) => l.weight_kg !== null);
  if (weighted.length < 2) return null;
  const baseDate = weighted[0].date;
  const points = weighted.map((l) => ({
    x: daysBetween(baseDate, l.date),
    y: Number(l.weight_kg),
  }));
  const fit = linearRegression(points);
  if (!fit) return null;
  const lastX = points[points.length - 1].x;
  const startWeight = points[0].y;
  const endWeight = points[points.length - 1].y;
  return {
    fromDate: weighted[0].date,
    toDate: weighted[weighted.length - 1].date,
    daysLogged: weighted.length,
    startWeight,
    endWeight,
    deltaKg: endWeight - startWeight,
    weeklyDeltaKg: fit.slope * 7,
    predicted30dKg: fit.predict(lastX + 30),
    r2: fit.r2,
  };
}

function computeStats(
  daily: DailyTotal[],
  target: UserContext['target'],
  logs: MealLog[],
  dailyLogs: DailyLog[],
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

  // コンディション系平均
  const safeAvg = (vals: number[]): number | null =>
    vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0) / vals.length;
  const sleepHours = dailyLogs
    .filter((l) => l.sleep_hours !== null)
    .map((l) => Number(l.sleep_hours));
  const sleepQuality = dailyLogs
    .filter((l) => l.sleep_quality !== null)
    .map((l) => Number(l.sleep_quality));
  const fatigues = dailyLogs
    .filter((l) => l.fatigue !== null)
    .map((l) => Number(l.fatigue));
  const moods = dailyLogs.filter((l) => l.mood !== null).map((l) => Number(l.mood));
  const bowels = dailyLogs.filter((l) => l.bowel !== null).map((l) => l.bowel as string);
  const bowelCount: Record<string, number> = {};
  bowels.forEach((b) => (bowelCount[b] = (bowelCount[b] ?? 0) + 1));
  const bowelMode =
    bowels.length > 0
      ? Object.entries(bowelCount).sort((a, b) => b[1] - a[1])[0][0]
      : null;

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
    avgSleepHours: safeAvg(sleepHours),
    avgSleepQuality: safeAvg(sleepQuality),
    avgFatigue: safeAvg(fatigues),
    avgMood: safeAvg(moods),
    bowelMode,
    dailyLogsCount: dailyLogs.length,
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

  // 体重トレンド分析
  if (ctx.weightTrend) {
    const w = ctx.weightTrend;
    const dir =
      w.weeklyDeltaKg > 0.05 ? '増加' : w.weeklyDeltaKg < -0.05 ? '減少' : '横ばい';
    parts.push(
      `【体重トレンド】${w.fromDate}〜${w.toDate} (${w.daysLogged}日記録) / ${w.startWeight.toFixed(1)}kg → ${w.endWeight.toFixed(1)}kg (${
        w.deltaKg >= 0 ? '+' : ''
      }${w.deltaKg.toFixed(1)}kg) / 週次変化: ${
        w.weeklyDeltaKg >= 0 ? '+' : ''
      }${w.weeklyDeltaKg.toFixed(2)}kg/週 (${dir}) / 30日後の予測: ${w.predicted30dKg !== null ? w.predicted30dKg.toFixed(1) + 'kg' : 'N/A'} / R²=${w.r2.toFixed(2)}`,
    );
  }

  // コンディション
  if (ctx.stats.dailyLogsCount > 0) {
    const cs = ctx.stats;
    const fmt = (v: number | null, labels?: Record<number, string>) => {
      if (v === null) return '-';
      const r = Math.round(v);
      return labels ? `${v.toFixed(1)} (${labels[r] ?? ''})` : v.toFixed(1);
    };
    parts.push(
      `【コンディション(過去14日)】朝の記録 ${cs.dailyLogsCount}日 / 平均睡眠 ${fmt(cs.avgSleepHours)}h / 睡眠の質 ${fmt(cs.avgSleepQuality, QUALITY_LABELS)} / 疲労度 ${fmt(cs.avgFatigue, FATIGUE_LABELS)} / 気分 ${fmt(cs.avgMood, QUALITY_LABELS)} / 便通最頻: ${cs.bowelMode ? BOWEL_LABELS[cs.bowelMode as keyof typeof BOWEL_LABELS] : '-'}`,
    );
  }

  const s = ctx.stats;
  parts.push(
    `【食事記録状況】過去14日: 記録日数 ${s.daysLogged}日 / 食事件数 ${s.totalLogs}件 / 連続記録 ${s.consecutiveDaysLogged}日`,
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
- ユーザーの食事記録・身体データ・体重トレンド・コンディション(睡眠/疲労/気分/便通)を総合的に解釈し、エビデンスに基づくアドバイスを行う
- 体重トレンド（線形回帰の予測値・週次変化）が目標に対して妥当かを評価し、必要なら摂取量や運動量の調整を具体的に提案する
- 睡眠不足や慢性疲労、便通異常などのコンディション悪化が見られた場合は、それらが目標達成に与える影響を栄養・トレーニングの観点で言及する
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
