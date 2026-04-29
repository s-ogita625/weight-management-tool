'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function addMealAction(_prev: unknown, formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const date = String(formData.get('date') ?? '');
  const calories = Number(formData.get('calories') ?? 0);
  const protein_g = Number(formData.get('protein_g') ?? 0);
  const fat_g = Number(formData.get('fat_g') ?? 0);
  const carbs_g = Number(formData.get('carbs_g') ?? 0);
  const memo = String(formData.get('memo') ?? '').trim() || null;

  if (!date || calories < 0 || protein_g < 0 || fat_g < 0 || carbs_g < 0) {
    return { error: '入力値が不正です' };
  }

  await sql`
    insert into meal_logs (user_id, date, calories, protein_g, fat_g, carbs_g, memo)
    values (${userId}, ${date}, ${calories}, ${protein_g}, ${fat_g}, ${carbs_g}, ${memo})
  `;

  revalidatePath('/log');
  revalidatePath('/history');
  return { ok: true as const };
}

export async function deleteMealAction(id: string) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  await sql`
    delete from meal_logs where id = ${id} and user_id = ${userId}
  `;

  revalidatePath('/history');
  revalidatePath('/log');
}
