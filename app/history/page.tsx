import { redirect } from 'next/navigation';
import MealHistoryList from '@/components/history/MealHistoryList';
import { createClient } from '@/lib/supabase/server';
import type { MealLog } from '@/lib/types';

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);

  const logs = (data ?? []) as MealLog[];

  return (
    <div className="py-4 space-y-4">
      <h1 className="text-2xl font-bold">食事履歴</h1>
      <p className="text-sm text-gray-600">直近 200 件まで表示します。</p>
      <MealHistoryList logs={logs} />
    </div>
  );
}
