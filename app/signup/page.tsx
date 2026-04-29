import { redirect } from 'next/navigation';
import SignupForm from './SignupForm';
import { getSessionUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  const userId = await getSessionUserId();
  if (userId) redirect('/plan');
  return <SignupForm />;
}
