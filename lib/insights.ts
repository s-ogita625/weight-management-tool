/**
 * ホームに出す「気づき」と週次レポートを作る（純粋関数）。
 * AI を呼ばずにルールベースで、毎回すぐ表示できることを優先する。
 */

import { addDays, correlation, daysBetween, linearRegression } from '@/lib/stats';

export interface WeightRow {
  date: string;
  weight: number;
}

export interface DayCondition {
  date: string;
  weight: number | null;
  sleep_hours: number | null;
  mood: number | null;
  fatigue: number | null;
}

export interface MealDay {
  date: string;
  kcal: number;
  protein: number;
  entries: number;
}

export type InsightTone = 'warning' | 'info' | 'success';

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  body: string;
  actions?: string[];
}

function r1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** カレンダー7日窓の移動平均 */
export function movingAverage7(rows: WeightRow[]): Array<WeightRow & { ma7: number }> {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted.map((w) => {
    const from = addDays(w.date, -6);
    const win = sorted.filter((x) => x.date >= from && x.date <= w.date);
    return { ...w, ma7: win.reduce((s, x) => s + x.weight, 0) / win.length };
  });
}

/** 期間内の体重の傾き（kg/週）。記録が少なければ null */
function slopePerWeek(rows: WeightRow[], from: string, to: string, minPoints = 6): number | null {
  const pts = rows.filter((r) => r.date >= from && r.date <= to);
  if (pts.length < minPoints) return null;
  const fit = linearRegression(pts.map((p) => ({ x: daysBetween(from, p.date), y: p.weight })));
  return fit ? fit.slope * 7 : null;
}

// ------------------------------------------------------------------
// B1 停滞アラート
// ------------------------------------------------------------------
export function plateauInsight(
  weights: WeightRow[],
  today: string,
  targetWeight: number,
  targetKcal: number,
): Insight | null {
  const latest = weights.at(-1);
  if (!latest || latest.weight <= targetWeight + 0.5) return null;
  if (daysBetween(latest.date, today) > 3) return null; // 最近の記録がない
  const slope = slopePerWeek(weights, addDays(latest.date, -13), latest.date, 8);
  if (slope === null || slope < -0.1) return null;
  const newTarget = Math.round((targetKcal - 150) / 10) * 10;
  return {
    id: 'plateau',
    tone: 'warning',
    title: '2週間、体重が横ばいです',
    body: `直近14日の傾きは ${slope >= 0 ? '+' : ''}${slope.toFixed(2)}kg/週。減量が止まっています。`,
    actions: [
      `食事の記録漏れ（間食・飲み物・調味料）がないか確認`,
      `1日の目標を ${Math.round(targetKcal)} → ${newTarget}kcal に下げる（-150kcal）`,
      `歩数を1日+2,000歩（約+80kcal）`,
      `睡眠を7時間以上に（睡眠不足は空腹感と筋分解を増やします）`,
    ],
  };
}

// ------------------------------------------------------------------
// B3 チートデイ・食べすぎ後の回復予測
// ------------------------------------------------------------------
export function refeedRecoveryInsight(
  weights: WeightRow[],
  meals: MealDay[],
  today: string,
  targetKcal: number,
  freeDays: string[],
): Insight | null {
  const since = addDays(today, -7);
  const highDays = meals
    .filter((m) => m.date >= since && m.date < today && (m.kcal >= targetKcal + 800 || freeDays.includes(m.date)))
    .map((m) => m.date)
    .sort();
  const highDay = highDays.at(-1);
  if (!highDay) return null;
  const before = weights.filter((w) => w.date < highDay && w.date >= addDays(highDay, -7));
  const after = weights.filter((w) => w.date > highDay);
  if (before.length === 0 || after.length === 0) return null;
  const baseline = before.reduce((s, w) => s + w.weight, 0) / before.length;
  const latest = after.at(-1) as WeightRow;
  const excess = latest.weight - baseline;
  if (excess < 0.3) {
    return {
      id: 'refeed-recovered',
      tone: 'success',
      title: `${highDay.slice(5).replace('-', '/')} の高カロリー日の影響はほぼ消えました`,
      body: `高カロリー日前の平均 ${baseline.toFixed(1)}kg に対して、今は ${latest.weight.toFixed(1)}kg です。`,
    };
  }
  // v1 の実績: 6/25 に +2.0kg → 約2週間で戻った（≒0.15〜0.25kg/日）
  const days = Math.max(1, Math.ceil(excess / 0.2));
  return {
    id: 'refeed',
    tone: 'info',
    title: `${highDay.slice(5).replace('-', '/')} の高カロリー日の影響で +${excess.toFixed(1)}kg`,
    body: `増えた分の多くは水分とグリコーゲン（脂肪ではありません）。いつも通りの食事に戻せば、あと${days}日ほどで ${baseline.toFixed(1)}kg 前後に戻る見込みです。`,
  };
}

