'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import type { Bowel } from '@/lib/types';

const VALID_BOWEL = new Set<Bowel>([
  'none',
  'soft',
  'normal',
  'firm',
  'diarrhea',
]);

function parseOptionalNumber(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function parseOptionalSmallint(
  v: FormDataEntryValue | null,
  min: number,
  max: number,
): number | null {
  const n = parseOptionalNumber(v);
  if (n === null) return null;
  const i = Math.round(n);
  if (i < min || i > max) return null;
  return i;
}

export async function saveDailyLogAction(_prev: unknown, formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const date = String(formData.get('date') ?? '').trim();
  if (!date) return { error: '日付が必要です' };

  const weight_kg = parseOptionalNumber(formData.get('weight_kg'));
  const body_fat_pct = parseOptionalNumber(formData.get('body_fat_pct'));
  const sleep_hours = parseOptionalNumber(formData.get('sleep_hours'));
  const sleep_quality = parseOptionalSmallint(
    formData.get('sleep_quality'),
    1,
    5,
  );
  const fatigue = parseOptionalSmallint(formData.get('fatigue'), 1, 5);
  const mood = parseOptionalSmallint(formData.get('mood'), 1, 5);
  const bowelRaw = String(formData.get('bowel') ?? '').trim();
  const bowel =
    bowelRaw && VALID_BOWEL.has(bowelRaw as Bowel) ? (bowelRaw as Bowel) : null;
  const memo = String(formData.get('memo') ?? '').trim() || null;

  // カスタムフィールド: custom_keys[] と custom_values[] のペアで送信される想定
  const customKeys = formData.getAll('custom_key').map((v) => String(v));
  const customVals = formData.getAll('custom_value').map((v) => String(v));
  const custom: Record<string, string> = {};
  for (let i = 0; i < customKeys.length; i++) {
    const k = customKeys[i].trim();
    const v = (customVals[i] ?? '').trim();
    if (k && v) custom[k.slice(0, 50)] = v.slice(0, 200);
  }
  const customFields = Object.keys(custom).length > 0 ? custom : null;

  // バリデーション: 値が全部 null なら拒否
  if (
    weight_kg === null &&
    body_fat_pct === null &&
    sleep_hours === null &&
    sleep_quality === null &&
    fatigue === null &&
    mood === null &&
    bowel === null &&
    !memo &&
    !customFields
  ) {
    return { error: '少なくとも1項目を入力してください' };
  }

  if (
    (weight_kg !== null && (weight_kg < 30 || weight_kg > 300)) ||
    (body_fat_pct !== null && (body_fat_pct < 3 || body_fat_pct > 60)) ||
    (sleep_hours !== null && (sleep_hours < 0 || sleep_hours > 24))
  ) {
    return { error: '入力値が範囲外です' };
  }

  await sql`
    insert into daily_logs (
      user_id, date,
      weight_kg, body_fat_pct,
      sleep_hours, sleep_quality, fatigue, mood, bowel,
      memo, custom_fields
    ) values (
      ${userId}, ${date},
      ${weight_kg}, ${body_fat_pct},
      ${sleep_hours}, ${sleep_quality}, ${fatigue}, ${mood}, ${bowel},
      ${memo}, ${customFields ? JSON.stringify(customFields) : null}
    )
    on conflict (user_id, date) do update set
      weight_kg = excluded.weight_kg,
      body_fat_pct = excluded.body_fat_pct,
      sleep_hours = excluded.sleep_hours,
      sleep_quality = excluded.sleep_quality,
      fatigue = excluded.fatigue,
      mood = excluded.mood,
      bowel = excluded.bowel,
      memo = excluded.memo,
      custom_fields = excluded.custom_fields
  `;

  // プロフィールの現在体重も最新値に同期（任意機能）
  if (weight_kg !== null) {
    await sql`
      update profiles set current_weight_kg = ${weight_kg}, updated_at = now()
      where user_id = ${userId}
    `;
  }
  if (body_fat_pct !== null) {
    await sql`
      update profiles set body_fat_pct = ${body_fat_pct}, updated_at = now()
      where user_id = ${userId}
    `;
  }

  revalidatePath('/morning');
  revalidatePath('/trend');
  revalidatePath('/plan');
  revalidatePath('/');
  return { ok: true as const };
}

export async function deleteDailyLogAction(date: string) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  await sql`
    delete from daily_logs where user_id = ${userId} and date = ${date}
  `;
  revalidatePath('/morning');
  revalidatePath('/trend');
  revalidatePath('/');
}
