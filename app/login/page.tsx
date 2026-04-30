import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';
import { getSessionUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const userId = await getSessionUserId();
  if (userId) redirect('/');
  return <LoginForm />;
}
