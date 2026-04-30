'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteTransactionAction } from '@/app/actions/transaction';
import type { Transaction } from '@/lib/types';

interface Props {
  items: Transaction[];
}

export default function TransactionList({ items }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    if (!confirm('この記録を削除しますか？')) return;
    setPendingId(id);
    startTransition(async () => {
      await deleteTransactionAction(id);
      setPendingId(null);
      router.refresh();
    });
  };

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-6">
        まだ記録がありません。
      </p>
    );
  }

  return (
    <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
      {items.map((t) => (
        <li key={t.id} className="p-3 flex items-start gap-3">
          <div
            className={`text-sm font-medium px-2 py-0.5 rounded ${
              t.kind === 'income'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            }`}
          >
            {t.kind === 'income' ? '収入' : '支出'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{t.date}</span>
              <span>•</span>
              <span>{t.category}</span>
            </div>
            <div className="text-base tabular-nums font-semibold mt-0.5">
              ¥{Number(t.amount).toLocaleString()}
            </div>
            {t.memo && (
              <div className="text-xs text-gray-600 mt-0.5 truncate">
                {t.memo}
              </div>
            )}
          </div>
          <button
            onClick={() => handleDelete(t.id)}
            disabled={pendingId === t.id}
            className="text-xs text-red-500 hover:text-red-700 disabled:text-gray-400 px-2 self-start"
          >
            削除
          </button>
        </li>
      ))}
    </ul>
  );
}
