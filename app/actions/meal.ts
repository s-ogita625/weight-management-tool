'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import type { MealType } from '@/lib/types';

const VALID_MEAL_TYPES = new Set<MealType>([
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'pre_workout',
  'post_workout',
]);

export async function addMealAction(_prev: unknown, formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const date = String(formData.get('date') ?? '');
  const timeRaw = String(formData.get('time') ?? '').trim();
  const time = timeRaw || null;
  const mealTypeRaw = String(formData.get('meal_type') ?? '').trim();
  const meal_type =
    mealTypeRaw && VALID_MEAL_TYPES.has(mealTypeRaw as MealType)
      ? (mealTypeRaw as MealType)
      : null;
  const food_name =
    String(formData.get('food_name') ?? '').trim().slice(0, 100) || null;

  const calories = Number(formData.get('calories') ?? 0);
  const protein_g = Number(formData.get('protein_g') ?? 0);
  const fat_g = Number(formData.get('fat_g') ?? 0);
  const carbs_g = Number(formData.get('carbs_g') ?? 0);
  const memo = String(formData.get('memo') ?? '').trim() || null;

  if (
    !date ||
    isNaN(calories) ||
    isNaN(protein_g) ||
    isNaN(fat_g) ||
    isNaN(carbs_g) ||
    calories < 0 ||
    protein_g < 0 ||
    fat_g < 0 ||
    carbs_g < 0
  ) {
    return { error: '入力値が不正です' };
  }

  await sql`
    insert into meal_logs (
      user_id, date, time, meal_type, food_name,
      calories, protein_g, fat_g, carbs_g, memo
    ) values (
      ${userId}, ${date}, ${time}, ${meal_type}, ${food_name},
      ${calories}, ${protein_g}, ${fat_g}, ${carbs_g}, ${memo}
    )
  `;

  // レイアウトごと再検証してサーバーコンポーネントを再実行
  revalidatePath('/log', 'layout');
  revalidatePath('/history', 'layout');
  return { ok: true as const };
}

export async function deleteMealAction(id: string) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  await sql`
    delete from meal_logs where id = ${id} and user_id = ${userId}
  `;

  revalidatePath('/history', 'layout');
  revalidatePath('/log', 'layout');
}

export interface MealSuggestion {
  food_name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  uses: number;
  last_used_date: string;
  last_meal_type: string | null;
}

/**
 * 過去に記録した食事を、料理名でグループ化して返す。
 * - food_name が空のものは除外
 * - 各料理の最新の値（最後に記録した内容）を採用
 * - 利用回数が多い順、最近使った順でソート
 *
 * @param query 部分一致検索（料理名）。空なら全件
 * @param limit 上限件数（デフォルト50）
 */
export async function getMealSuggestions(
  query: string = '',
  limit: number = 50,
): Promise<MealSuggestion[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];

  const q = query.trim();
  // 空文字列 = 全マッチ。ILIKE は %% で全件マッチするので OK
  const pattern = `%${q.replace(/[%_\\]/g, (c) => '\\' + c)}%`;

  const rows = (await sql`
    with ranked as (
      select
        food_name,
        calories, protein_g, fat_g, carbs_g,
        date, meal_type, created_at,
        row_number() over (
          partition by food_name
          order by date desc, created_at desc
        ) as rn,
        count(*) over (partition by food_name) as uses,
        max(date) over (partition by food_name) as last_date
      from meal_logs
      where user_id = ${userId}
        and food_name is not null
        and food_name <> ''
        and food_name ilike ${pattern}
    )
    select
      food_name,
      calories::float as calories,
      protein_g::float as protein_g,
      fat_g::float as fat_g,
      carbs_g::float as carbs_g,
      uses::int as uses,
      to_char(last_date, 'YYYY-MM-DD') as last_used_date,
      meal_type as last_meal_type
    from ranked
    where rn = 1
    order by uses desc, last_date desc
    limit ${limit}
  `) as unknown as MealSuggestion[];

  return rows;
}
