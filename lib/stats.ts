/**
 * 軽量統計ユーティリティ。
 * - 線形回帰（least squares）
 * - 移動平均（SMA）
 */

export interface Point {
  x: number; // 例: 経過日数
  y: number; // 例: 体重
}

export interface LinearFit {
  slope: number;
  intercept: number;
  /** R² 決定係数 (0..1) */
  r2: number;
  predict: (x: number) => number;
}

/** 最小二乗法による線形回帰 */
export function linearRegression(points: Point[]): LinearFit | null {
  const n = points.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let denX = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    denX += (p.x - meanX) ** 2;
  }
  if (denX === 0) return null;

  const slope = num / denX;
  const intercept = meanY - slope * meanX;

  // R²
  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    const yHat = slope * p.x + intercept;
    ssRes += (p.y - yHat) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return {
    slope,
    intercept,
    r2,
    predict: (x: number) => slope * x + intercept,
  };
}

/** 単純移動平均 (window 日) */
export function movingAverage(values: number[], window: number): number[] {
  if (window <= 1) return [...values];
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    result.push(sum / slice.length);
  }
  return result;
}

/** 日付文字列(YYYY-MM-DD)を Date に */
export function parseISODate(s: string): Date {
  return new Date(s + 'T00:00:00Z');
}

/** 2つの日付の差（日） */
export function daysBetween(a: string, b: string): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/** YYYY-MM-DD 文字列を offsetDays だけ進める */
export function addDays(date: string, offsetDays: number): string {
  const d = parseISODate(date);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Pearson 相関係数 (-1..1)。同長配列、最小 N=3。N不足や分散0は null */
export function correlation(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return null;
  return num / Math.sqrt(denX * denY);
}

/** 標本標準偏差 */
export function volatility(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance =
    values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

/**
 * 停滞期判定。
 * - 直近 recentDays の slope が ±0.05 kg/週 以内 (= ほぼ横ばい)
 * - かつ それ以前 prevDays の slope が -0.2 kg/週 以下 (= 順調に減少していた)
 * の場合に isPlateau=true を返す。
 */
export function detectPlateau(
  weightSeries: { date: string; weight: number }[],
  recentDays = 7,
  prevDays = 7,
): {
  isPlateau: boolean;
  slopeRecentKgPerWeek: number | null;
  slopePrevKgPerWeek: number | null;
  reason: string | null;
} {
  if (weightSeries.length < recentDays + prevDays) {
    return {
      isPlateau: false,
      slopeRecentKgPerWeek: null,
      slopePrevKgPerWeek: null,
      reason: 'データ不足（直近+それ以前の合計14日分以上の記録が必要）',
    };
  }
  const sorted = [...weightSeries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const recentSlice = sorted.slice(-recentDays);
  const prevSlice = sorted.slice(-(recentDays + prevDays), -recentDays);

  const baseDate = sorted[0].date;
  const toPoints = (slice: typeof sorted): Point[] =>
    slice.map((s) => ({ x: daysBetween(baseDate, s.date), y: s.weight }));

  const fitRecent = linearRegression(toPoints(recentSlice));
  const fitPrev = linearRegression(toPoints(prevSlice));

  if (!fitRecent || !fitPrev) {
    return {
      isPlateau: false,
      slopeRecentKgPerWeek: null,
      slopePrevKgPerWeek: null,
      reason: '回帰計算が出来ませんでした',
    };
  }
  const slopeRecentWeek = fitRecent.slope * 7;
  const slopePrevWeek = fitPrev.slope * 7;

  // 停滞判定: 直近がほぼ横ばい (|slope| < 0.05 kg/週) かつ 前期間は減少していた
  const isPlateau = Math.abs(slopeRecentWeek) < 0.05 && slopePrevWeek < -0.15;
  const reason = isPlateau
    ? `直近${recentDays}日は ${slopeRecentWeek.toFixed(2)}kg/週で横ばい、それ以前は ${slopePrevWeek.toFixed(2)}kg/週で順調でした`
    : null;

  return {
    isPlateau,
    slopeRecentKgPerWeek: slopeRecentWeek,
    slopePrevKgPerWeek: slopePrevWeek,
    reason,
  };
}
