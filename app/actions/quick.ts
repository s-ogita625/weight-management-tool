'use server';

/**
 * v2 ホーム画面のワンタップ記録用アクション。
 * いずれも「今日（JST）」に対して記録し、既存データを壊さないよう
 * 指定された項目だけを書き込む。
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { dateInJST, timeInJST } from '@/lib/date';
import { sql } from '@/lib/db';
import { inferMealType } from '@/lib/meal-time';
import type { MealType } from '@/lib/types';

export interface QuickMealItem {
  food_name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

const MEAL_TYPES = new Set<MealType>([
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'pre_workout',
  'post_workout',
]);

/** オフライン保存した記録を後で送るときの記録日時（JST） */
export interface RecordedAt {
  date: string;
  time: string;
}

/** 記録日時を検証。不正・未来・8日以上前なら今の日時を使う */
function resolveAt(at?: RecordedAt | null): RecordedAt {
  const now = { date: dateInJST(), time: timeInJST() };
  if (!at) return now;
  const okFormat =
    /^\d{4}-\d{2}-\d{2}$/.test(String(at.date)) && /^\d{2}:\d{2}$/.test(String(at.time));
  if (!okFormat || at.date > now.date) return now;
  const diffDays = (Date.parse(now.date) - Date.parse(at.date)) / 86400000;
  return diffDays <= 7 ? { date: at.date, time: at.time } : now;
}

async function requireUser(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  return userId;
}

function revalidateHome() {
  revalidatePath('/');
  revalidatePath('/log');
  revalidatePath('/history');
  revalidatePath('/calendar');
}

function cleanItem(item: QuickMealItem): QuickMealItem | null {
  const food_name = String(item.food_name ?? '').trim().slice(0, 100);
  const nums = [item.calories, item.protein_g, item.fat_g, item.carbs_g].map(Number);
  if (!food_name || nums.some((n) => !Number.isFinite(n) || n < 0 || n > 10000)) {
    return null;
  }
  const [calories, protein_g, fat_g, carbs_g] = nums;
  return { food_name, calories, protein_g, fat_g, carbs_g };
}

async function insertMeals(
  userId: string,
  items: QuickMealItem[],
  mealType?: MealType | null,
  at?: RecordedAt | null,
): Promise<string[]> {
  const { date, time } = resolveAt(at);
  const meal_type =
    mealType && MEAL_TYPES.has(mealType) ? mealType : inferMealType(time);
  const ids: string[] = [];
  for (const item of items) {
    const rows = (await sql`
      insert into meal_logs (
        user_id, date, time, meal_type, food_name,
        calories, protein_g, fat_g, carbs_g
      ) values (
        ${userId}, ${date}, ${time}, ${meal_type}, ${item.food_name},
        ${item.calories}, ${item.protein_g}, ${item.fat_g}, ${item.carbs_g}
      )
      returning id
    `) as unknown as Array<{ id: string }>;
    ids.push(rows[0].id);
  }
  return ids;
}

/** 定番メニューを1品、今日の食事として追加 */
export async function quickAddMealAction(
  item: QuickMealItem,
  at?: RecordedAt | null,
): Promise<{ ok: true; ids: string[] } | { error: string }> {
  const userId = await requireUser();
  const cleaned = cleanItem(item);
  if (!cleaned) return { error: '食事データが不正です' };
  const ids = await insertMeals(userId, [cleaned], null, at);
  revalidateHome();
  return { ok: true, ids };
}

/** 食事セットをまとめて今日の食事として追加 */
export async function addMealSetAction(
  setId: string,
): Promise<{ ok: true; ids: string[] } | { error: string }> {
  const userId = await requireUser();
  const rows = (await sql`
    select items, meal_type from meal_sets where id = ${setId} and user_id = ${userId}
  `) as unknown as Array<{ items: QuickMealItem[]; meal_type: MealType | null }>;
  if (rows.length === 0) return { error: 'セットが見つかりません' };
  const items = (rows[0].items ?? [])
    .map(cleanItem)
    .filter((i): i is QuickMealItem => i !== null);
  if (items.length === 0) return { error: 'セットが空です' };
  const ids = await insertMeals(userId, items, rows[0].meal_type);
  revalidateHome();
  return { ok: true, ids };
}

/** ワンタップ追加の取り消し */
export async function undoQuickMealsAction(ids: string[]): Promise<void> {
  const userId = await requireUser();
  if (!Array.isArray(ids) || ids.length === 0) return;
  await sql`
    delete from meal_logs
    where user_id = ${userId} and id = any(${ids.slice(0, 20)}::uuid[])
  `;
  revalidateHome();
}

/** 今日の指定区分（朝食など）の食事をセットとして保存（同名は上書き） */
export async function saveMealSetFromTodayAction(
  mealType: MealType,
  name: string,
): Promise<{ ok: true } | { error: string }> {
  const userId = await requireUser();
  if (!MEAL_TYPES.has(mealType)) return { error: '食事区分が不正です' };
  const setName = String(name ?? '').trim().slice(0, 40);
  if (!setName) return { error: 'セット名を入力してください' };

  const items = (await sql`
    select food_name,
           calories::float as calories, protein_g::float as protein_g,
           fat_g::float as fat_g, carbs_g::float as carbs_g
    from meal_logs
    where user_id = ${userId} and date = ${dateInJST()} and meal_type = ${mealType}
      and food_name is not null and food_name <> ''
    order by time nulls last, created_at
  `) as unknown as QuickMealItem[];
  if (items.length === 0) return { error: '保存できる食事がありません' };

  await sql`
    insert into meal_sets (user_id, name, meal_type, items)
    values (${userId}, ${setName}, ${mealType}, ${JSON.stringify(items)}::jsonb)
    on conflict (user_id, name) do update set
      meal_type = excluded.meal_type,
      items = excluded.items
  `;
  revalidatePath('/');
  return { ok: true };
}

