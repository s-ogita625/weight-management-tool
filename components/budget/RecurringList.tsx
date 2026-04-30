'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  deleteRecurringAction,
  toggleRecurringActiveAction,
} from '@/app/actions/recurring';
import RecurringForm from '@/components/forms/RecurringForm';
import type { RecurringExpense } from '@/lib/types';

interface Props {
  items: RecurringExpense[];
}

export default function RecurringList({ items }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    if (!confirm('この固定費を削除しますか？')) return;
    setPendingId(id);
    startTransition(async () => {
      await deleteRecurringAction(id);
      setPendingId(null);
      router.refresh();
    });
  };

  const handleToggle = (id: string, isActive: boolean) => {
    setPendingId(id);
    startTransition(async () => {
      await toggleRecurringActiveAction(id, !isActive);
      setPendingId(null);
      router.refresh();
    });
  };

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-6">
        固定費はまだ登録されていません。
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((r) => {
        const editing = editingId === r.id;
        return (
          <li
            key={r.id}
            className={`bg-white rounded-xl border p-4 ${
              r.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'
            }`}
          >
            {editing ? (
              <>
                <div className="text-sm font-semibold text-gray-700 mb-2">
                  編集中
                </div>
                <RecurringForm
                  initial={r}
                  onDone={() => setEditingId(null)}
                />
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="w-full mt-2 h-10 text-sm text-gray-600 underline"
                >
                  キャンセル
                </button>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{r.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                        {r.category}
                      </span>
                      {!r.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">
                          無効
                        </span>
                      )}
                    </div>
                    <div className="text-lg font-bold tabular-nums mt-1">
                      ¥{Number(r.amount).toLocaleString()}
                      <span className="text-xs font-normal text-gray-500 ml-2">
                        毎月{r.billing_day}日
                      </span>
                    </div>
                    {r.purpose && (
                      <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
                        {r.purpose}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      {r.start_month} 〜 {r.end_month ?? '無期限'}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setEditingId(r.id)}
                    className="flex-1 h-9 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggle(r.id, r.is_active)}
                    disabled={pendingId === r.id}
                    className="flex-1 h-9 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:text-gray-400"
                  >
                    {r.is_active ? '無効化' : '有効化'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    disabled={pendingId === r.id}
                    className="flex-1 h-9 text-xs rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 disabled:text-gray-400"
                  >
                    削除
                  </button>
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