// ------------------------------------------------------------------
// B5 目標の現実チェック
// ------------------------------------------------------------------
export interface GoalCheck {
  latestWeight: number;
  targetWeight: number;
  paceKgPerWeek: number | null;
  etaDate: string | null;
  weeksToGoal: number | null;
  /** 体重の1%/週を超えるペースが必要なら true（筋量を落としやすい） */
  periodTooShort: boolean;
  requiredPaceKgPerWeek: number;
  suggestedWeeks: number;
  message: string;
}

export function goalCheck(
  weights: WeightRow[],
  today: string,
  targetWeight: number,
  periodWeeks: number,
): GoalCheck | null {
  const latest = weights.at(-1);
  if (!latest) return null;
  const remaining = latest.weight - targetWeight;
  const pace = slopePerWeek(weights, addDays(latest.date, -27), latest.date, 8);
  const requiredPace = remaining / periodWeeks;
  // 推奨上限: 体重の0.5〜1.0%/週（ISSN, Helms et al. 2014）。間を取って0.7%
  const safePace = latest.weight * 0.007;
  const periodTooShort = requiredPace > latest.weight * 0.01;
  const suggestedWeeks = Math.ceil(remaining / safePace);

  let etaDate: string | null = null;
  let weeksToGoal: number | null = null;
  let message: string;
  if (remaining <= 0) {
    message = '目標体重を達成しています 🎉 次の目標（体脂肪率など）を設定しましょう。';
  } else if (daysBetween(latest.date, today) > 14) {
    message = `最後の体重記録が${daysBetween(latest.date, today)}日前です。記録を再開して2週間ほどで到達予測を出します。`;
  } else if (pace === null) {
    message = '直近4週間の体重記録が8日分たまると、到達予測を出せます。';
  } else if (pace >= -0.1) {
    message = `直近4週間のペースは ${pace >= 0 ? '+' : ''}${pace.toFixed(2)}kg/週。このままでは目標に届きません。`;
  } else {
    weeksToGoal = Math.ceil(remaining / -pace);
    etaDate = addDays(today, weeksToGoal * 7);
    message = `今のペース（${pace.toFixed(2)}kg/週）なら、あと約${weeksToGoal}週（${etaDate.slice(0, 7).replace('-', '年')}月ごろ）で到達します。`;
  }
  return {
    latestWeight: latest.weight,
    targetWeight,
    paceKgPerWeek: pace === null ? null : Math.round(pace * 100) / 100,
    etaDate,
    weeksToGoal,
    periodTooShort: remaining > 0 && periodTooShort,
    requiredPaceKgPerWeek: Math.round(requiredPace * 100) / 100,
    suggestedWeeks: Math.max(1, suggestedWeeks),
    message,
  };
}

// ------------------------------------------------------------------
// B4 週次レポート（直近7日 vs その前の7日）
// ------------------------------------------------------------------
export interface WeeklyReport {
  from: string;
  to: string;
  weightMaChange: number | null;
  avgKcal: number | null;
  avgProtein: number | null;
  kcalTarget: number;
  proteinTarget: number;
  weightDays: number;
  mealDays: number;
  workouts: number;
  avgSleep: number | null;
  prevAvgSleep: number | null;
  highlights: string[];
}

