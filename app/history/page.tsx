import { redirect } from 'next/navigation';
import MealHistoryList from '@/components/history/MealHistoryList';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import type { MealLog } from '@/lib/types';

export default async function HistoryPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const rows = (await sql`
    select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
           calories, protein_g, fat_g, carbs_g, memo, created_at
    from meal_logs
    where user_id = ${userId}
    order by date desc, created_at desc
    limit 200
  `) as MealLog[];

  return (
    <div className="py-4 space-y-4">
      <h1 className="text-2xl font-bold">食事履歴</h1>
      <p className="text-sm text-gray-600">直近 200 件まで表示します。</p>
      <MealHistoryList logs={rows} />
    </div>
  );
}
