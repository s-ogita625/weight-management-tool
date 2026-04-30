'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import type { TxKind } from '@/lib/types';

export async function addTransactionAction(_prev: unknown, formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const date = String(formData.get('date') ?? '').trim();
  const kindRaw = String(formData.get('kind') ?? '').trim();
  const kind: TxKind | null =
    kindRaw === 'income' || kindRaw === 'expense' ? kindRaw : null;
  const category = String(formData.get('category') ?? '').trim().slice(0, 50);
  const amount = Number(formData.get('amount') ?? 0);
  const memo = String(formData.get('memo') ?? '').trim() || null;

  if (!date || !kind || !category || isNaN(amount) || amount < 0) {
    return { error: '入力値が不正です' };
  }
  if (amount > 100_000_000) {
    return { error: '金額が大きすぎます' };
  }

  await sql`
    insert into transactions (user_id, date, kind, category, amount, memo)
    values (${userId}, ${date}, ${kind}, ${category}, ${amount}, ${memo})
  `;

  revalidatePath('/budget', 'layout');
  return { ok: true as const };
}

export async function deleteTransactionAction(id: string) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  await sql`
    delete from transactions where id = ${id} and user_id = ${userId}
  `;
  revalidatePath('/budget', 'layout');
}
