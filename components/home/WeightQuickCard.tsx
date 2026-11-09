'use client';

import { Check, Minus, Plus, Scale } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { quickSaveWeightAction } from '@/app/actions/quick';

interface Props {
  /** 今日すでに記録済みの体重 */
  todayWeight: number | null;
  /** 入力の初期値に使う直近の体重 */
  lastWeight: number | null;
  /** 今日の体調が入力済みか */
  hasCondition: boolean;
  /** 前回の記録が最近（7日以内）か。古い体調はコピーしない初期値にする */
  recentlyLogged: boolean;
  /** 7日移動平均（最新） */
  ma7: number | null;
  /** 7日移動平均の1週間前との差 */
  ma7WeeklyDelta: number | null;
}

export default function WeightQuickCard({
  todayWeight,
  lastWeight,
  hasCondition,
  recentlyLogged,
  ma7,
  ma7WeeklyDelta,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(
    (todayWeight ?? lastWeight ?? 70).toFixed(1),
  );
  const [copyCondition, setCopyCondition] = useState(!hasCondition && recentlyLogged);
  const [editing, setEditing] = useState(todayWeight === null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const step = (delta: number) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setValue((Math.round((n + delta) * 10) / 10).toFixed(1));
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await quickSaveWeightAction(Number(value), copyCondition);
      if ('error' in res) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <section className="sport-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/25 text-[#a3ff12] ring-1 ring-white/10">
            <Scale size={17} />
          </span>
          体重
          {todayWeight !== null && (
            <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
              記録済み
            </span>
          )}
        </div>
        <Link href="/morning" className="text-xs text-slate-400 underline-offset-2 hover:underline">
          体調も詳しく
        </Link>
      </div>

      {editing ? (
        <>
          <div className="flex items-center gap-2">
            <StepButton label="-0.1kg" onClick={() => step(-0.1)}>
              <Minus size={18} />
            </StepButton>
            <div className="relative flex-1">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="sport-input h-14 w-full text-center text-3xl font-black tabular-nums"
                aria-label="体重（kg）"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                kg
              </span>
            </div>
            <StepButton label="+0.1kg" onClick={() => step(0.1)}>
              <Plus size={18} />
            </StepButton>
          </div>
          {!hasCondition && (
            <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={copyCondition}
                onChange={(e) => setCopyCondition(e.target.checked)}
                className="h-4 w-4 accent-[#a3ff12]"
              />
              体調はいつも通り（前回の睡眠・気分などをコピー）
            </label>
          )}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="sport-button-primary mt-3 flex h-12 w-full items-center justify-center gap-2 disabled:opacity-60"
          >
            <Check size={18} />
            {pending ? '保存中…' : '記録する'}
          </button>
          {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
        </>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex w-full items-baseline justify-between text-left"
        >
          <span className="text-3xl font-black tabular-nums">
            {Number(value).toFixed(1)}
            <span className="ml-1 text-sm font-semibold text-slate-400">kg</span>
          </span>
          <span className="text-xs text-slate-400">タップで修正</span>
        </button>
      )}

      {ma7 !== null && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-xs">
          <span className="text-slate-400">7日平均</span>
          <span className="font-bold tabular-nums">
            {ma7.toFixed(1)}kg
            {ma7WeeklyDelta !== null && (
              <span
                className={`ml-2 ${
                  ma7WeeklyDelta < -0.05
                    ? 'text-[#a3ff12]'
                    : ma7WeeklyDelta > 0.05
                      ? 'text-rose-300'
                      : 'text-slate-400'
                }`}
              >
                {ma7WeeklyDelta > 0 ? '+' : ''}
                {ma7WeeklyDelta.toFixed(1)}kg / 週
              </span>
            )}
          </span>
        </div>
      )}
    </section>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-14 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 active:scale-95"
    >
      {children}
    </button>
  );
}
