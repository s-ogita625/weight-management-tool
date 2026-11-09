import 'server-only';

import webpush from 'web-push';
import { sql } from '@/lib/db';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let configured = false;

export function pushConfigured(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:noreply@example.com',
      pub,
      priv,
    );
    configured = true;
  }
  return true;
}

/** ユーザーの全端末に通知を送る。失効した購読は削除する。送信数を返す */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0;
  const subs = (await sql`
    select id, endpoint, p256dh, auth from push_subscriptions where user_id = ${userId}
  `) as unknown as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>;
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 6 },
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await sql`delete from push_subscriptions where id = ${s.id}`;
      } else {
        console.error('[push] send failed', status);
      }
    }
  }
  return sent;
}
