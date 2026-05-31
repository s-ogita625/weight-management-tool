import { redirect } from 'next/navigation';
import TrendView from '@/components/trend/TrendView';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import type { DailyLog, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TrendPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const [rowsRaw, profileRaw] = await Promise.all([
    sql`
      select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
             weight_kg, body_fat_pct,
             sleep_hours, sleep_quality, fatigue, mood, bowel,
             memo, custom_fields, created_at, updated_at
      from daily_logs
      where user_id = ${userId}
      order by date asc
      limit 365
    `,
    sql`select * from profiles where user_id = ${userId} limit 1`,
  ]);

  const logs = rowsRaw as unknown as DailyLog[];
  const profile = (profileRaw as unknown as Profile[])[0] ?? null;

  return (
    <div className="py-4 space-y-4">
      <div>
        <div className="sport-kicker">Weight progress</div>
        <h1 className="mt-1 text-2xl font-black">体重推移</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          体重・体脂肪率の変化を中心に、睡眠や疲労などのコンディションも合わせて確認できます。
        </p>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm text-gray-600">
          まだ記録がありません。朝の記録ページから入力してください。
        </p>
      ) : (
        <TrendView logs={logs} profile={profile} />
      )}
    </div>
  );
}
