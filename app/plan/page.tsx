import { redirect } from 'next/navigation';
import PlanView from '@/components/forms/PlanView';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

export default async function PlanPage() {
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

  if (!data) redirect('/onboarding');

  return (
    <div>
      <h1 className="text-2xl font-bold mt-4">食事プラン</h1>
      <PlanView profile={data as Profile} />
    </div>
  );
}