export function weeklyReport(
  weights: WeightRow[],
  conditions: DayCondition[],
  meals: MealDay[],
  workoutDates: string[],
  today: string,
  kcalTarget: number,
  proteinTarget: number,
): WeeklyReport {
  const to = addDays(today, -1);
  const from = addDays(today, -7);
  const prevFrom = addDays(today, -14);
  const inRange = (d: string, a: string, b: string) => d >= a && d <= b;

  const ma = movingAverage7(weights);
  const maAt = (d: string) => [...ma].reverse().find((m) => m.date <= d && m.date >= addDays(d, -3))?.ma7 ?? null;
  const maNow = maAt(to);
  const maPrev = maAt(addDays(from, -1));
  const weightMaChange = maNow !== null && maPrev !== null ? r1(maNow - maPrev) : null;

  const weekMeals = meals.filter((m) => inRange(m.date, from, to) && m.entries >= 2);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const avgKcal = avg(weekMeals.map((m) => m.kcal));
  const avgProtein = avg(weekMeals.map((m) => m.protein));
  const sleepNow = avg(conditions.filter((c) => inRange(c.date, from, to) && c.sleep_hours !== null).map((c) => Number(c.sleep_hours)));
  const sleepPrev = avg(conditions.filter((c) => inRange(c.date, prevFrom, addDays(from, -1)) && c.sleep_hours !== null).map((c) => Number(c.sleep_hours)));
  const weightDays = weights.filter((w) => inRange(w.date, from, to)).length;
  const workouts = new Set(workoutDates.filter((d) => inRange(d, from, to))).size;

  const highlights: string[] = [];
  if (weightMaChange !== null) {
    highlights.push(
      weightMaChange <= -0.2
        ? `7日平均体重 ${weightMaChange}kg。順調です`
        : weightMaChange >= 0.2
          ? `7日平均体重 +${weightMaChange}kg。食事量を見直しましょう`
          : `7日平均体重はほぼ横ばい（${weightMaChange >= 0 ? '+' : ''}${weightMaChange}kg）`,
    );
  }
  if (avgProtein !== null && avgProtein < proteinTarget * 0.85) {
    highlights.push(`たんぱく質が平均${Math.round(avgProtein)}g（目標${Math.round(proteinTarget)}g）。プロテインや卵を1品追加`);
  }
  if (avgKcal !== null && avgKcal > kcalTarget * 1.1) {
    highlights.push(`摂取カロリーが平均${Math.round(avgKcal)}kcal（目標比 +${Math.round(avgKcal - kcalTarget)}）`);
  }
  if (sleepNow !== null && sleepNow < 6.5) {
    highlights.push(`睡眠が平均${sleepNow.toFixed(1)}時間。7時間を目標に`);
  }
  if (weekMeals.length < 5) {
    highlights.push(`食事を記録できたのは${weekMeals.length}/7日。ざっくり記録でもOKです`);
  }

  return {
    from,
    to,
    weightMaChange,
    avgKcal: avgKcal === null ? null : Math.round(avgKcal),
    avgProtein: avgProtein === null ? null : Math.round(avgProtein),
    kcalTarget: Math.round(kcalTarget),
    proteinTarget: Math.round(proteinTarget),
    weightDays,
    mealDays: weekMeals.length,
    workouts,
    avgSleep: sleepNow === null ? null : r1(sleepNow),
    prevAvgSleep: sleepPrev === null ? null : r1(sleepPrev),
    highlights,
  };
}

// ------------------------------------------------------------------
// A6 記録漏れ（アプリ内リマインド）
// ------------------------------------------------------------------
export function reminderInsight(
  nowHHMM: string,
  todayWeightLogged: boolean,
  todayMealEntries: number,
  autoWeight = false,
): Insight | null {
  const hour = Number(nowHHMM.slice(0, 2));
  if (hour >= 20 && todayMealEntries < 2) {
    return {
      id: 'meal-reminder',
      tone: 'info',
      title: `今日の食事記録が${todayMealEntries}件です`,
      body: '細かく思い出せなければ「ざっくり記録」でOK。0日にしないことが大事です。',
    };
  }
  if (hour >= 10 && hour < 20 && !todayWeightLogged) {
    return {
      id: 'weight-reminder',
      tone: 'info',
      title: '今日の体重がまだです',
      body: autoWeight
        ? '体重計に乗ると自動で記録されます。'
        : '体重だけなら10秒。下の体重カードからどうぞ。',
    };
  }
  return null;
}

