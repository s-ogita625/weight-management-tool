/**
 * Google Health API v4 のレスポンスを、このアプリの1日分のまとめに変換する（純粋関数）。
 * API のフィールド名が一部ドキュメントに明記されていないため、
 * 「〜Sum」などの数値フィールドを探す形で頑健に読む。
 */

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export interface WearableDay {
  date: string;
  steps: number | null;
  total_kcal: number | null;
  distance_km: number | null;
  active_zone_minutes: number | null;
  sleep_minutes: number | null;
  sleep_start: string | null;
  sleep_end: string | null;
  deep_minutes: number | null;
  rem_minutes: number | null;
  light_minutes: number | null;
  awake_minutes: number | null;
  exercises: WearableExercise[];
}

export interface WearableExercise {
  name: string;
  type: string;
  start: string;
  minutes: number | null;
  kcal: number | null;
  steps: number | null;
  avg_hr?: number | null;
  azm?: number | null;
}

export function toCivilDate(iso: string): CivilDate {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y, month: m, day: d };
}

export function civilToIso(c: { date?: Partial<CivilDate> } | undefined): string | null {
  const d = c?.date;
  if (!d?.year || !d?.month || !d?.day) return null;
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * ロールアップ値オブジェクトから合計値を取り出す。
 * 例: { countSum: "8123" } / { kcalSum: 2450.3 } / { millimetersSum: "5230000" }
 */
export function pickRollupSum(value: unknown): { key: string; value: number } | null {
  if (!value || typeof value !== 'object') return null;
  const entries = Object.entries(value as Record<string, unknown>);
  const sum = entries.find(([k, v]) => /sum$/i.test(k) && num(v) !== null);
  if (sum) return { key: sum[0], value: num(sum[1]) as number };
  // ネストしている場合（例: { activeZoneMinutes: { sumOfMinutes: ... } }）
  for (const [, v] of entries) {
    if (v && typeof v === 'object') {
      const nested = pickRollupSum(v);
      if (nested) return nested;
    }
  }
  const first = entries.find(([, v]) => num(v) !== null);
  return first ? { key: first[0], value: num(first[1]) as number } : null;
}

export function distanceToKm(key: string, value: number): number {
  if (/millimet/i.test(key)) return value / 1_000_000;
  if (/kilomet/i.test(key)) return value;
  return value / 1000; // meters
}

interface RollupPoint {
  civilStartTime?: { date?: Partial<CivilDate> };
  [field: string]: unknown;
}

/** dailyRollUp の結果を 日付 → 値 のマップにする */
export function rollupByDate(
  points: RollupPoint[] | undefined,
  field: string,
): Map<string, { key: string; value: number }> {
  const out = new Map<string, { key: string; value: number }>();
  for (const p of points ?? []) {
    const date = civilToIso(p.civilStartTime);
    const picked = pickRollupSum(p[field]);
    if (date && picked) out.set(date, picked);
  }
  return out;
}

interface SleepPoint {
  sleep?: {
    interval?: {
      startTime?: string;
      endTime?: string;
      civilEndTime?: { date?: Partial<CivilDate> };
    };
    metadata?: { mainSleep?: boolean; nap?: boolean };
    summary?: {
      minutesAsleep?: string | number;
      minutesAwake?: string | number;
      stagesSummary?: Array<{ type?: string; minutes?: string | number }>;
    };
  };
}

/** 睡眠データを「起きた日」ごとにまとめる（メインの睡眠を優先、なければ一番長いもの） */
export function sleepByWakeDate(points: SleepPoint[] | undefined): Map<
  string,
  Pick<
    WearableDay,
    'sleep_minutes' | 'sleep_start' | 'sleep_end' | 'deep_minutes' | 'rem_minutes' | 'light_minutes' | 'awake_minutes'
  >
> {
  const best = new Map<string, { main: boolean; minutes: number; p: SleepPoint['sleep'] }>();
  for (const point of points ?? []) {
    const s = point.sleep;
    if (!s || s.metadata?.nap) continue;
    const date = civilToIso(s.interval?.civilEndTime) ?? s.interval?.endTime?.slice(0, 10) ?? null;
    if (!date) continue;
    const minutes = num(s.summary?.minutesAsleep) ?? 0;
    const main = Boolean(s.metadata?.mainSleep);
    const cur = best.get(date);
    if (!cur || (main && !cur.main) || (main === cur.main && minutes > cur.minutes)) {
      best.set(date, { main, minutes, p: s });
    }
  }
  const out = new Map();
  for (const [date, { p }] of best) {
    const stage = (t: string) => {
      const found = p?.summary?.stagesSummary?.find((x) => x.type === t);
      return found ? num(found.minutes) : null;
    };
    out.set(date, {
      sleep_minutes: num(p?.summary?.minutesAsleep),
      sleep_start: p?.interval?.startTime ?? null,
      sleep_end: p?.interval?.endTime ?? null,
      deep_minutes: stage('DEEP'),
      rem_minutes: stage('REM'),
      light_minutes: stage('LIGHT'),
      awake_minutes: num(p?.summary?.minutesAwake) ?? stage('AWAKE'),
    });
  }
  return out;
}

interface ExercisePoint {
  exercise?: {
    interval?: { startTime?: string; civilStartTime?: { date?: Partial<CivilDate> } };
    exerciseType?: string;
    displayName?: string;
    activeDuration?: string;
    metricsSummary?: {
      caloriesKcal?: number | string;
      steps?: number | string;
      averageHeartRateBeatsPerMinute?: number | string;
      activeZoneMinutes?: number | string;
    };
  };
}

/** "1234s" / "1234.5s" → 分 */
export function durationToMinutes(d: string | undefined): number | null {
  if (!d) return null;
  const m = /^([\d.]+)s$/.exec(d);
  return m ? Math.round(Number(m[1]) / 60) : null;
}

export function exercisesByDate(points: ExercisePoint[] | undefined): Map<string, WearableExercise[]> {
  const out = new Map<string, WearableExercise[]>();
  for (const point of points ?? []) {
    const e = point.exercise;
    if (!e) continue;
    // 開始時刻（UTC）を日本時間の日付にする。深夜の運動が前日扱いにならないように
    const date = jstDate(e.interval?.startTime) ?? civilToIso(e.interval?.civilStartTime);
    if (!date) continue;
    const list = out.get(date) ?? [];
    list.push({
      name: e.displayName ?? e.exerciseType ?? '運動',
      type: e.exerciseType ?? 'OTHER',
      start: e.interval?.startTime ?? '',
      minutes: durationToMinutes(e.activeDuration),
      kcal: num(e.metricsSummary?.caloriesKcal),
      steps: num(e.metricsSummary?.steps),
      avg_hr: num(e.metricsSummary?.averageHeartRateBeatsPerMinute),
      azm: num(e.metricsSummary?.activeZoneMinutes),
    });
    out.set(date, list);
  }
  return out;
}

/** RFC3339 の時刻 → 日本時間の日付（YYYY-MM-DD） */
export function jstDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

interface DailyMetricPoint {
  dailyRestingHeartRate?: { date?: Partial<CivilDate>; beatsPerMinute?: string | number };
  dailyHeartRateVariability?: {
    date?: Partial<CivilDate>;
    averageHeartRateVariabilityMilliseconds?: number | string;
  };
}

/** daily-resting-heart-rate の一覧 → 日付 → 拍/分 */
export function restingHrByDate(points: DailyMetricPoint[] | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of points ?? []) {
    const r = p.dailyRestingHeartRate;
    const date = civilToIso({ date: r?.date });
    const v = num(r?.beatsPerMinute);
    if (date && v !== null && v > 0) out.set(date, Math.round(v));
  }
  return out;
}

/** daily-heart-rate-variability の一覧 → 日付 → RMSSD(ms) */
export function hrvByDate(points: DailyMetricPoint[] | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of points ?? []) {
    const r = p.dailyHeartRateVariability;
    const date = civilToIso({ date: r?.date });
    const v = num(r?.averageHeartRateVariabilityMilliseconds);
    if (date && v !== null && v > 0) out.set(date, Math.round(v * 10) / 10);
  }
  return out;
}
