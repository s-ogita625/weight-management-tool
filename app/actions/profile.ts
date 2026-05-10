'use server';

import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import type { Gender, Period, Priority, TrainingFreq } from '@/lib/types';

export async function saveProfileAction(_prev: unknown, formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const num = (k: string) => Number(formData.get(k));
  const str = (k: string) => String(formData.get(k) ?? '');

  const leanCutRaw = str('lean_cut_mode');
  const lean_cut_mode = leanCutRaw === 'on' || leanCutRaw === 'true';
  const priorityRaw = str('priority');
  const priority: Priority = (
    ['fat_loss', 'muscle_retention', 'recomposition'] as const
  ).includes(priorityRaw as Priority)
    ? (priorityRaw as Priority)
    : 'fat_loss';

  const payload = {
    user_id: userId,
    height_cm: num('height_cm'),
    gender: str('gender') as Gender,
    age: num('age'),
    current_weight_kg: num('current_weight_kg'),
    body_fat_pct: num('body_fat_pct'),
    training_freq: str('training_freq') as TrainingFreq,
    target_weight_kg: num('target_weight_kg'),
    target_body_fat_pct: num('target_body_fat_pct'),
    target_period: str('target_period') as Period,
    lean_cut_mode,
    priority,
  };

  // 簡易バリデーション
  if (
    !['male', 'female'].includes(payload.gender) ||
    !['none', '1-2', '3-4', '5+'].includes(payload.training_freq) ||
    !['1mo', '3mo', '6mo', '1yr'].includes(payload.target_period)
  ) {
    return { error: '入力値が不正です' };
  }

  await sql`
    insert into profiles (
      user_id, height_cm, gender, age, current_weight_kg, body_fat_pct,
      training_freq, target_weight_kg, target_body_fat_pct, target_period,
      lean_cut_mode, priority
    ) values (
      ${payload.user_id}, ${payload.height_cm}, ${payload.gender}, ${payload.age},
      ${payload.current_weight_kg}, ${payload.body_fat_pct}, ${payload.training_freq},
      ${payload.target_weight_kg}, ${payload.target_body_fat_pct}, ${payload.target_period},
      ${payload.lean_cut_mode}, ${payload.priority}
    )
    on conflict (user_id) do update set
      height_cm = excluded.height_cm,
      gender = excluded.gender,
      age = excluded.age,
      current_weight_kg = excluded.current_weight_kg,
      body_fat_pct = excluded.body_fat_pct,
      training_freq = excluded.training_freq,
      target_weight_kg = excluded.target_weight_kg,
      target_body_fat_pct = excluded.target_body_fat_pct,
      target_period = excluded.target_period,
      lean_cut_mode = excluded.lean_cut_mode,
      priority = excluded.priority
  `;

  redirect('/plan');
}
