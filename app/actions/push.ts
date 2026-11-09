'use server';

import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import { isAllowedPushEndpoint, pushConfigured, sendPushToUser } from '@/lib/push';

interface SerializedSubscription {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

export async function subscribePushAction(
  sub: SerializedSubscription,
): Promise<{ ok: true } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  const endpoint = String(sub?.endpoint ?? '');
  const p256dh = String(sub?.keys?.p256dh ?? '');
  const auth = String(sub?.keys?.auth ?? '');
  if (!isAllowedPushEndpoint(endpoint) || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
    return { error: '通知の登録情報が不正です' };
  }
  await sql`
    insert into push_subscriptions (user_id, endpoint, p256dh, auth)
    values (${userId}, ${endpoint}, ${p256dh}, ${auth})
    on conflict (endpoint) do update set
      user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
  `;
  return { ok: true };
}

export async function unsubscribePushAction(endpoint: string): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  await sql`delete from push_subscriptions where user_id = ${userId} and endpoint = ${endpoint}`;
}

export async function sendTestPushAction(): Promise<{ ok: true; sent: number } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  if (!pushConfigured()) return { error: 'サーバーの通知キーが未設定です' };
  const sent = await sendPushToUser(userId, {
    title: 'テスト通知',
    body: 'リマインド通知はこのように届きます 💪',
    tag: 'test',
  });
  return { ok: true, sent };
}
