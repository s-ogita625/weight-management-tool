import { redirect } from 'next/navigation';
import MealLogForm from '@/components/forms/MealLogForm';
import TodayMealList from '@/components/forms/TodayMealList';
import { calculate } from '@/lib/calculations';
import { getSessionUserId } from '@/lib/auth';
import { dateInJST } from '@/lib/date';
import { sql } from '@/lib/db';
import type { MealLog, Profile } from '@/lib/types';

// SSR を毎リクエスト実行してキャッシュを使わない
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LogPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  // JST 基準で「今日」を計算（クライアントの dateInJST と一致させる）
  const date = dateInJST();

  const [mealRowsRaw, profileRowsRaw] = await Promise.all([
    sql`
      select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
             to_char(time, 'HH24:MI') as time,
             meal_type, food_name,
             calories, protein_g, fat_g, carbs_g, memo, created_at
      from meal_logs
      where user_id = ${userId} and date = ${date}
      order by time asc nulls last, created_at asc
    `,
    sql`select * from profiles where user_id = ${userId} limit 1`,
  ]);
  const mealRows = mealRowsRaw as unknown as MealLog[];
  const profileRows = profileRowsRaw as unknown as Profile[];

  const total = mealRows.reduce<{
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

  // プロフィールがあれば目標との差分を計算
  let target: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  } | null = null;
  if (profileRows[0]) {
    const p = profileRows[0];
    const result = calculate({
      heightCm: Number(p.height_cm),
      weightKg: Number(p.current_weight_kg),
      bodyFatPct: Number(p.body_fat_pct),
      age: Number(p.age),
      gender: p.gender,
      trainingFreq: p.training_freq,
      targetWeightKg: Number(p.target_weight_kg),
      targetBodyFatPct: Number(p.target_body_fat_pct),
      period: p.target_period,
      // リーンカット & 優先度をプロフィール設定から反映
      leanCutMode: p.lean_cut_mode,
      priority: p.priority,
    });
    const recommended =
      result.recommendedFormula === 'katchMcArdle'
        ? result.katchMcArdle
        : result.mifflin;
    target = {
      calories: recommended.targetCalories,
      protein_g: recommended.protein_g,
      fat_g: recommended.fat_g,
      carbs_g: recommended.carbs_g,
    };
  }

  function pct(actual: number, t: number): number {
    if (t <= 0) return 0;
    return Math.min(Math.round((actual / t) * 100), 999);
  }

  return (
    <div className="py-4 space-y-5">
      <h1 className="text-2xl font-bold">食事を記録</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex justify-between items-baseline mb-1">
          <div className="text-xs text-gray-500">本日の合計</div>
          {target && (
            <div className="text-xs text-gray-500">
              目標: {target.calories.toLocaleString()} kcal
            </div>
          )}
        </div>
        <div className="text-2xl font-bold tabular-nums">
          {Math.round(total.calories).toLocaleString()}
          <span className="text-sm font-normal ml-1">kcal</span>
          {target && (
            <span
              className={`text-sm font-normal ml-2 ${
                pct(total.calories, target.calories) > 110
                  ? 'text-red-600'
                  : pct(total.calories, target.calories) >= 90
                    ? 'text-emerald-600'
                    : 'text-gray-500'
              }`}
            >
              ({pct(total.calories, target.calories)}%)
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
          <MacroCell
            color="bg-rose-50 text-rose-600"
            label="P"
            actual={total.protein_g}
            target={target?.protein_g}
          />
          <MacroCell
            color="bg-amber-50 text-amber-600"
            label="F"
            actual={total.fat_g}
            target={target?.fat_g}
          />
          <MacroCell
            color="bg-emerald-50 text-emerald-600"
            label="C"
            actual={total.carbs_g}
            target={target?.carbs_g}
          />
        </div>
      </div>

      {mealRows.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            本日の記録 ({mealRows.length}件)
          </h2>
          <TodayMealList logs={mealRows} />
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          新しい食事を追加
        </h2>
        <MealLogForm />
      </div>
    </div>
  );
}

function MacroCell({
  color,
  label,
  actual,
  target,
}: {
  color: string;
  label: string;
  actual: number;
  target?: number;
}) {
  const [bg, txt] = color.split(' ');
  return (
    <div className={`rounded-lg p-2 ${bg}`}>
      <div className={txt}>{label}</div>
      <div className="font-semibold tabular-nums">
        {Math.round(actual)}g
        {target && (
          <span className="font-normal text-gray-500">
            /{Math.round(target)}
          </span>
        )}
      </div>
    </div>
  );
}