// ------------------------------------------------------------------
// D1 睡眠・体重・気分の関係
// ------------------------------------------------------------------
export interface SleepAnalysis {
  days: number;
  shortSleepDays: number;
  /** 睡眠6時間未満の日 / 以上の日 の、翌日体重の前日比（kg） */
  nextDayWeightChangeShort: number | null;
  nextDayWeightChangeNormal: number | null;
  moodShort: number | null;
  moodNormal: number | null;
  fatigueShort: number | null;
  fatigueNormal: number | null;
  sleepMoodCorrelation: number | null;
  messages: string[];
}

export function sleepAnalysis(conditions: DayCondition[]): SleepAnalysis {
  const sorted = [...conditions].sort((a, b) => (a.date < b.date ? -1 : 1));
  const byDate = new Map(sorted.map((c) => [c.date, c]));
  const shortChange: number[] = [];
  const normalChange: number[] = [];
  const moodS: number[] = [];
  const moodN: number[] = [];
  const fatS: number[] = [];
  const fatN: number[] = [];
  const sleeps: number[] = [];
  const moods: number[] = [];

  for (const c of sorted) {
    if (c.sleep_hours === null) continue;
    const sleep = Number(c.sleep_hours);
    const isShort = sleep < 6;
    if (c.mood !== null) {
      (isShort ? moodS : moodN).push(Number(c.mood));
      sleeps.push(sleep);
      moods.push(Number(c.mood));
    }
    if (c.fatigue !== null) (isShort ? fatS : fatN).push(Number(c.fatigue));
    const next = byDate.get(addDays(c.date, 1));
    if (next && next.weight !== null && c.weight !== null) {
      (isShort ? shortChange : normalChange).push(Number(next.weight) - Number(c.weight));
    }
  }
  const avg = (xs: number[]) => (xs.length >= 3 ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const res: SleepAnalysis = {
    days: sorted.filter((c) => c.sleep_hours !== null).length,
    shortSleepDays: sorted.filter((c) => c.sleep_hours !== null && Number(c.sleep_hours) < 6).length,
    nextDayWeightChangeShort: avg(shortChange),
    nextDayWeightChangeNormal: avg(normalChange),
    moodShort: avg(moodS),
    moodNormal: avg(moodN),
    fatigueShort: avg(fatS),
    fatigueNormal: avg(fatN),
    sleepMoodCorrelation: correlation(sleeps, moods),
    messages: [],
  };
  if (res.nextDayWeightChangeShort !== null && res.nextDayWeightChangeNormal !== null) {
    const diff = res.nextDayWeightChangeShort - res.nextDayWeightChangeNormal;
    res.messages.push(
      diff > 0.05
        ? `睡眠6時間未満の翌日は、体重が平均 ${diff.toFixed(2)}kg 落ちにくい傾向があります。`
        : diff < -0.05
          ? `睡眠6時間未満の翌日は体重が平均 ${Math.abs(diff).toFixed(2)}kg 低く出ていますが、多くは水分の一時的な変化です。脂肪が減りやすいわけではありません。`
          : `睡眠時間と翌日の体重変化に、はっきりした差は見られません。`,
    );
  }
  if (res.moodShort !== null && res.moodNormal !== null && res.moodNormal - res.moodShort >= 0.2) {
    res.messages.push(
      `睡眠6時間未満の日は気分が平均 ${(res.moodNormal - res.moodShort).toFixed(1)} 低くなっています（5段階）。`,
    );
  }
  if (res.fatigueShort !== null && res.fatigueNormal !== null && res.fatigueShort - res.fatigueNormal >= 0.2) {
    res.messages.push(
      `睡眠6時間未満の日は疲労感が平均 ${(res.fatigueShort - res.fatigueNormal).toFixed(1)} 高くなっています。`,
    );
  }
  return res;
}
