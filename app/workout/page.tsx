import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Dumbbell, Footprints, HeartPulse, Watch } from 'lucide-react';
import AutoSync from '@/components/health/AutoSync';
import RecoveryCard from '@/components/health/RecoveryCard';
import { getSessionUserId } from '@/lib/auth';
import { dateInJST } from '@/lib/date';
import { sql } from '@/lib/db';
import {
  estimateRecovery,
  isStrength,
  isTrainingExercise,
  isWalk,
  type ExerciseLike,
  type RecoveryDay,
} from '@/lib/fitness';
import { addDays } from '@/lib/stats';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Row {
  date: string;
  steps: number | null;
  active_zone_minutes: number | null;
  exercises: ExerciseLike[];
}

export default async function ExercisePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  const today = dateInJST();

  const [connRaw, rowsRaw, recoveryRaw] = await Promise.all([
    sql`
      select (last_synced_at is null or last_synced_at < now() - interval '3 hours') as stale
      from health_connections where user_id = ${userId}
    `.catch(() => []),
    sql`
      select to_char(date, 'YYYY-MM-DD') as date, steps, active_zone_minutes, exercises
      from wearable_daily
      where user_id = ${userId} and date >= ${addDays(today, -56)}
      order by date desc
    `.catch(() => []),
    // 回復度（マイグレーション 0014 適用前は空）
    sql`
      select to_char(date, 'YYYY-MM-DD') as date, resting_hr, hrv_ms::float as hrv_ms, sleep_minutes
      from wearable_daily
      where user_id = ${userId} and date >= ${addDays(today, -30)}
    `.catch(() => []),
  ]);
  const conn = (connRaw as unknown as Array<{ stale: boolean }>)[0];

  if (!conn) {
    return (
      <div className="space-y-4 py-4">
        <Header />
        <Link href="/settings/health" className="sport-card flex items-center gap-3 p-4 text-sm">
          <Watch size={18} className="text-[#a3ff12]" />
          <span className="flex-1">
            運動は Fitbit（Google Health）の記録を表示します。まずは連携してください。
          </span>
          <span className="text-[#a3ff12]">→</span>
        </Link>
      </div>
    );
  }

  const rows = rowsRaw as unknown as Row[];
  const recovery = estimateRecovery(recoveryRaw as unknown as RecoveryDay[], today);

  // 今週（月曜はじまり）
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weekStart = addDays(today, -dow);
  const weekRows = rows.filter((r) => r.date >= weekStart);
  const weekEx = weekRows.flatMap((r) => r.exercises);
  const strengthCount = weekEx.filter(isStrength).length;
  const trainingDays = weekRows.filter((r) => r.exercises.some(isTrainingExercise)).length;
  const exerciseMinutes = weekEx.reduce((s, e) => s + (e.minutes ?? 0), 0);
  const azm = weekRows.reduce((s, r) => s + (r.active_zone_minutes ?? 0), 0);

  // 直近8週の筋トレ回数
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = addDays(weekStart, -7 * (7 - i));
    const to = addDays(from, 6);
    const inWeek = rows.filter((r) => r.date >= from && r.date <= to);
    return {
      from,
      strength: inWeek.flatMap((r) => r.exercises).filter(isStrength).length,
      trainingDays: inWeek.filter((r) => r.exercises.some(isTrainingExercise)).length,
    };
  });
  const maxWeek = Math.max(1, ...weeks.map((w) => w.trainingDays));

  const lastStrength = rows.find((r) => r.exercises.some(isStrength))?.date ?? null;
  const history = rows.filter((r) => r.exercises.length > 0).slice(0, 21);

  return (
    <div className="space-y-4 py-4">
      <AutoSync stale={conn.stale} />
      <Header />

      <RecoveryCard recovery={recovery} lastStrength={lastStrength} today={today} />

      <section className="sport-card p-4">
        <h2 className="mb-3 text-sm font-black">今週</h2>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label="筋トレ" value={`${strengthCount}回`} />
          <Stat label="トレ日" value={`${trainingDays}日`} />
          <Stat label="運動時間" value={`${exerciseMinutes}分`} />
          <Stat label="ゾーン分" value={`${azm}`} />
        </div>
        <div className="mt-4">
          <div className="mb-1 text-[10px] text-slate-400">週ごとのトレ日（8週）</div>
          <div className="flex h-16 items-end gap-1.5">
            {weeks.map((w) => (
              <div key={w.from} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-[#a3ff12]/70"
                  style={{ height: `${(w.trainingDays / maxWeek) * 100}%`, minHeight: w.trainingDays ? 4 : 1 }}
                  title={`${w.from}〜 トレ日${w.trainingDays}日 / 筋トレ${w.strength}回`}
                />
                <span className="text-[9px] tabular-nums text-slate-500">{w.from.slice(5).replace('-', '/')}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sport-card p-4">
        <h2 className="mb-2 text-sm font-black">運動の記録（Fitbit）</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">まだ運動の記録がありません。</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {history.map((r) => {
              const main = r.exercises.filter((e) => !isWalk(e));
              const walks = r.exercises.filter(isWalk);
              const walkMin = walks.reduce((s, e) => s + (e.minutes ?? 0), 0);
              return (
                <li key={r.date} className="py-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold">{formatDay(r.date)}</span>
                    {r.steps !== null && (
                      <span className="text-[10px] tabular-nums text-slate-500">{r.steps.toLocaleString()}歩</span>
                    )}
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {main.map((e, i) => (
                      <li key={`${e.start}-${i}`} className="flex items-center gap-2 text-xs">
                        {isStrength(e) ? (
                          <Dumbbell size={13} className="text-[#a3ff12]" />
                        ) : (
                          <HeartPulse size={13} className="text-[#20e0ff]" />
                        )}
                        <span className="flex-1">
                          {e.name}
                          {e.start ? <span className="ml-1 text-slate-500">{timeJst(e.start)}〜</span> : null}
                        </span>
                        <span className="tabular-nums text-slate-300">
                          {e.minutes ? `${e.minutes}分` : ''}
                          {e.kcal ? ` / ${Math.round(e.kcal)}kcal` : ''}
                          {e.avg_hr ? ` / 平均${e.avg_hr}bpm` : ''}
                        </span>
                      </li>
                    ))}
                    {walks.length > 0 && (
                      <li className="flex items-center gap-2 text-[11px] text-slate-400">
                        <Footprints size={13} />
                        <span className="flex-1">ウォーキング {walks.length}回</span>
                        <span className="tabular-nums">{walkMin}分</span>
                      </li>
                    )}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
          Fitbit で記録・自動認識された運動を表示しています。筋トレは Fitbit 側で「筋力トレーニング」を開始すると記録されます。
          以前このアプリで記録した筋トレのデータは削除せず保存してあります。
        </p>
      </section>
    </div>
  );
}

function Header() {
  return (
    <div>
      <div className="sport-kicker">Training</div>
      <h1 className="mt-1 text-2xl font-black">運動</h1>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/20 px-1 py-2">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="text-sm font-black tabular-nums">{value}</div>
    </div>
  );
}

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getUTCDay()];
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${w}）`;
}

function timeJst(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t + 9 * 3600 * 1000).toISOString().slice(11, 16);
}
