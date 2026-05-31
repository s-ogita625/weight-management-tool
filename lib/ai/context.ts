import 'server-only';

import { sql } from '@/lib/db';
import { calculate } from '@/lib/calculations';
import { buildCheatDayPlan, type CheatDayPlan } from '@/lib/cheat-day';
import { dateInJST } from '@/lib/date';
import { getWorkoutSessions, getWorkoutStats } from '@/lib/workouts';
import {
  correlation,
  daysBetween,
  detectPlateau,
  linearRegression,
  volatility,
} from '@/lib/stats';
import {
  BOWEL_LABELS,
  FATIGUE_LABELS,
  GENDER_LABELS,
  MEAL_TYPE_LABELS,
  PERIOD_LABELS,
  QUALITY_LABELS,
  TRAINING_FREQ_LABELS,
  BODY_PART_LABELS,
  HYDRATION_DRINK_LABELS,
  type DailyLog,
  type HistoricalAnalysis,
  type HydrationDrinkType,
  type HydrationLog,
  type MealLog,
  type Profile,
  type WorkoutSessionDetail,
  type WorkoutStats,
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
  /** 過去14-30日の深掘り分析 */
  historicalAnalysis: HistoricalAnalysis | null;
  /** 直近30件の筋トレ記録 */
  workoutSessions: WorkoutSessionDetail[];
  /** 筋トレ集計 */
  workoutStats: WorkoutStats;
  /** 過去14日の水分補給ログ */
  hydrationLogs: HydrationLog[];
  /** 水分補給集計 */
  hydrationStats: HydrationStats;
  /** 年4回フリーデイ計画 */
  cheatDayPlan: CheatDayPlan | null;
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

export interface HydrationStats {
  daysLogged: number;
  totalMl: number;
  avgDailyMl: number;
  avgWaterMl: number;
  avgProteinMl: number;
  avgCoffeeMl: number;
  avgOtherMl: number;
  todayMl: number;
  todayWaterMl: number;
  todayCoffeeMl: number;
  drinkTypeTotals: Record<HydrationDrinkType, number>;
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
  // 食事・朝記録・筋トレを並列取得
  const [
    profileRowsRaw,
    mealLogsRaw,
    hydrationLogsRaw,
    dailyLogsRaw,
    workoutSessions,
    workoutStats,
  ] = await Promise.all([
    sql`select * from profiles where user_id = ${userId} limit 1`,
    sql`
      select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
             to_char(time, 'HH24:MI') as time,
             meal_type, food_name,
             calories, protein_g, fat_g, carbs_g, memo, created_at
      from meal_logs
      where user_id = ${userId}
        and date >= current_date - (${daysBack}::int) * interval '1 day'
      order by date desc, time desc nulls last, created_at desc
    `,
    sql`
      select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
             to_char(time, 'HH24:MI') as time,
             drink_type, amount_ml, memo, created_at
      from hydration_logs
      where user_id = ${userId}
        and date >= current_date - (${daysBack}::int) * interval '1 day'
      order by date desc, time desc nulls last, created_at desc
    `,
    sql`
      select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
             weight_kg, body_fat_pct,
             sleep_hours, sleep_quality, fatigue, mood, bowel,
             memo, custom_fields, created_at, updated_at
      from daily_logs
      where user_id = ${userId}
        and date >= current_date - (${daysBack}::int) * interval '1 day'
      order by date asc
    `,
    getWorkoutSessions(userId, 30),
    getWorkoutStats(userId),
  ]);

  const profileRows = profileRowsRaw as unknown as Profile[];
  const profile = profileRows[0] ?? null;
  const logs = mealLogsRaw as unknown as MealLog[];
  const hydrationLogs = hydrationLogsRaw as unknown as HydrationLog[];
  const dailyLogs = dailyLogsRaw as unknown as DailyLog[];

  let target: UserContext['target'] = null;
  let cheatDayPlan: CheatDayPlan | null = null;
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
      leanCutMode: profile.lean_cut_mode,
      priority: profile.priority,
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
    cheatDayPlan = buildCheatDayPlan(profile);
  }

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

  // 体重トレンド分析
  const weightTrend = computeWeightTrend(dailyLogs);

  // 統計
  const stats = computeStats(dailyTotals, target, logs, dailyLogs);
  const hydrationStats = computeHydrationStats(hydrationLogs);

  return {
    profile,
    target,
    recentLogs: logs.slice(0, 30),
    dailyTotals,
    stats,
    dailyLogs,
    weightTrend,
    historicalAnalysis: computeHistoricalAnalysis(
      dailyTotals,
      dailyLogs,
      target,
      daysBack,
    ),
    workoutSessions,
    workoutStats,
    hydrationLogs,
    hydrationStats,
    cheatDayPlan,
  };
}

