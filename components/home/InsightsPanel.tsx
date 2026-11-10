import { AlertTriangle, CalendarRange, CheckCircle2, Info, Target } from 'lucide-react';
import Link from 'next/link';
import type { GoalCheck, Insight, WeeklyReport } from '@/lib/insights';

const TONE: Record<Insight['tone'], { box: string; icon: typeof Info; color: string }> = {
  warning: { box: 'border-amber-300/35 bg-amber-400/10', icon: AlertTriangle, color: 'text-amber-200' },
  info: { box: 'border-sky-300/30 bg-sky-400/10', icon: Info, color: 'text-sky-200' },
  success: { box: 'border-emerald-300/35 bg-emerald-400/10', icon: CheckCircle2, color: 'text-emerald-200' },
};

export function InsightList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;
  return (
    <div className="space-y-2">
      {insights.map((ins) => {
        const tone = TONE[ins.tone];
        const Icon = tone.icon;
        return (
          <div key={ins.id} className={`rounded-lg border px-4 py-3 ${tone.box}`}>
            <div className={`flex items-center gap-2 text-sm font-bold ${tone.color}`}>
              <Icon size={16} className="shrink-0" />
              {ins.title}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">{ins.body}</p>
            {ins.actions && (
              <ul className="mt-2 space-y-1 text-xs text-slate-200">
                {ins.actions.map((a) => (
                  <li key={a} className="flex gap-1.5">
                    <span className="text-[#a3ff12]">›</span>
                    {a}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function GoalCheckCard({ goal }: { goal: GoalCheck }) {
  const progressTotal = Math.max(0.1, goal.latestWeight - goal.targetWeight);
  return (
    <section className="sport-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/25 text-[#a3ff12] ring-1 ring-white/10">
            <Target size={17} />
          </span>
          目標まで
        </div>
        <span className="text-xs tabular-nums text-slate-400">
          あと {progressTotal.toFixed(1)}kg
        </span>
      </div>
      <p className="text-xs leading-relaxed text-slate-300">{goal.message}</p>
      {goal.periodTooShort && (
        <p className="mt-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
          設定した期間だと週 {goal.requiredPaceKgPerWeek}kg 減らす必要があり、筋肉が落ちやすいペースです（目安は体重の0.5〜1%/週）。
          期間を <b>約{goal.suggestedWeeks}週</b> にすると無理なく狙えます。
          <Link href="/onboarding" className="ml-1 underline">目標を見直す</Link>
        </p>
      )}
    </section>
  );
}

export function WeeklyReportCard({ report }: { report: WeeklyReport }) {
  const fmt = (d: string) => d.slice(5).replace('-', '/');
  return (
    <section className="sport-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/25 text-[#a3ff12] ring-1 ring-white/10">
            <CalendarRange size={17} />
          </span>
          この1週間
        </div>
        <span className="text-[11px] tabular-nums text-slate-400">
          {fmt(report.from)}〜{fmt(report.to)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat
          label="7日平均体重"
          value={
            report.weightMaChange === null
              ? '-'
              : `${report.weightMaChange > 0 ? '+' : ''}${report.weightMaChange}kg`
          }
          tone={
            report.weightMaChange === null
              ? 'neutral'
              : report.weightMaChange <= -0.1
                ? 'good'
                : report.weightMaChange >= 0.2
                  ? 'bad'
                  : 'neutral'
          }
        />
        <Stat
          label="平均kcal"
          value={report.avgKcal === null ? '-' : report.avgKcal.toLocaleString()}
          sub={`目標 ${report.kcalTarget.toLocaleString()}`}
        />
        <Stat
          label="平均P"
          value={report.avgProtein === null ? '-' : `${report.avgProtein}g`}
          sub={`目標 ${report.proteinTarget}g`}
        />
        <Stat label="体重記録" value={`${report.weightDays}/7日`} />
        <Stat label="食事記録" value={`${report.mealDays}/7日`} />
        <Stat label="トレ日" value={`${report.workouts}日`} />
      </div>
      {report.highlights.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-300">
          {report.highlights.map((h) => (
            <li key={h} className="flex gap-1.5">
              <span className="text-[#a3ff12]">›</span>
              {h}
            </li>
          ))}
        </ul>
      )}
      <Link href="/coach" className="mt-3 block text-right text-[11px] text-slate-400 underline-offset-2 hover:underline">
        AIコーチに詳しく分析してもらう →
      </Link>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'bad' | 'neutral';
}) {
  const color = tone === 'good' ? 'text-[#a3ff12]' : tone === 'bad' ? 'text-rose-300' : 'text-white';
  return (
    <div className="rounded-lg bg-black/20 px-1 py-2">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className={`text-sm font-black tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[9px] text-slate-500">{sub}</div>}
    </div>
  );
}
