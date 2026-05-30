'use server';

import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import type {
  CheatDayFrequency,
  Gender,
  Period,
  Priority,
  TrainingFreq,
} from '@/lib/types';

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
  const cheatDayRaw = str('cheat_day_enabled');
  const cheat_day_enabled = cheatDayRaw === 'on' || cheatDayRaw === 'true';
  const cheatDayFrequencyRaw = str('cheat_day_frequency');
  const cheat_day_frequency: CheatDayFrequency = (
    ['auto', 'weekly', 'biweekly', 'monthly', 'event_only'] as const
  ).includes(cheatDayFrequencyRaw as CheatDayFrequency)
    ? (cheatDayFrequencyRaw as CheatDayFrequency)
    : 'auto';
  const birthdayRaw = str('birthday_mmdd');
  const birthday_mmdd =
    /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(birthdayRaw)
      ? birthdayRaw
      : '06-25';

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
    cheat_day_enabled,
    cheat_day_frequency,
    birthday_mmdd,
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
      lean_cut_mode, priority, cheat_day_enabled, cheat_day_frequency, birthday_mmdd
    ) values (
      ${payload.user_id}, ${payload.height_cm}, ${payload.gender}, ${payload.age},
      ${payload.current_weight_kg}, ${payload.body_fat_pct}, ${payload.training_freq},
      ${payload.target_weight_kg}, ${payload.target_body_fat_pct}, ${payload.target_period},
      ${payload.lean_cut_mode}, ${payload.priority}, ${payload.cheat_day_enabled},
      ${payload.cheat_day_frequency}, ${payload.birthday_mmdd}
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
      priority = excluded.priority,
      cheat_day_enabled = excluded.cheat_day_enabled,
      cheat_day_frequency = excluded.cheat_day_frequency,
      birthday_mmdd = excluded.birthday_mmdd
  `;

  redirect('/plan');
}
