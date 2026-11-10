'use client';

/**
 * オフライン時の記録キュー（端末の localStorage に一時保存し、オンライン復帰時に送信）。
 * 対象はホームのワンタップ記録（体重・食事）のみ。
 */

import {
  quickAddMealAction,
  quickSaveWeightAction,
  type QuickMealItem,
  type RecordedAt,
} from '@/app/actions/quick';
import { dateInJST, timeInJST } from '@/lib/date';

export type OfflineJob =
  | { kind: 'meal'; item: QuickMealItem; at: RecordedAt }
  | { kind: 'weight'; weight: number; copyCondition: boolean; fatigue?: number | null; at: RecordedAt }
  // 水分記録は廃止。古い端末に残っているキューは送らずに捨てる
  | { kind: 'water'; ml: number; at: RecordedAt };

const KEY = 'wmt-offline-queue-v1';
export const QUEUE_EVENT = 'wmt-offline-queue-changed';

export function readQueue(): OfflineJob[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OfflineJob[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(jobs: OfflineJob[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(jobs));
  } catch {
    // ストレージが使えない環境では諦める
  }
  window.dispatchEvent(new CustomEvent(QUEUE_EVENT));
}

export function nowAt(): RecordedAt {
  return { date: dateInJST(), time: timeInJST() };
}

function enqueue(job: OfflineJob) {
  writeQueue([...readQueue(), job]);
}

function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  return err instanceof TypeError; // fetch failed
}

/**
 * まず送信し、通信できなければキューに積む。
 * 戻り値: 'sent' | 'queued'。サーバー側のバリデーションエラーはそのまま返す。
 */
export async function sendOrQueue<T extends { ok: true } | { error: string }>(
  job: OfflineJob,
  send: () => Promise<T>,
): Promise<{ status: 'sent'; result: T } | { status: 'queued' }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueue(job);
    return { status: 'queued' };
  }
  try {
    return { status: 'sent', result: await send() };
  } catch (err) {
    if (isNetworkError(err)) {
      enqueue(job);
      return { status: 'queued' };
    }
    throw err;
  }
}

let flushing = false;

/** キューを順に送信。送れたものは削除し、送れた件数を返す */
export async function flushQueue(): Promise<number> {
  if (flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) return 0;
  flushing = true;
  let sent = 0;
  try {
    let jobs = readQueue();
    while (jobs.length > 0) {
      const job = jobs[0];
      try {
        if (job.kind === 'meal') await quickAddMealAction(job.item, job.at);
        else if (job.kind === 'weight') {
          await quickSaveWeightAction(job.weight, job.copyCondition, job.at, job.fatigue ?? null);
        } else {
          jobs = readQueue().slice(1);
          writeQueue(jobs);
          continue;
        }
        sent++;
      } catch (err) {
        if (isNetworkError(err)) break; // まだ通信できない
        // サーバーで弾かれた記録は捨てる（再送しても通らない）
      }
      jobs = readQueue().slice(1);
      writeQueue(jobs);
    }
  } finally {
    flushing = false;
  }
  return sent;
}
