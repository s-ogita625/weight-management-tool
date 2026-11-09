import { Footprints, Moon, Watch } from 'lucide-react';
import Link from 'next/link';
import AutoSync from '@/components/health/AutoSync';

export interface ActivityDay {
  date: string;
  steps: number | null;
  total_kcal: number | null;
  active_zone_minutes: number | null;
  sleep_minutes: number | null;
  deep_minutes: number | null;
  rem_minutes: number | null;
  exercises: Array<{ name: string; minutes: number | null; kcal: number | null }>;
}

interface Props {
  connected: boolean;
  configured: boolean;
  stale: boolean;
  today: ActivityDay | null;
  /** 直近7日（今日を除く）の平均消費kcal と 平均摂取kcal */
  avgBurned: number | null;
  avgIntake: number | null;
  intakeToday: number;
}

const hm = (min: number) => `${Math.floor(min / 60)}時間${String(min % 60).padStart(2, '0')}分`;

export default function ActivityCard({
  connected,
  configured,
  stale,
  today,
  avgBurned,
  avgIntake,
  intakeToday,
}: Props) {
  if (!connected) {
    if (!configured) return null;
    return (
      <Link href="/settings/health" className="sport-card flex items-center gap-3 p-3 text-sm">
        <Watch size={18} className="text-[#a3ff12]" />
        <span className="flex-1">Fitbit Air と連携して、歩数・消費カロリー・睡眠を自動で取り込む</span>
        <span className="text-[#a3ff12]">→</span>
      </Link>
    );
  }

  const balance = avgBurned !== null && avgIntake !== null ? Math.round(avgIntake - avgBurned) : null;
  return (
    <section className="sport-card p-4">
      <AutoSync stale={stale} />
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/25 text-[#a3ff12] ring-1 ring-white/10">
            <Watch size={17} />
          </span>
          Fitbit
        </div>
        <Link href="/settings/health" className="text-[11px] text-slate-400 underline-offset-2 hover:underline">
          連携設定
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric icon={<Footprints size={14} />} label="歩数" value={today?.steps?.toLocaleString() ?? '-'} />
        <Metric
          label="消費(今まで)"
          value={today?.total_kcal ? `${Math.round(today.total_kcal).toLocaleString()}` : '-'}
          unit="kcal"
        />
        <Metric
          icon={<Moon size={14} />}
          label="昨夜の睡眠"
          value={today?.sleep_minutes ? hm(today.sleep_minutes) : '-'}
        />
      </div>
      {today?.total_kcal ? (
        <p className="mt-2 text-[11px] text-slate-400">
          今日の収支（ここまで）: 摂取 {Math.round(intakeToday).toLocaleString()} − 消費{' '}
          {Math.round(today.total_kcal).toLocaleString()} ={' '}
          <b className={intakeToday - today.total_kcal > 0 ? 'text-rose-300' : 'text-[#a3ff12]'}>
            {intakeToday - today.total_kcal > 0 ? '+' : ''}
            {Math.round(intakeToday - today.total_kcal).toLocaleString()}kcal
          </b>
        </p>
      ) : null}
      {balance !== null && (
        <p className="mt-1 text-[11px] text-slate-400">
          直近7日の平均: 消費 {Math.round(avgBurned as number).toLocaleString()}kcal / 摂取{' '}
          {Math.round(avgIntake as number).toLocaleString()}kcal（
          <b className={balance > 0 ? 'text-rose-300' : 'text-[#a3ff12]'}>
            {balance > 0 ? '+' : ''}
            {balance.toLocaleString()}kcal/日
          </b>
          ）
        </p>
      )}
      {today && today.exercises.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] text-slate-300">
          {today.exercises.map((e, i) => (
            <li key={`${e.name}-${i}`}>
              🏃 {e.name}
              {e.minutes ? ` ${e.minutes}分` : ''}
              {e.kcal ? ` / ${Math.round(e.kcal)}kcal` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  unit,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-lg bg-black/20 px-1 py-2">
      <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
        {icon}
        {label}
      </div>
      <div className="text-sm font-black tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-normal text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}
