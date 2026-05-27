'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteMealAction } from '@/app/actions/meal';
import { MEAL_TYPE_ICONS, MEAL_TYPE_LABELS, type MealLog } from '@/lib/types';

interface Props {
  logs: MealLog[];
}

export default function TodayMealList({ logs }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    if (!confirm('この食事の記録を削除しますか？')) return;
    setPendingId(id);
    startTransition(async () => {
      await deleteMealAction(id);
      setPendingId(null);
      router.refresh();
    });
  };

  return (
    <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
      {logs.map((l) => (
        <li key={l.id} className="p-3 flex items-start gap-3">
          <div className="text-2xl leading-none mt-0.5">
            {l.meal_type ? MEAL_TYPE_ICONS[l.meal_type] : '🍽️'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {l.time && <span className="tabular-nums">{l.time}</span>}
              {l.meal_type && <span>{MEAL_TYPE_LABELS[l.meal_type]}</span>}
            </div>
            {l.food_name && (
              <div className="text-sm font-medium truncate">{l.food_name}</div>
            )}
            <div className="text-sm tabular-nums mt-0.5">
              <span className="font-semibold">
                {Math.round(Number(l.calories))} kcal
              </span>
              <span className="ml-2 font-semibold text-slate-300">
                P{Math.round(Number(l.protein_g))} F
                {Math.round(Number(l.fat_g))} C{Math.round(Number(l.carbs_g))}
              </span>
            </div>
            {l.memo && (
              <div className="text-xs text-gray-600 mt-0.5 truncate">
                {l.memo}
              </div>
            )}
          </div>
          <button
            onClick={() => handleDelete(l.id)}
            disabled={pendingId === l.id}
            className="text-xs text-red-500 hover:text-red-700 disabled:text-gray-400 px-2 py-1 self-start"
            aria-label="削除"
          >
            削除
          </button>
        </li>
      ))}
    </ul>
  );
}
