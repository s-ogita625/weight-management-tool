'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteMealAction } from '@/app/actions/meal';
import { MEAL_TYPE_ICONS, MEAL_TYPE_LABELS, type MealLog } from '@/lib/types';

interface Props {
  logs: MealLog[];
}

export default function MealHistoryList({ logs }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    if (!confirm('この記録を削除しますか？')) return;
    setPendingId(id);
    startTransition(async () => {
      await deleteMealAction(id);
      setPendingId(null);
      router.refresh();
    });
  };

  if (logs.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">
        まだ記録がありません。
      </p>
    );
  }

  const byDate: Record<string, MealLog[]> = {};
  logs.forEach((l) => {
    (byDate[l.date] ??= []).push(l);
  });

  return (
    <div className="space-y-4">
      {Object.entries(byDate)
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([date, items]) => {
          const total = items.reduce(
            (a, r) => ({
              calories: a.calories + Number(r.calories),
              protein_g: a.protein_g + Number(r.protein_g),
              fat_g: a.fat_g + Number(r.fat_g),
              carbs_g: a.carbs_g + Number(r.carbs_g),
            }),
            { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
          );
          return (
            <div
              key={date}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-b border-gray-200">
                <div className="text-sm font-semibold">{date}</div>
                <div className="text-xs text-gray-600 tabular-nums">
                  合計 {Math.round(total.calories)}kcal / P
                  {Math.round(total.protein_g)} F{Math.round(total.fat_g)} C
                  {Math.round(total.carbs_g)}
                </div>
              </div>
              <ul className="divide-y divide-gray-100">
                {items.map((l) => (
                  <li key={l.id} className="px-3 py-3 flex items-start gap-3">
                    <div className="text-xl leading-none mt-0.5">
                      {l.meal_type ? MEAL_TYPE_ICONS[l.meal_type] : '🍽️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {l.time && (
                          <span className="tabular-nums">{l.time}</span>
                        )}
                        {l.meal_type && (
                          <span>{MEAL_TYPE_LABELS[l.meal_type]}</span>
                        )}
                      </div>
                      {l.food_name && (
                        <div className="text-sm font-medium truncate">
                          {l.food_name}
                        </div>
                      )}
                      <div className="text-sm tabular-nums mt-0.5">
                        <span className="font-semibold">
                          {Math.round(Number(l.calories))} kcal
                        </span>
                        <span className="text-gray-500 ml-2">
                          P{Math.round(Number(l.protein_g))} F
                          {Math.round(Number(l.fat_g))} C
                          {Math.round(Number(l.carbs_g))}
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
                      className="text-xs text-red-500 hover:text-red-700 disabled:text-gray-400 px-2 self-start"
                      aria-label="削除"
                    >
                      削除
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
    </div>
  );
}
