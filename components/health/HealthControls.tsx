'use client';

import { RefreshCw, Unplug } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { disconnectHealthAction, syncHealthAction } from '@/app/actions/health';

export default function HealthControls() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const sync = (days: number) =>
    startTransition(async () => {
      setMessage(null);
      const res = await syncHealthAction(days);
      setMessage('error' in res ? `同期エラー: ${res.error}` : `${res.days}日分を同期しました`);
      router.refresh();
    });

  const disconnect = () => {
    if (!confirm('Google Health との連携を解除しますか？（同期済みのデータは残ります）')) return;
    startTransition(async () => {
      await disconnectHealthAction();
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => sync(7)}
          disabled={pending}
          className="sport-button-primary flex h-11 items-center justify-center gap-2 disabled:opacity-60"
        >
          <RefreshCw size={16} className={pending ? 'animate-spin' : ''} /> 今すぐ同期
        </button>
        <button
          type="button"
          onClick={() => sync(90)}
          disabled={pending}
          className="sport-button-secondary flex h-11 items-center justify-center text-sm disabled:opacity-60"
        >
          過去90日を取り込む
        </button>
      </div>
      <button
        type="button"
        onClick={disconnect}
        disabled={pending}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-rose-400/30 text-xs text-rose-300"
      >
        <Unplug size={14} /> 連携を解除
      </button>
      {message && <p className="text-xs text-slate-300">{message}</p>}
    </div>
  );
}