function computeHydrationStats(logs: HydrationLog[]): HydrationStats {
  const byDate = new Map<string, number>();
  const drinkTypeTotals: Record<HydrationDrinkType, number> = {
    water: 0,
    protein: 0,
    coffee: 0,
    other: 0,
  };
  for (const log of logs) {
    const amount = Number(log.amount_ml);
    byDate.set(log.date, (byDate.get(log.date) ?? 0) + amount);
    drinkTypeTotals[log.drink_type] += amount;
  }
  const daysLogged = byDate.size;
  const totalMl = logs.reduce((sum, log) => sum + Number(log.amount_ml), 0);
  const today = dateInJST();
  const todayLogs = logs.filter((log) => log.date === today);
  const todayMl = todayLogs.reduce((sum, log) => sum + Number(log.amount_ml), 0);
  const todayWaterMl = todayLogs
    .filter((log) => log.drink_type === 'water')
    .reduce((sum, log) => sum + Number(log.amount_ml), 0);
  const todayCoffeeMl = todayLogs
    .filter((log) => log.drink_type === 'coffee')
    .reduce((sum, log) => sum + Number(log.amount_ml), 0);
  const avg = (amount: number) =>
    daysLogged === 0 ? 0 : Math.round(amount / daysLogged);

  return {
    daysLogged,
    totalMl,
    avgDailyMl: avg(totalMl),
    avgWaterMl: avg(drinkTypeTotals.water),
    avgProteinMl: avg(drinkTypeTotals.protein),
    avgCoffeeMl: avg(drinkTypeTotals.coffee),
    avgOtherMl: avg(drinkTypeTotals.other),
    todayMl,
    todayWaterMl,
    todayCoffeeMl,
    drinkTypeTotals,
  };
}

