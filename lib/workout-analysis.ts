/**
 * 筋トレ記録の分析（サーバー・クライアント両用の純粋関数）
 * - 種目ごとの履歴と推定1RM（Epley式）
 * - 漸進性過負荷の提案（ダブルプログレッション）
 * - 自己ベスト（PR）検出
 * - 部位ごとの週あたりセット数
 */

import { addDays, daysBetween } from '@/lib/stats';
import {
  BODY_PART_LABELS,
  type BodyPart,
  type WorkoutSessionDetail,
} from '@/lib/types';

export interface ExerciseSessionStat {
  date: string;
  sessionId: string;
  topWeight: number;
  /** トップ重量で行ったワーキングセットの最少レップ数 */
  minRepsAtTop: number;
  workingSets: number;
  bestE1rm: number;
  maxRpe: number | null;
}

export interface ExerciseHistory {
  name: string;
  bodyPart: BodyPart;
  /** 古い順 */
  sessions: ExerciseSessionStat[];
  bestE1rm: number;
  bestE1rmDate: string;
}

/** Epley 式の推定1RM */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function buildExerciseHistories(
  sessions: WorkoutSessionDetail[],
): ExerciseHistory[] {
  const map = new Map<string, ExerciseHistory>();
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  for (const session of sorted) {
    for (const exercise of session.exercises) {
      const working = exercise.sets.filter(
        (s) => s.set_type !== 'warmup' && Number(s.weight_kg ?? 0) > 0 && Number(s.reps ?? 0) > 0,
      );
      if (working.length === 0) continue;
      const topWeight = Math.max(...working.map((s) => Number(s.weight_kg)));
      const atTop = working.filter((s) => Number(s.weight_kg) === topWeight);
      const minRepsAtTop = Math.min(...atTop.map((s) => Number(s.reps)));
      const bestE1rm = Math.max(
        ...working.map((s) => estimate1RM(Number(s.weight_kg), Number(s.reps))),
      );
      const rpes = working.map((s) => (s.rpe === null ? null : Number(s.rpe))).filter((v): v is number => v !== null);

      const key = exercise.name.trim();
      const history =
        map.get(key) ??
        ({
          name: key,
          bodyPart: exercise.body_part,
          sessions: [],
          bestE1rm: 0,
          bestE1rmDate: session.date,
        } satisfies ExerciseHistory);
      history.sessions.push({
        date: session.date,
        sessionId: session.id,
        topWeight,
        minRepsAtTop,
        workingSets: working.length,
        bestE1rm: round1(bestE1rm),
        maxRpe: rpes.length ? Math.max(...rpes) : null,
      });
      if (bestE1rm > history.bestE1rm) {
        history.bestE1rm = round1(bestE1rm);
        history.bestE1rmDate = session.date;
      }
      map.set(key, history);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.sessions.length - a.sessions.length);
}

/** 種目名と現在の重量から、次に上げる重量の刻み幅を推定 */
export function weightIncrement(name: string, currentWeight: number): number {
  if (/マシン|スミス/.test(name)) return 5;
  if (/ダンベル|DB/i.test(name) || currentWeight < 20) return currentWeight < 10 ? 1 : 2;
  if (/バーベル|ベンチプレス|スクワット|デッドリフト/.test(name)) return 2.5;
  if (/ケーブル/.test(name) && currentWeight < 30) return 2.5;
  return 5; // マシン・ケーブルの重量スタック
}

export interface ProgressionSuggestion {
  name: string;
  bodyPart: BodyPart;
  action: 'increase' | 'reps' | 'hold';
  currentWeight: number;
  suggestedWeight: number;
  targetReps: number;
  reason: string;
  /** 同じ重量が続いている回数（セッション数） */
  stagnantSessions: number;
}

/**
 * ダブルプログレッション：
 * 直近2回とも同じトップ重量で、すべてのセットが目標レップ（8回以上）に届き、
 * RPE が 9 未満（記録がある場合）なら重量アップを提案。
 * 届いていなければ、まず回数を1回増やす提案。
 */
export function buildProgressionSuggestions(
  histories: ExerciseHistory[],
  today: string,
  minReps = 8,
): ProgressionSuggestion[] {
  const out: ProgressionSuggestion[] = [];
  for (const h of histories) {
    const recent = h.sessions.slice(-2);
    if (recent.length === 0) continue;
    const last = recent[recent.length - 1];
    let stagnant = 0;
    for (let i = h.sessions.length - 1; i >= 0; i--) {
      if (h.sessions[i].topWeight === last.topWeight) stagnant++;
      else break;
    }
    const inc = weightIncrement(h.name, last.topWeight);
    const allHitReps = recent.every((s) => s.minRepsAtTop >= minReps);
    const sameWeight = recent.length === 2 && recent[0].topWeight === recent[1].topWeight;
    const rpeOk = recent.every((s) => s.maxRpe === null || s.maxRpe < 9);
    const gapDays = daysBetween(last.date, today);

    if (gapDays > 28) {
      // 4週間以上空いたら、まず前回と同じ重量で感覚を戻す
      const restart = Math.round((last.topWeight * 0.9) / inc) * inc;
      out.push({
        name: h.name,
        bodyPart: h.bodyPart,
        action: 'reps',
        currentWeight: last.topWeight,
        suggestedWeight: restart,
        targetReps: minReps,
        reason: `${gapDays}日ぶりなので、前回の約9割（${restart}kg）×${minReps}回から再開。2〜3回で元の重量に戻しましょう`,
        stagnantSessions: stagnant,
      });
    } else if (sameWeight && allHitReps && rpeOk) {
      out.push({
        name: h.name,
        bodyPart: h.bodyPart,
        action: 'increase',
        currentWeight: last.topWeight,
        suggestedWeight: round1(last.topWeight + inc),
        targetReps: minReps,
        reason: `${last.topWeight}kgで2回続けて全セット${minReps}回以上できています`,
        stagnantSessions: stagnant,
      });
    } else if (last.minRepsAtTop < minReps + 4) {
      out.push({
        name: h.name,
        bodyPart: h.bodyPart,
        action: 'reps',
        currentWeight: last.topWeight,
        suggestedWeight: last.topWeight,
        targetReps: Math.max(minReps, last.minRepsAtTop + 1),
        reason: `まず${last.topWeight}kgで全セット${Math.max(minReps, last.minRepsAtTop + 1)}回を目指しましょう`,
        stagnantSessions: stagnant,
      });
    } else {
      out.push({
        name: h.name,
        bodyPart: h.bodyPart,
        action: 'hold',
        currentWeight: last.topWeight,
        suggestedWeight: last.topWeight,
        targetReps: last.minRepsAtTop,
        reason: '現状維持',
        stagnantSessions: stagnant,
      });
    }
  }
  return out;
}

export interface PersonalRecord {
  name: string;
  date: string;
  e1rm: number;
  previousBest: number;
}

/** since 以降に更新された推定1RMの自己ベスト */
export function findRecentPRs(histories: ExerciseHistory[], since: string): PersonalRecord[] {
  const prs: PersonalRecord[] = [];
  for (const h of histories) {
    let best = 0;
    for (const s of h.sessions) {
      if (s.bestE1rm > best && best > 0 && s.date >= since) {
        prs.push({ name: h.name, date: s.date, e1rm: s.bestE1rm, previousBest: best });
      }
      best = Math.max(best, s.bestE1rm);
    }
  }
  return prs.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export interface BodyPartBalance {
  bodyPart: BodyPart;
  label: string;
  setsPerWeek: number;
  lastDate: string | null;
  status: 'low' | 'ok' | 'high';
}

/** 主要部位ごとの週あたりワーキングセット数（直近 weeks 週） */
export function buildBodyPartBalance(
  sessions: WorkoutSessionDetail[],
  today: string,
  weeks = 4,
): BodyPartBalance[] {
  const since = addDays(today, -7 * weeks + 1);
  const parts: BodyPart[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'triceps', 'core'];
  const sets = new Map<BodyPart, number>();
  const last = new Map<BodyPart, string>();
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      const bp = exercise.body_part;
      if (!last.has(bp) || (last.get(bp) as string) < session.date) last.set(bp, session.date);
      if (session.date < since) continue;
      const n = exercise.sets.filter((s) => s.set_type !== 'warmup').length;
      sets.set(bp, (sets.get(bp) ?? 0) + n);
    }
  }
  return parts.map((bp) => {
    const perWeek = Math.round(((sets.get(bp) ?? 0) / weeks) * 10) / 10;
    // 目安: 大筋群 10〜20 set/週、腕・腹は 6〜15 set/週（Schoenfeld 2017 などの用量反応研究）
    const [lo, hi] = ['arms', 'triceps', 'core'].includes(bp) ? [6, 15] : [10, 20];
    return {
      bodyPart: bp,
      label: BODY_PART_LABELS[bp],
      setsPerWeek: perWeek,
      lastDate: last.get(bp) ?? null,
      status: perWeek < lo ? 'low' : perWeek > hi ? 'high' : 'ok',
    };
  });
}
