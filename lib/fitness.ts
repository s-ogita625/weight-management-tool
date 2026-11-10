/**
 * Fitbit（Google Health）のデータから「トレーニング日か」「どれだけ回復しているか」を判断する（純粋関数）。
 */

import { addDays } from '@/lib/stats';

export interface ExerciseLike {
  name: string;
  type: string;
  minutes: number | null;
  kcal: number | null;
  avg_hr?: number | null;
  start?: string;
}

const WALK_TYPES = new Set(['WALKING', 'TREADMILL_WALK', 'HIKING']);
const STRENGTH_TYPES = new Set(['STRENGTH_TRAINING', 'WEIGHTLIFTING', 'WORKOUT', 'CROSSFIT', 'CIRCUIT_TRAINING']);

export function isWalk(e: ExerciseLike): boolean {
  return WALK_TYPES.has(e.type);
}

export function isStrength(e: ExerciseLike): boolean {
  return STRENGTH_TYPES.has(e.type);
}

/** 炭水化物を増やす「トレ日」とみなす運動（筋トレ系、またはウォーキング以外で20分以上） */
export function isTrainingExercise(e: ExerciseLike): boolean {
  if (isStrength(e)) return (e.minutes ?? 0) >= 10;
  return !isWalk(e) && (e.minutes ?? 0) >= 20;
}

// ------------------------------------------------------------------
// 回復度（疲労度の推定）
// ------------------------------------------------------------------

export interface RecoveryDay {
  date: string;
  resting_hr: number | null;
  hrv_ms: number | null;
  sleep_minutes: number | null;
}

export interface Recovery {
  /** 1〜5（朝の記録の「疲労度」と同じ向き：1=とても元気, 5=とても疲れ） */
  fatigue: number;
  label: string;
  tone: 'good' | 'normal' | 'tired';
  reasons: string[];
  hrvPct: number | null;
  rhrDiff: number | null;
  sleepMinutes: number | null;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * 今日の HRV・安静時心拍を「自分の直近30日の平均」と比べ、睡眠時間と合わせて疲労度を推定する。
 * Fitbit の「コンディションスコア」は API で取得できないため、同じ考え方（HRV・安静時心拍・睡眠）で近似する。
 */
export function estimateRecovery(days: RecoveryDay[], today: string): Recovery | null {
  const t = days.find((d) => d.date === today);
  if (!t) return null;
  const base = days.filter((d) => d.date < today && d.date >= addDays(today, -30));
  const hrvBase = base.map((d) => d.hrv_ms).filter((v): v is number => v !== null && v > 0);
  const rhrBase = base.map((d) => d.resting_hr).filter((v): v is number => v !== null && v > 0);

  let score = 0;
  let signals = 0;
  const reasons: string[] = [];

  let hrvPct: number | null = null;
  if (t.hrv_ms !== null && hrvBase.length >= 5) {
    signals++;
    hrvPct = Math.round(((t.hrv_ms - mean(hrvBase)) / mean(hrvBase)) * 100);
    if (hrvPct <= -15) score -= 2;
    else if (hrvPct <= -7) score -= 1;
    else if (hrvPct >= 7) score += 1;
    reasons.push(`HRV ${hrvPct >= 0 ? '+' : ''}${hrvPct}%`);
  }

  let rhrDiff: number | null = null;
  if (t.resting_hr !== null && rhrBase.length >= 5) {
    signals++;
    rhrDiff = Math.round((t.resting_hr - mean(rhrBase)) * 10) / 10;
    if (rhrDiff >= 5) score -= 2;
    else if (rhrDiff >= 2.5) score -= 1;
    else if (rhrDiff <= -2) score += 1;
    reasons.push(`安静時心拍 ${t.resting_hr}（平均${rhrDiff >= 0 ? '+' : ''}${rhrDiff}）`);
  }

  if (t.sleep_minutes !== null) {
    signals++;
    const h = t.sleep_minutes / 60;
    if (h < 5.5) score -= 2;
    else if (h < 6.5) score -= 1;
    else if (h >= 7.5) score += 1;
    reasons.push(`睡眠 ${Math.floor(h)}時間${String(t.sleep_minutes % 60).padStart(2, '0')}分`);
  }

  if (signals === 0) return null;

  const fatigue = score >= 2 ? 1 : score >= 1 ? 2 : score >= -1 ? 3 : score >= -3 ? 4 : 5;
  const label =
    fatigue <= 2 ? 'よく回復しています' : fatigue === 3 ? 'ふつう' : fatigue === 4 ? 'やや疲れ気味' : '疲れがたまっています';
  return {
    fatigue,
    label,
    tone: fatigue <= 2 ? 'good' : fatigue === 3 ? 'normal' : 'tired',
    reasons,
    hrvPct,
    rhrDiff,
    sleepMinutes: t.sleep_minutes,
  };
}
