'use server';

import { redirect } from 'next/navigation';
import {
  createSession,
  destroySession,
  login as loginUser,
  signup as signupUser,
} from '@/lib/auth';
import { sql } from '@/lib/db';

export async function signupAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const res = await signupUser(email, password);
  if (!res.ok) return { error: res.error };

  await createSession(res.userId);
  redirect('/onboarding');
}

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const res = await loginUser(email, password);
  if (!res.ok) return { error: res.error };

  await createSession(res.userId);

  // プロフィールがあればダッシュボード(/)、無ければ /onboarding
  const rows = (await sql`
    select 1 from profiles where user_id = ${res.userId} limit 1
  `) as unknown[];
  redirect(rows.length > 0 ? '/' : '/onboarding');
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}
