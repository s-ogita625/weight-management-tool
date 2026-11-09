'use client';

import { CloudOff, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { flushQueue, QUEUE_EVENT, readQueue } from '@/lib/offline-queue';

/**
 * - Service Worker 登録（本番のみ。開発中はキャッシュで古い画面が出るのを避ける）
 * - オフラインで溜めた記録の自動送信と、未送信件数の表示
 */
export default function PwaClient() {
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => {});
    }

    const refreshCount = () => setPending(readQueue().length);
    const tryFlush = async () => {
      setOnline(navigator.onLine);
      const sent = await flushQueue();
      refreshCount();
      if (sent > 0) router.refresh();
    };
    const goOffline = () => setOnline(false);

    tryFlush();
    window.addEventListener('online', tryFlush);
    window.addEventListener('offline', goOffline);
    window.addEventListener(QUEUE_EVENT, refreshCount);
    return () => {
      window.removeEventListener('online', tryFlush);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener(QUEUE_EVENT, refreshCount);
    };
  }, [router]);

  if (online && pending === 0) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500/90 px-4 py-1.5 text-xs font-bold text-black">
      {online ? <RefreshCw size={13} className="animate-spin" /> : <CloudOff size={13} />}
      {online
        ? `未送信の記録 ${pending}件を送信中…`
        : `オフライン${pending > 0 ? `：${pending}件を端末に保存中（電波が戻ると自動送信）` : ''}`}
    </div>
  );
}
