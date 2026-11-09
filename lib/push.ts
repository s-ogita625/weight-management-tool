import 'server-only';

import webpush from 'web-push';
import { sql } from '@/lib/db';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * サーバーから送信先に HTTP リクエストを送るため、既知のプッシュサービス以外には送らない（SSRF 対策）。
 * 登録時と送信時の両方でチェックする。
 */
const PUSH_HOST_SUFFIXES = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'notify.windows.com',
  'push.apple.com',
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
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
    if (!isAllowedPushEndpoint(s.endpoint)) {
      await sql`delete from push_subscriptions where id = ${s.id}`;
      continue;
    }
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
