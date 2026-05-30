import { redirect } from 'next/navigation';
import RecordCalendar, {
  type CalendarDaySummary,
} from '@/components/calendar/RecordCalendar';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CalendarPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const rowsRaw = await sql`
    with meal_daily as (
      select
        user_id,
        date,
        sum(calories)::float as calories,
        sum(protein_g)::float as protein_g,
        sum(fat_g)::float as fat_g,
        sum(carbs_g)::float as carbs_g,
        count(*)::int as meal_count
      from meal_logs
      where user_id = ${userId}
      group by user_id, date
    ),
    all_days as (
      select date from meal_daily
      union
      select date from daily_logs where user_id = ${userId}
    )
    select
      to_char(d.date, 'YYYY-MM-DD') as date,
      coalesce(m.calories, 0)::float as calories,
      coalesce(m.protein_g, 0)::float as protein_g,
      coalesce(m.fat_g, 0)::float as fat_g,
      coalesce(m.carbs_g, 0)::float as carbs_g,
      coalesce(m.meal_count, 0)::int as meal_count,
      dl.weight_kg::float as weight_kg,
      dl.body_fat_pct::float as body_fat_pct,
      dl.sleep_hours::float as sleep_hours,
      dl.fatigue::float as fatigue,
      dl.mood::float as mood
    from all_days d
    left join meal_daily m
      on m.user_id = ${userId} and m.date = d.date
    left join daily_logs dl
      on dl.user_id = ${userId} and dl.date = d.date
    order by d.date desc
    limit 370
  `;

  const rows = rowsRaw as unknown as CalendarDaySummary[];

  return (
    <div className="space-y-4 py-4">
      <div>
        <div className="sport-kicker">Record calendar</div>
        <h1 className="mt-1 text-2xl font-black">記録カレンダー</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          食事、PFC、体重、体脂肪、コンディションを日別にまとめて確認できます。
        </p>
      </div>
      <RecordCalendar days={rows} />
    </div>
  );
}