function computeHistoricalAnalysis(
  dailyTotals: DailyTotal[],
  dailyLogs: DailyLog[],
  target: UserContext['target'],
  windowDays: number,
): HistoricalAnalysis | null {
  if (dailyTotals.length === 0 && dailyLogs.length === 0) return null;

  // adherence pct
  let caloriesAdherence: number[] = [];
  let proteinAdherence: number[] = [];
  if (target) {
    caloriesAdherence = dailyTotals.map((d) =>
      Math.round((d.calories / target.calories) * 100),
    );
    proteinAdherence = dailyTotals.map((d) =>
      Math.round((d.protein_g / target.protein_g) * 100),
    );
  }
  const median = (xs: number[]): number => {
    if (xs.length === 0) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? Math.round((s[mid - 1] + s[mid]) / 2) : s[mid];
  };

  // 体重スロープ・加速度
  const weighted = dailyLogs
    .filter((l) => l.weight_kg !== null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  let weightSlopeKgPerWeek = 0;
  let weightSlopeAccelKgPerWeek2 = 0;
  let weightVolatilityKg = 0;
  if (weighted.length >= 2) {
    const baseDate = weighted[0].date;
    const points = weighted.map((l) => ({
      x: daysBetween(baseDate, l.date),
      y: Number(l.weight_kg),
    }));
    const fit = linearRegression(points);
    if (fit) weightSlopeKgPerWeek = fit.slope * 7;
    weightVolatilityKg = volatility(points.map((p) => p.y));

    if (weighted.length >= 14) {
      const half = Math.floor(weighted.length / 2);
      const fitOld = linearRegression(points.slice(0, half));
      const fitNew = linearRegression(points.slice(half));
      if (fitOld && fitNew) {
        weightSlopeAccelKgPerWeek2 = (fitNew.slope - fitOld.slope) * 7;
      }
    }
  }

  // 記録継続率
  const consistencyScore = Math.round(
    (Math.min(dailyLogs.length, windowDays) / windowDays) * 100,
  );

  // 相関分析（睡眠 vs 体重日次変化）
  let sleepWeightCorrelation: number | null = null;
  if (weighted.length >= 4) {
    const sleepArr: number[] = [];
    const dWeightArr: number[] = [];
    for (let i = 1; i < weighted.length; i++) {
      const sleep = weighted[i].sleep_hours;
      if (sleep === null || sleep === undefined) continue;
      sleepArr.push(Number(sleep));
      dWeightArr.push(
        Number(weighted[i].weight_kg) - Number(weighted[i - 1].weight_kg),
      );
    }
    sleepWeightCorrelation = correlation(sleepArr, dWeightArr);
  }

  // 相関分析（疲労度 vs カロリー達成率）
  let fatigueAdherenceCorrelation: number | null = null;
  if (weighted.length >= 4 && target && dailyTotals.length >= 4) {
    const dailyByDate = new Map(dailyTotals.map((d) => [d.date, d.calories]));
    const fatigueArr: number[] = [];
    const adhArr: number[] = [];
    for (const log of weighted) {
      const fat = log.fatigue;
      const cals = dailyByDate.get(log.date);
      if (fat !== null && fat !== undefined && cals !== undefined) {
        fatigueArr.push(Number(fat));
        adhArr.push(Math.round((cals / target.calories) * 100));
      }
    }
    fatigueAdherenceCorrelation = correlation(fatigueArr, adhArr);
  }

  // 停滞期判定
  const series = weighted.map((l) => ({
    date: l.date,
    weight: Number(l.weight_kg),
  }));
  const plateau = detectPlateau(series, 7, 7);

  return {
    windowDays,
    caloriesAdherenceMedianPct: median(caloriesAdherence),
    proteinAdherenceMedianPct: median(proteinAdherence),
    weightSlopeKgPerWeek,
    weightSlopeAccelKgPerWeek2,
    consistencyScore,
    weightVolatilityKg,
    sleepWeightCorrelation,
    fatigueAdherenceCorrelation,
    isPlateau: plateau.isPlateau,
    plateauReason: plateau.reason,
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

  if (ctx.cheatDayPlan?.enabled) {
    const c = ctx.cheatDayPlan;
    parts.push(
      `【年4回フリーデイ】${c.frequencyLabel} / 次回 ${c.nextDate ?? '-'} / 今年の自動配置 ${c.birthdayWindow ?? '-'} / ${
        c.isTodayCheatDay
          ? `今日は${c.currentFreeDayLabel ?? 'フリーデイ'}（カロリー・PFC制限なし）`
          : '通常日はカロリー・PFC目標を維持。対象日以外の追加フリーデイは作らない'
      }`,
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

  if (ctx.hydrationStats.daysLogged > 0) {
    const hs = ctx.hydrationStats;
    parts.push(
      `【水分補給(過去14日)】記録日数 ${hs.daysLogged}日 / 1日平均 ${hs.avgDailyMl}ml / 水 ${hs.avgWaterMl}ml / プロテイン飲料 ${hs.avgProteinMl}ml / コーヒー ${hs.avgCoffeeMl}ml / その他 ${hs.avgOtherMl}ml / 今日 ${hs.todayMl}ml（水${hs.todayWaterMl}ml・コーヒー${hs.todayCoffeeMl}ml）`,
    );

    parts.push(
      `【直近の水分記録(最大8件)】\n${ctx.hydrationLogs
        .slice(0, 8)
        .map((log) => {
          const tm = log.time ? ` ${log.time}` : '';
          const memo = log.memo ? ` / ${log.memo}` : '';
          return `- ${log.date}${tm}: ${HYDRATION_DRINK_LABELS[log.drink_type]} ${log.amount_ml}ml${memo}`;
        })
        .join('\n')}`,
    );
  } else {
    parts.push('【水分補給】まだ水分補給の記録なし');
  }

  // 深掘り分析
  if (ctx.historicalAnalysis) {
    const ha = ctx.historicalAnalysis;
    const fmtCorr = (v: number | null): string =>
      v === null
        ? 'N/A'
        : Math.abs(v) < 0.2
          ? `${v.toFixed(2)} (相関ほぼなし)`
          : Math.abs(v) < 0.5
            ? `${v.toFixed(2)} (弱い)`
            : `${v.toFixed(2)} (中-強)`;
    parts.push(
      `【深掘り分析(過去${ha.windowDays}日)】記録継続率 ${ha.consistencyScore}% / カロリー達成率中央値 ${ha.caloriesAdherenceMedianPct}% / タンパク質達成率中央値 ${ha.proteinAdherenceMedianPct}% / 体重スロープ ${ha.weightSlopeKgPerWeek >= 0 ? '+' : ''}${ha.weightSlopeKgPerWeek.toFixed(2)}kg/週 / 加速度 ${ha.weightSlopeAccelKgPerWeek2 >= 0 ? '+' : ''}${ha.weightSlopeAccelKgPerWeek2.toFixed(2)}kg/週² / 体重volatility ${ha.weightVolatilityKg.toFixed(2)}kg / 睡眠×体重変化 ${fmtCorr(ha.sleepWeightCorrelation)} / 疲労×カロリー達成 ${fmtCorr(ha.fatigueAdherenceCorrelation)} / 停滞期: ${ha.isPlateau ? `あり (${ha.plateauReason ?? ''})` : 'なし'}`,
    );
  }

  if (ctx.workoutSessions.length > 0) {
    const ws = ctx.workoutStats;
    parts.push(
      `【筋トレ記録】直近記録 ${ctx.workoutSessions.length}回 / 今週 ${ws.sessionsThisWeek}回・${ws.setsThisWeek}set・総ボリューム${ws.volumeThisWeekKg}kg / 今月 ${ws.sessionsThisMonth}回・${ws.setsThisMonth}set・総ボリューム${ws.volumeThisMonthKg}kg / 最終筋トレ: ${ws.lastWorkoutDate ?? '-'} / 休息日数: ${ws.restDays === null ? '-' : ws.restDays + '日'}`,
    );

    if (ws.bodyPartSets.length > 0) {
      parts.push(
        `【部位別セット数(今月)】\n${ws.bodyPartSets
          .map(
            (p) =>
              `- ${BODY_PART_LABELS[p.body_part]}: ${p.sets}set / ${p.volumeKg}kg`,
          )
          .join('\n')}`,
      );
    }

    parts.push(
      `【直近の筋トレ内容(最大5回)】\n${ctx.workoutSessions
        .slice(0, 5)
        .map((session) => {
          const exercises = session.exercises
            .slice(0, 5)
            .map((exercise) => {
              const best = exercise.sets.reduce(
                (acc, set) => {
                  const weight = Number(set.weight_kg ?? 0);
                  const reps = Number(set.reps ?? 0);
                  const volume = weight * reps;
                  return volume > acc.volume
                    ? { weight, reps, volume }
                    : acc;
                },
                { weight: 0, reps: 0, volume: 0 },
              );
              return `${exercise.name}(${exercise.sets.length}set 最大${best.weight.toFixed(1)}kg x ${best.reps}回)`;
            })
            .join(' / ');
          return `- ${session.date}: ${session.totalSets}set / ${Math.round(
            session.totalVolumeKg,
          )}kg / ${exercises}`;
        })
        .join('\n')}`,
    );
  } else {
    parts.push('【筋トレ記録】まだ筋トレ記録なし');
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
  const leanCutMode = ctx.profile?.lean_cut_mode === true;
  const priority = ctx.profile?.priority;
  const priorityNote = priority
    ? `\n- ユーザーの優先度: ${priority === 'fat_loss' ? '体脂肪優先' : priority === 'muscle_retention' ? '筋肉維持優先' : 'ボディリコンポジション（同時達成）'}`
    : '';

  return `あなたは経験豊富なスポーツ栄養士兼パーソナルトレーナーです。最新のスポーツ栄養学・運動生理学の知見に基づき、日本語で的確かつ実践的なアドバイスを提供します。

【専門的に押さえている知見】
- ISSN Position Stand: Diets and Body Composition (Aragon et al., 2017) — リーンカット時のタンパク質 2.3-3.1 g/kg LBM、減量ペース 0.5-1.0%/週
- ISSN Position Stand: Protein and Exercise (Jäger et al., 2017)
- ISSN Position Stand: Nutrient Timing (Kerksick et al., 2017) — 食事間隔・タイミング栄養学
- Schoenfeld & Aragon JISSN 2018 — 1食あたり 0.4-0.55 g/kg BW、leucine threshold 20-40g
- Aragon & Schoenfeld JISSN 2013 — anabolic window は数時間に拡張
- Schoenfeld 2017 — 筋肥大の週次セット数 10-20/筋群
- Helms et al. 2014 — natural bodybuilding contest preparation
- Byrne et al. (MATADOR) 2018 — 4週減量+1週維持の代謝適応抑制
- Barakat et al. 2020 — Body Recomposition の達成条件
- Trexler et al. 2014 — metabolic adaptation と plateau breaker

【あなたの役割】
- ユーザーの食事記録・身体データ・体重トレンド・コンディション(睡眠/疲労/気分/便通)を総合的に解釈し、エビデンスに基づくアドバイスを行う
- 水分補給（水・プロテイン飲料・コーヒー等）を、体重の日内/日次変動、むくみ、便通、疲労感、トレーニング出力の解釈材料として扱う
- 体重トレンド（線形回帰の予測値・週次変化）が目標に対して妥当かを評価し、必要なら摂取量や運動量の調整を具体的に提案する
- 筋トレ記録（種目・重量・回数・セット・部位別ボリューム）から筋量維持に十分な刺激が入っているかを評価する
- 減量中は重量維持・総セット数・疲労管理を重視し、筋肉を落とさないための現実的な調整を提案する
- 食事タイミング（meal_type/time）から leucine threshold 達成度や運動前後の最適化を評価
- 睡眠不足や慢性疲労、便通異常などのコンディション悪化が見られた場合は、それらが目標達成に与える影響を栄養・トレーニングの観点で言及する
- 直近14日のスロープ・volatility・相関を考慮し、停滞期や過剰減量を見抜く
- 専門用語は使ってよいが、難しい概念は短い補足を添える
- 過度に長くせず、要点を簡潔にまとめる（基本3-5文程度。質問が複雑な場合のみ詳述）
- 数値は具体的に（"タンパク質を増やしましょう" ではなく "あと20gほど増やすと目標到達" のように）
- 医療相談・診断は行わず、必要なら医師・管理栄養士への相談を促す
- 危険な極端ダイエットや誤情報は明確に否定する${
    leanCutMode
      ? '\n- ★ユーザーは**リーンカットモード**ON → 筋肉維持を最優先し、タンパク質確保とレジスタンストレーニングの重要性を強調する'
      : ''
  }${priorityNote}

【ユーザー情報】
${userInfo}

【出力形式】
- マークダウンの強調(**)、見出し(##)、箇条書き(-)が使えます
- 絵文字を1〜2個まで適切に使ってよい`;
}
