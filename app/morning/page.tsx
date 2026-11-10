import { redirect } from 'next/navigation';
import DailyLogForm from '@/components/forms/DailyLogForm';
import { getSessionUserId } from '@/lib/auth';
import { dateInJST } from '@/lib/date';
import { estimateRecovery, type RecoveryDay } from '@/lib/fitness';
import { addDays } from '@/lib/stats';
import { sql } from '@/lib/db';
import type { DailyLog } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MorningPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const today = dateInJST();
  const rows = (await sql`
    select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
           weight_kg, body_fat_pct,
           sleep_hours, sleep_quality, fatigue, mood, bowel,
           memo, custom_fields, created_at, updated_at
    from daily_logs
    where user_id = ${userId} and date = ${today}
    limit 1
  `) as unknown as DailyLog[];

  const initial = rows[0] ?? null;

  const prevRows = (await sql`
    select to_char(date, 'YYYY-MM-DD') as date,
           sleep_hours, sleep_quality, fatigue, mood, bowel
    from daily_logs
    where user_id = ${userId} and date < ${today}
      and (fatigue is not null or mood is not null)
    order by date desc
    limit 1
  `) as unknown as DailyLog[];
  const previous = prevRows[0] ?? null;

  // Fitbit 連携中なら睡眠は自動取得（入力欄を出さない）
  const [connRows, sleepRows, recoveryRows] = await Promise.all([
    sql`select 1 from health_connections where user_id = ${userId}`.catch(() => []),
    sql`
      select sleep_minutes, deep_minutes, rem_minutes from wearable_daily
      where user_id = ${userId} and date = ${today}
    `.catch(() => []),
    sql`
      select to_char(date, 'YYYY-MM-DD') as date, resting_hr, hrv_ms::float as hrv_ms, sleep_minutes
      from wearable_daily
      where user_id = ${userId} and date >= ${addDays(today, -30)}
    `.catch(() => []),
  ]);
  const recovery = estimateRecovery(recoveryRows as unknown as RecoveryDay[], today);
  const s = (sleepRows as unknown as Array<{ sleep_minutes: number | null; deep_minutes: number | null; rem_minutes: number | null }>)[0];
  const fitbitSleep = {
    connected: (connRows as unknown[]).length > 0,
    minutes: s?.sleep_minutes ?? null,
    deep: s?.deep_minutes ?? null,
    rem: s?.rem_minutes ?? null,
  };

  return (
    <div className="py-4 space-y-4">
      <h1 className="text-2xl font-bold">朝の記録</h1>
      <p className="text-sm text-gray-600">
        体重だけでもOK。体調がいつも通りなら下のボタンで前回の内容をコピーできます。
        {initial ? ' （本日分は更新します）' : ''}
      </p>
      <DailyLogForm
        initial={initial}
        previous={previous}
        fitbitSleep={fitbitSleep}
        estimatedFatigue={
          recovery ? { value: recovery.fatigue, label: recovery.label, reasons: recovery.reasons } : null
        }
      />
    </div>
  );
}