export async function deleteMealSetAction(setId: string): Promise<void> {
  const userId = await requireUser();
  await sql`delete from meal_sets where id = ${setId} and user_id = ${userId}`;
  revalidatePath('/');
}

/**
 * 体重だけを記録する。既存の体調データは上書きしない。
 * copyCondition=true のときは、未入力の体調項目を直近の記録からコピーする（「いつも通り」）。
 */
export async function quickSaveWeightAction(
  weightKg: number,
  copyCondition: boolean,
  at?: RecordedAt | null,
): Promise<{ ok: true } | { error: string }> {
  const userId = await requireUser();
  const weight = Math.round(Number(weightKg) * 100) / 100;
  if (!Number.isFinite(weight) || weight < 30 || weight > 300) {
    return { error: '体重は30〜300kgで入力してください' };
  }
  const today = resolveAt(at).date;

  await sql`
    insert into daily_logs (user_id, date, weight_kg)
    values (${userId}, ${today}, ${weight})
    on conflict (user_id, date) do update set weight_kg = excluded.weight_kg
  `;

  if (copyCondition) {
    await sql`
      update daily_logs d set
        fatigue = coalesce(d.fatigue, p.fatigue),
        mood = coalesce(d.mood, p.mood)
      from (
        select fatigue, mood
        from daily_logs
        where user_id = ${userId} and date < ${today}
          and (fatigue is not null or mood is not null)
        order by date desc
        limit 1
      ) p
      where d.user_id = ${userId} and d.date = ${today}
    `;
  }

  await sql`
    update profiles set current_weight_kg = ${weight}, updated_at = now()
    where user_id = ${userId}
  `;

  revalidatePath('/');
  revalidatePath('/morning');
  revalidatePath('/trend');
  revalidatePath('/calendar');
  revalidatePath('/plan');
  return { ok: true };
}

/** 水を追加（100ml 単位） */
export async function quickAddWaterAction(
  amountMl: number,
  at?: RecordedAt | null,
): Promise<{ ok: true } | { error: string }> {
  const userId = await requireUser();
  const amount = Math.round(Number(amountMl));
  if (!Number.isInteger(amount) || amount < 100 || amount > 3000 || amount % 100 !== 0) {
    return { error: '水分量は100ml単位で入力してください' };
  }
  await sql`
    insert into hydration_logs (user_id, date, time, drink_type, amount_ml)
    values (${userId}, ${resolveAt(at).date}, ${resolveAt(at).time}, 'water', ${amount})
  `;
  revalidatePath('/');
  return { ok: true };
}

/** 過去のセッションを、内容そのまま今日の記録として複製する */
export async function repeatWorkoutAction(
  sessionId: string,
): Promise<{ ok: true } | { error: string }> {
  const userId = await requireUser();
  const src = (await sql`
    select id, duration_min, main_body_part, perceived_effort, to_char(date, 'YYYY-MM-DD') as date
    from workout_sessions where id = ${sessionId} and user_id = ${userId}
  `) as unknown as Array<{
    id: string;
    duration_min: number | null;
    main_body_part: string | null;
    perceived_effort: number | null;
    date: string;
  }>;
  if (src.length === 0) return { error: '元の記録が見つかりません' };
  const s = src[0];

  const created = (await sql`
    insert into workout_sessions (
      user_id, date, start_time, duration_min, main_body_part, perceived_effort, memo
    ) values (
      ${userId}, ${dateInJST()}, ${timeInJST()}, ${s.duration_min}, ${s.main_body_part},
      ${s.perceived_effort}, ${`${s.date}の内容をそのまま記録`}
    )
    returning id
  `) as unknown as Array<{ id: string }>;
  const newId = created[0].id;

  const exercises = (await sql`
    select id, exercise_order, name, body_part, memo
    from workout_exercises where session_id = ${s.id}
    order by exercise_order
  `) as unknown as Array<{
    id: string;
    exercise_order: number;
    name: string;
    body_part: string;
    memo: string | null;
  }>;

  for (const ex of exercises) {
    const exRows = (await sql`
      insert into workout_exercises (session_id, exercise_order, name, body_part, memo)
      values (${newId}, ${ex.exercise_order}, ${ex.name}, ${ex.body_part}, ${ex.memo})
      returning id
    `) as unknown as Array<{ id: string }>;
    await sql`
      insert into workout_sets (
        exercise_id, set_order, weight_kg, reps, rpe, rir, set_type, side, memo
      )
      select ${exRows[0].id}, set_order, weight_kg, reps, rpe, rir, set_type, side, memo
      from workout_sets where exercise_id = ${ex.id}
    `;
  }

  revalidatePath('/');
  revalidatePath('/workout');
  revalidatePath('/calendar');
  return { ok: true };
}
