import { redirect } from 'next/navigation';
import HydrationLogForm from '@/components/forms/HydrationLogForm';
import TodayHydrationList from '@/components/forms/TodayHydrationList';
import HydrationSummary, {
  type HydrationTotals,
} from '@/components/hydration/HydrationSummary';
import { getSessionUserId } from '@/lib/auth';
import { dateInJST } from '@/lib/date';
import { sql } from '@/lib/db';
import type { HydrationLog } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HydrationPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const date = dateInJST();
  const rowsRaw = await sql`
    select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
           to_char(time, 'HH24:MI') as time,
           drink_type, amount_ml, memo, created_at
    from hydration_logs
    where user_id = ${userId} and date = ${date}
    order by time asc nulls last, created_at asc
  `;
  const hydrationRows = rowsRaw as unknown as HydrationLog[];

  const hydrationTotal = hydrationRows.reduce<HydrationTotals>(
    (acc, row) => {
      const amount = Number(row.amount_ml);
      acc.total += amount;
      acc[row.drink_type] += amount;
      return acc;
    },
    { total: 0, water: 0, protein: 0, coffee: 0, other: 0 },
  );

  return (
    <div className="space-y-5 py-4">
      <div>
        <div className="sport-kicker">Hydration</div>
        <h1 className="mt-1 text-2xl font-black">水分補給</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          水、プロテイン、コーヒー、その他を100ml単位で記録できます。
        </p>
      </div>

      <HydrationSummary total={hydrationTotal} count={hydrationRows.length} />

      <HydrationLogForm />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-200">
          本日の水分記録 ({hydrationRows.length}件)
        </h2>
        <TodayHydrationList logs={hydrationRows} />
      </div>
    </div>
  );
}

