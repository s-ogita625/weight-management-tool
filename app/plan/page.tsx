import { redirect } from 'next/navigation';
import PlanView from '@/components/forms/PlanView';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import type { Profile } from '@/lib/types';

export default async function PlanPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const rows = (await sql`
    select * from profiles where user_id = ${userId} limit 1
  `) as Profile[];

  if (rows.length === 0) redirect('/onboarding');

  // Postgres は数値を string で返す場合があるので明示的に Number 化
  const r = rows[0];
  const profile: Profile = {
    user_id: r.user_id,
    height_cm: Number(r.height_cm),
    gender: r.gender,
    age: Number(r.age),
    current_weight_kg: Number(r.current_weight_kg),
    body_fat_pct: Number(r.body_fat_pct),
    training_freq: r.training_freq,
    target_weight_kg: Number(r.target_weight_kg),
    target_body_fat_pct: Number(r.target_body_fat_pct),
    target_period: r.target_period,
    lean_cut_mode: r.lean_cut_mode,
    priority: r.priority,
    cheat_day_enabled: r.cheat_day_enabled,
    cheat_day_frequency: r.cheat_day_frequency,
    birthday_mmdd: r.birthday_mmdd,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mt-4">食事プラン</h1>
      <PlanView profile={profile} />
    </div>
  );
}
