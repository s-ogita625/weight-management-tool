import { redirect } from 'next/navigation';
import DailyLogForm from '@/components/forms/DailyLogForm';
import { getSessionUserId } from '@/lib/auth';
import { dateInJST } from '@/lib/date';
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

  return (
    <div className="py-4 space-y-4">
      <h1 className="text-2xl font-bold">朝の記録</h1>
      <p className="text-sm text-gray-600">
        起床後すぐに、体重・体脂肪率と今日のコンディションを記録しましょう。
        {initial ? ' （本日分は更新します）' : ''}
      </p>
      <DailyLogForm initial={initial} />
    </div>
  );
}
