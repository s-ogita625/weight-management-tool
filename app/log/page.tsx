import { redirect } from 'next/navigation';
import MealLogForm from '@/components/forms/MealLogForm';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export default async function LogPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const date = todayISO();

  const rows = (await sql`
    select calories, protein_g, fat_g, carbs_g
    from meal_logs
    where user_id = ${userId} and date = ${date}
  `) as { calories: string | number; protein_g: string | number; fat_g: string | number; carbs_g: string | number }[];

  const total = rows.reduce<{
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  }>(
    (a, r) => ({
      calories: a.calories + Number(r.calories),
      protein_g: a.protein_g + Number(r.protein_g),
      fat_g: a.fat_g + Number(r.fat_g),
      carbs_g: a.carbs_g + Number(r.carbs_g),
    }),
    { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
  );

  return (
    <div className="py-4 space-y-5">
      <h1 className="text-2xl font-bold">食事を記録</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-xs text-gray-500 mb-1">本日の合計</div>
        <div className="text-2xl font-bold tabular-nums">
          {Math.round(total.calories).toLocaleString()}
          <span className="text-sm font-normal ml-1">kcal</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
          <div className="bg-rose-50 rounded-lg p-2">
            <div className="text-rose-600">P</div>
            <div className="font-semibold tabular-nums">
              {Math.round(total.protein_g)}g
            </div>
          </div>
          <div className="bg-amber-50 rounded-lg p-2">
            <div className="text-amber-600">F</div>
            <div className="font-semibold tabular-nums">
              {Math.round(total.fat_g)}g
            </div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2">
            <div className="text-emerald-600">C</div>
            <div className="font-semibold tabular-nums">
              {Math.round(total.carbs_g)}g
            </div>
          </div>
        </div>
      </div>

      <MealLogForm />
    </div>
  );
}
