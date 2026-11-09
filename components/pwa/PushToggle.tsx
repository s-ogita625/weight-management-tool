'use client';

import { Bell, BellOff } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import {
  sendTestPushAction,
  subscribePushAction,
  unsubscribePushAction,
} from '@/app/actions/push';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

type Support = 'checking' | 'ok' | 'ios-not-installed' | 'unsupported' | 'no-key';

/** メニュー内の「記録リマインド通知」スイッチ */
export default function PushToggle() {
  const [support, setSupport] = useState<Support>('checking');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ua = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const standalone = window.matchMedia('(display-mode: standalone)').matches;
      let next: Support = 'ok';
      if (!vapidKey) next = 'no-key';
      else if (isIOS && !standalone) next = 'ios-not-installed';
      else if (!('serviceWorker' in navigator) || !('PushManager' in window)) next = 'unsupported';
      let sub: PushSubscription | null = null;
      if (next === 'ok') {
        const reg = await navigator.serviceWorker.getRegistration();
        sub = (await reg?.pushManager.getSubscription()) ?? null;
      }
      if (!cancelled) {
        setSupport(next);
        setSubscription(sub);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  const enable = () =>
    startTransition(async () => {
      setMessage(null);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setMessage('通知が許可されませんでした。端末の設定から許可してください。');
          return;
        }
        const reg =
          (await navigator.serviceWorker.getRegistration()) ??
          (await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }));
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey as string),
        });
        const res = await subscribePushAction(JSON.parse(JSON.stringify(sub)));
        if ('error' in res) {
          setMessage(res.error);
          return;
        }
        setSubscription(sub);
        setMessage('ONにしました。10時に体重、21時に食事の記録漏れがあればお知らせします。');
      } catch {
        setMessage('通知を有効にできませんでした。');
      }
    });

  const disable = () =>
    startTransition(async () => {
      if (!subscription) return;
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe().catch(() => {});
      await unsubscribePushAction(endpoint);
      setSubscription(null);
      setMessage('OFFにしました。');
    });

  const test = () =>
    startTransition(async () => {
      const res = await sendTestPushAction();
      setMessage('error' in res ? res.error : res.sent > 0 ? 'テスト通知を送りました。' : '送信先の端末が見つかりませんでした。');
    });

  if (support === 'checking') return null;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {subscription ? (
            <Bell size={20} className="text-[#a3ff12]" />
          ) : (
            <BellOff size={20} className="text-slate-400" />
          )}
          <div>
            <div className="font-medium">記録リマインド通知</div>
            <div className="text-[11px] text-slate-400">10時 体重 / 21時 食事の記録漏れ</div>
          </div>
        </div>
        {support === 'ok' && (
          <button
            type="button"
            onClick={subscription ? disable : enable}
            disabled={pending}
            className={`h-9 rounded-full px-4 text-xs font-black disabled:opacity-60 ${
              subscription ? 'bg-[#a3ff12] text-[#061006]' : 'border border-white/20 text-slate-200'
            }`}
          >
            {subscription ? 'ON' : 'OFF'}
          </button>
        )}
      </div>
      {support === 'ios-not-installed' && (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-200">
          iPhoneでは、Safariの共有ボタン →「ホーム画面に追加」で追加したアプリから開くと通知をONにできます。
        </p>
      )}
      {support === 'unsupported' && (
        <p className="mt-2 text-[11px] text-slate-400">このブラウザは通知に対応していません。</p>
      )}
      {support === 'no-key' && (
        <p className="mt-2 text-[11px] text-slate-400">サーバーの通知設定（VAPIDキー）が未設定です。</p>
      )}
      {subscription && (
        <button type="button" onClick={test} disabled={pending} className="mt-2 text-[11px] text-slate-400 underline">
          テスト通知を送る
        </button>
      )}
      {message && <p className="mt-2 text-[11px] text-slate-300">{message}</p>}
    </div>
  );
}
