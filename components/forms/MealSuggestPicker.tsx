'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  getMealSuggestions,
  type MealSuggestion,
} from '@/app/actions/meal';
import { MEAL_TYPE_ICONS, MEAL_TYPE_LABELS, type MealType } from '@/lib/types';

interface Props {
  /** 選択時に呼ばれるコールバック */
  onPick: (s: MealSuggestion) => void;
}

export default function MealSuggestPicker({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MealSuggestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [, startTransition] = useTransition();

  // 開いた時に初回ロード（全件、頻度順）
  useEffect(() => {
    if (open && !loaded) {
      startTransition(async () => {
        const data = await getMealSuggestions('', 50);
        setItems(data);
        setLoaded(true);
      });
    }
  }, [open, loaded]);

  // クエリ変更時に検索
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      startTransition(async () => {
        const data = await getMealSuggestions(query, 50);
        setItems(data);
      });
    }, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  const handlePick = (s: MealSuggestion) => {
    onPick(s);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full h-11 rounded-xl border border-blue-300 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100"
      >
        📚 過去の食事から選ぶ
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-xl pb-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
              <h3 className="text-base font-semibold">過去の食事から選ぶ</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-500 text-2xl leading-none px-2"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            <div className="px-4 pt-3 pb-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="料理名で検索"
                className="w-full h-11 px-4 rounded-xl border border-gray-300 bg-white"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {!loaded ? (
                <p className="text-center text-sm text-gray-500 py-6">
                  読み込み中...
                </p>
              ) : items.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-6">
                  {query
                    ? '一致する食事が見つかりません'
                    : 'まだ料理名つきの記録がありません。\n食事を「料理名」付きで記録すると、ここから再利用できます。'}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {items.map((s) => (
                    <li key={`${s.food_name}-${s.last_used_date}`}>
                      <button
                        type="button"
                        onClick={() => handlePick(s)}
                        className="w-full text-left px-3 py-3 hover:bg-gray-50 active:bg-gray-100 rounded-lg flex items-start gap-3"
                      >
                        <div className="text-2xl leading-none mt-0.5">
                          {s.last_meal_type
                            ? MEAL_TYPE_ICONS[s.last_meal_type as MealType]
                            : '🍽️'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {s.food_name}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            <span className="tabular-nums">
                              {Math.round(s.calories)} kcal / P
                              {Math.round(s.protein_g)} F
                              {Math.round(s.fat_g)} C{Math.round(s.carbs_g)}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {s.uses}回利用 / 最終 {s.last_used_date}
                            {s.last_meal_type
                              ? ' / ' +
                                MEAL_TYPE_LABELS[s.last_meal_type as MealType]
                              : ''}
                          </div>
                        </div>
                        <div className="text-blue-600 text-sm self-center">
                          選択 →
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
