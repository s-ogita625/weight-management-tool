'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { disconnectGoogleHealth, syncGoogleHealth } from '@/lib/google-health';

export async function syncHealthAction(
  days = 7,
): Promise<{ ok: true; days: number } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  try {
    const res = await syncGoogleHealth(userId, Math.min(Math.max(1, Math.round(days)), 90));
    revalidatePath('/');
    revalidatePath('/settings/health');
    return { ok: true, days: res.days };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '同期に失敗しました' };
  }
}

export async function disconnectHealthAction(): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  await disconnectGoogleHealth(userId);
  revalidatePath('/');
  revalidatePath('/settings/health');
}
