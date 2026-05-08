'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

function parseFormData(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim().slice(0, 60);
  const category = String(formData.get('category') ?? '').trim().slice(0, 50);
  const amount = Number(formData.get('amount') ?? 0);
  const billing_day = Number(formData.get('billing_day') ?? 1);
  const purpose =
    String(formData.get('purpose') ?? '').trim().slice(0, 200) || null;
  const start_month = String(formData.get('start_month') ?? '').trim();
  const end_month_raw = String(formData.get('end_month') ?? '').trim();
  const end_month = end_month_raw || null;
  const is_active = formData.get('is_active') === 'on';

  return {
    name,
    category,
    amount,
    billing_day,
    purpose,
    start_month,
    end_month,
    is_active,
  };
}

function validate(p: ReturnType<typeof parseFormData>): string | null {
  if (!p.name) return '名称を入力してください';
  if (!p.category) return 'カテゴリを選択してください';
  if (isNaN(p.amount) || p.amount <= 0) return '金額を正しく入力してください';
  if (p.amount > 100_000_000) return '金額が大きすぎます';
  if (
    isNaN(p.billing_day) ||
    p.billing_day < 1 ||
    p.billing_day > 31 ||
    !Number.isInteger(p.billing_day)
  )
    return '請求日は1〜31の整数で入力してください';
  if (!/^\d{4}-\d{2}$/.test(p.start_month))
    return '開始月の形式が正しくありません (YYYY-MM)';
  if (p.end_month && !/^\d{4}-\d{2}$/.test(p.end_month))
    return '終了月の形式が正しくありません (YYYY-MM)';
  if (p.end_month && p.end_month < p.start_month)
    return '終了月は開始月以降を指定してください';
  return null;
}

export async function addRecurringAction(
  _prev: unknown,
  formData: FormData,
) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const p = parseFormData(formData);
  const err = validate(p);
  if (err) return { error: err };

  await sql`
    insert into recurring_expenses (
      user_id, name, category, amount, billing_day,
      purpose, start_month, end_month, is_active
    ) values (
      ${userId}, ${p.name}, ${p.category}, ${p.amount}, ${p.billing_day},
      ${p.purpose}, ${p.start_month}, ${p.end_month}, ${p.is_active}
    )
  `;

  revalidatePath('/budget');
  revalidatePath('/budget/recurring');
  revalidatePath('/');
  return { ok: true as const };
}

export async function updateRecurringAction(
  _prev: unknown,
  formData: FormData,
) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { error: 'IDが必要です' };

  const p = parseFormData(formData);
  const err = validate(p);
  if (err) return { error: err };

  await sql`
    update recurring_expenses set
      name = ${p.name},
      category = ${p.category},
      amount = ${p.amount},
      billing_day = ${p.billing_day},
      purpose = ${p.purpose},
      start_month = ${p.start_month},
      end_month = ${p.end_month},
      is_active = ${p.is_active}
    where id = ${id} and user_id = ${userId}
  `;

  revalidatePath('/budget');
  revalidatePath('/budget/recurring');
  revalidatePath('/');
  return { ok: true as const };
}

export async function deleteRecurringAction(id: string) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  await sql`
    delete from recurring_expenses where id = ${id} and user_id = ${userId}
  `;
  revalidatePath('/budget');
  revalidatePath('/budget/recurring');
  revalidatePath('/');
}

export async function toggleRecurringActiveAction(
  id: string,
  isActive: boolean,
) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  await sql`
    update recurring_expenses set is_active = ${isActive}
    where id = ${id} and user_id = ${userId}
  `;
  revalidatePath('/budget');
  revalidatePath('/budget/recurring');
  revalidatePath('/');
}
