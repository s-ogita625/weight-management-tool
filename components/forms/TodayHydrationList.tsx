'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteHydrationAction } from '@/app/actions/hydration';
import {
  HYDRATION_DRINK_ICONS,
  HYDRATION_DRINK_LABELS,
  type HydrationLog,
} from '@/lib/types';

interface Props {
  logs: HydrationLog[];
}

export default function TodayHydrationList({ logs }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    if (!confirm('この水分記録を削除しますか？')) return;
    setPendingId(id);
    startTransition(async () => {
      await deleteHydrationAction(id);
      setPendingId(null);
      router.refresh();
    });
  };

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 bg-black/20 p-3 text-sm text-slate-400">
        まだ水分補給の記録はありません。
      </div>
    );
  }

  return (
    <ul className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10 bg-black/20">
      {logs.map((log) => (
        <li key={log.id} className="flex items-center gap-3 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#20e0ff]/25 bg-[#20e0ff]/10 text-[11px] font-black text-[#7af7ff]">
            {HYDRATION_DRINK_ICONS[log.drink_type]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-black text-white">
                {HYDRATION_DRINK_LABELS[log.drink_type]}
              </span>
              <span className="text-sm font-bold tabular-nums text-[#a3ff12]">
                {Number(log.amount_ml).toLocaleString()}ml
              </span>
              {log.time && (
                <span className="text-xs tabular-nums text-slate-500">
                  {log.time}
                </span>
              )}
            </div>
            {log.memo && (
              <div className="mt-0.5 truncate text-xs text-slate-400">
                {log.memo}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleDelete(log.id)}
            disabled={pendingId === log.id}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-400/20 bg-rose-500/10 text-rose-300 disabled:opacity-45"
            aria-label="削除"
          >
            <Trash2 size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}

