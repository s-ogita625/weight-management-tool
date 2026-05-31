'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import type { HydrationDrinkType } from '@/lib/types';

const VALID_DRINK_TYPES = new Set<HydrationDrinkType>([
  'water',
  'protein',
  'coffee',
  'other',
]);

export async function addHydrationAction(_prev: unknown, formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const date = String(formData.get('date') ?? '').trim();
  const timeRaw = String(formData.get('time') ?? '').trim();
  const time = timeRaw || null;
  const drinkTypeRaw = String(formData.get('drink_type') ?? '').trim();
  const drink_type = VALID_DRINK_TYPES.has(drinkTypeRaw as HydrationDrinkType)
    ? (drinkTypeRaw as HydrationDrinkType)
    : null;
  const amount_ml = Number(formData.get('amount_ml') ?? 0);
  const memo = String(formData.get('memo') ?? '').trim().slice(0, 160) || null;

  if (
    !date ||
    !drink_type ||
    !Number.isInteger(amount_ml) ||
    amount_ml < 100 ||
    amount_ml > 3000 ||
    amount_ml % 100 !== 0
  ) {
    return { error: '水分量は100ml単位で入力してください' };
  }

  await sql`
    insert into hydration_logs (user_id, date, time, drink_type, amount_ml, memo)
    values (${userId}, ${date}, ${time}, ${drink_type}, ${amount_ml}, ${memo})
  `;

  revalidateHydrationPaths();
  return { ok: true as const };
}

export async function deleteHydrationAction(id: string) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  await sql`
    delete from hydration_logs
    where id = ${id} and user_id = ${userId}
  `;

  revalidateHydrationPaths();
}

function revalidateHydrationPaths() {
  revalidatePath('/');
  revalidatePath('/hydration');
  revalidatePath('/calendar');
  revalidatePath('/coach');
  revalidatePath('/chat');
}
