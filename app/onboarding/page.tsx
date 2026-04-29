import { redirect } from 'next/navigation';
import ProfileForm from '@/components/forms/ProfileForm';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import type { Profile } from '@/lib/types';

export default async function OnboardingPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const rows = (await sql`
    select * from profiles where user_id = ${userId} limit 1
  `) as Profile[];

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-2">プロフィール入力</h1>
      <p className="text-sm text-gray-600 mb-6">
        身体データと目標を入力してください。後からいつでも変更できます。
      </p>
      <ProfileForm initial={rows[0] ?? null} />
    </div>
  );
}
