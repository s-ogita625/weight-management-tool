import { redirect } from 'next/navigation';
import ProfileForm from '@/components/forms/ProfileForm';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-2">プロフィール入力</h1>
      <p className="text-sm text-gray-600 mb-6">
        身体データと目標を入力してください。後からいつでも変更できます。
      </p>
      <ProfileForm initial={(data as Profile) ?? null} />
    </div>
  );
}
