'use client';

import { Copy, Dumbbell, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { repeatWorkoutAction } from '@/app/actions/quick';

export interface WorkoutTemplateView {
  key: string;
  label: string;
  sessionId: string;
  date: string;
  exerciseCount: number;
  setCount: number;
  daysAgo: number;
}

interface Props {
  templates: WorkoutTemplateView[];
  todaySessions: Array<{ label: string; setCount: number }>;
  sessionsThisWeek: number;
}

export default function WorkoutQuick({ templates, todaySessions, sessionsThisWeek }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const repeat = (t: WorkoutTemplateView) => {
    if (
      !confirm(
        `${t.label}（${t.date}）と同じ ${t.exerciseCount}種目・${t.setCount}セットを今日の記録として保存しますか？`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await repeatWorkoutAction(t.sessionId);
      if ('error' in res) setError(res.error);
      router.refresh();
    });
  };

  return (
    <section className="sport-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/25 text-[#a3ff12] ring-1 ring-white/10">
            <Dumbbell size={17} />
          </span>
          筋トレ
        </div>
        <span className="text-[11px] text-slate-400">今週 {sessionsThisWeek}回</span>
      </div>

      {todaySessions.length > 0 && (
        <div className="mb-3 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
          今日の記録 ✓{' '}
          {todaySessions.map((s) => `${s.label}（${s.setCount}set）`).join(' / ')}
        </div>
      )}

      {templates.length > 0 ? (
        <ul className="space-y-2">
          {templates.map((t) => (
            <li
              key={t.key}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{t.label}</div>
                <div className="text-[11px] tabular-nums text-slate-400">
                  {t.date.slice(5).replace('-', '/')}（{t.daysAgo}日前）· {t.exerciseCount}種目 {t.setCount}set
                </div>
              </div>
              <button
                type="button"
                onClick={() => repeat(t)}
                disabled={pending}
                className="flex h-10 items-center gap-1 rounded-lg bg-[#a3ff12] px-3 text-xs font-black text-[#061006] active:scale-95 disabled:opacity-60"
              >
                <Copy size={14} /> 同じで記録
              </button>
              <Link
                href={`/workout?copy=${encodeURIComponent(t.key)}`}
                aria-label={`${t.label}を編集して記録`}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-300"
              >
                <Pencil size={15} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Link href="/workout" className="sport-button-secondary flex h-11 items-center justify-center text-sm">
          筋トレを記録する
        </Link>
      )}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </section>
  );
}
