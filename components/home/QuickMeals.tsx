'use client';

import { Layers, Plus, Search, Trash2, Undo2, Utensils, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { deleteMealAction } from '@/app/actions/meal';
import {
  addMealSetAction,
  deleteMealSetAction,
  quickAddMealAction,
  saveMealSetFromTodayAction,
  undoQuickMealsAction,
  type QuickMealItem,
} from '@/app/actions/quick';
import { nowAt, sendOrQueue } from '@/lib/offline-queue';

export interface MealSetView {
  id: string;
  name: string;
  items: QuickMealItem[];
}

export interface TodayMeal {
  id: string;
  time: string | null;
  food_name: string | null;
  calories: number;
}

interface Props {
  frequent: QuickMealItem[];
  sets: MealSetView[];
  today: TodayMeal[];
  /** 今日2品以上記録していれば、セットとして保存できる */
  canSaveSet: boolean;
  /** ざっくり記録（軽め・普通・多め）の1食分 */
  roughItems: QuickMealItem[];
}

type Toast = { text: string; ids: string[] } | null;

export default function QuickMeals({
  frequent,
  sets,
  today,
  canSaveSet,
  roughItems,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<Toast>(null);
  const [error, setError] = useState<string | null>(null);
  const [manageSets, setManageSets] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  const run = (fn: () => Promise<{ ok: true; ids: string[] } | { error: string }>, label: string) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ('error' in res) {
        setError(res.error);
        return;
      }
      setToast({ text: `${label} を追加しました`, ids: res.ids });
      router.refresh();
    });
  };

  /** 1品の追加（オフラインなら端末に保存） */
  const addItem = (item: QuickMealItem) => {
    setError(null);
    startTransition(async () => {
      const res = await sendOrQueue({ kind: 'meal', item, at: nowAt() }, () =>
        quickAddMealAction(item),
      );
      if (res.status === 'queued') {
        setToast({ text: `${item.food_name} を端末に保存（オフライン）`, ids: [] });
        return;
      }
      if ('error' in res.result) {
        setError(res.result.error);
        return;
      }
      setToast({ text: `${item.food_name} を追加しました`, ids: res.result.ids });
      router.refresh();
    });
  };

  const undo = () => {
    if (!toast) return;
    const ids = toast.ids;
    setToast(null);
    startTransition(async () => {
      await undoQuickMealsAction(ids);
      router.refresh();
    });
  };

  const saveSet = () => {
    const name = window.prompt('セット名', 'いつものメニュー');
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const res = await saveMealSetFromTodayAction(name);
      if ('error' in res) setError(res.error);
      router.refresh();
    });
  };

  const removeSet = (id: string, name: string) => {
    if (!confirm(`セット「${name}」を削除しますか？`)) return;
    startTransition(async () => {
      await deleteMealSetAction(id);
      router.refresh();
    });
  };

  const removeMeal = (id: string) => {
    if (!confirm('この食事の記録を削除しますか？')) return;
    startTransition(async () => {
      await deleteMealAction(id);
      router.refresh();
    });
  };

  return (
    <section className="sport-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/25 text-[#a3ff12] ring-1 ring-white/10">
            <Utensils size={17} />
          </span>
          食事をワンタップ記録
        </div>
      </div>

      {sets.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span className="flex items-center gap-1">
              <Layers size={12} /> セット
            </span>
            <button
              type="button"
              onClick={() => setManageSets((v) => !v)}
              className="text-slate-500 hover:text-slate-300"
            >
              {manageSets ? '完了' : '編集'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {sets.map((set) => {
              const kcal = set.items.reduce((s, i) => s + Number(i.calories), 0);
              return (
                <div key={set.id} className="flex items-stretch">
                  <button
                    type="button"
                    disabled={pending || manageSets}
                    onClick={() => run(() => addMealSetAction(set.id), set.name)}
                    className="rounded-l-lg border border-[#a3ff12]/40 bg-[#a3ff12]/10 px-3 py-2 text-left text-xs font-bold text-white active:scale-[0.98] disabled:opacity-70"
                  >
                    {set.name}
                    <span className="ml-1.5 font-normal tabular-nums text-slate-400">
                      {set.items.length}品 {Math.round(kcal)}kcal
                    </span>
                  </button>
                  {manageSets ? (
                    <button
                      type="button"
                      onClick={() => removeSet(set.id, set.name)}
                      aria-label={`${set.name}を削除`}
                      className="rounded-r-lg border border-l-0 border-rose-400/40 bg-rose-500/10 px-2 text-rose-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <span className="w-1 rounded-r-lg border border-l-0 border-[#a3ff12]/40 bg-[#a3ff12]/10" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {frequent.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {frequent.map((item) => (
            <button
              key={item.food_name}
              type="button"
              disabled={pending}
              onClick={() => addItem(item)}
              className="flex min-h-14 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-2 text-left active:scale-[0.98] active:border-[#a3ff12]/60 disabled:opacity-70"
            >
              <Plus size={14} className="shrink-0 text-[#a3ff12]" />
              <span className="min-w-0">
                <span className="line-clamp-2 text-xs font-semibold leading-snug text-white">
                  {item.food_name}
                </span>
                <span className="text-[10px] tabular-nums text-slate-400">
                  {Math.round(item.calories)}kcal · P{Math.round(item.protein_g)}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          食事を記録すると、よく食べるメニューがここに並びます。
        </p>
      )}

      <div className="mt-3">
        <div className="mb-1.5 text-[11px] font-semibold text-slate-400">
          思い出せないときは ざっくり記録（1食分）
        </div>
        <div className="grid grid-cols-3 gap-2">
          {roughItems.map((item) => (
            <button
              key={item.food_name}
              type="button"
              disabled={pending}
              onClick={() => addItem(item)}
              className="h-12 rounded-lg border border-white/10 bg-white/[0.035] text-xs font-semibold active:scale-[0.98] disabled:opacity-70"
            >
              {item.food_name.replace('ざっくり記録（', '').replace('）', '')}
              <span className="block text-[10px] font-normal tabular-nums text-slate-400">
                約{item.calories}kcal
              </span>
            </button>
          ))}
        </div>
      </div>

      <Link
        href="/log"
        className="mt-2 flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 text-xs font-semibold text-slate-300"
      >
        <Search size={14} /> ほかのメニュー・写真・カロリーとPFCを入力
      </Link>

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

      {today.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[11px] font-semibold text-slate-400">今日の記録</div>
          <ul className="divide-y divide-white/5 rounded-lg border border-white/10">
            {today.map((meal) => (
              <li key={meal.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <span className="w-10 shrink-0 tabular-nums text-slate-500">{meal.time ?? ''}</span>
                <span className="min-w-0 flex-1 truncate text-slate-200">
                  {meal.food_name ?? '（名称なし）'}
                </span>
                <span className="tabular-nums text-slate-300">{Math.round(meal.calories)}</span>
                <button
                  type="button"
                  onClick={() => removeMeal(meal.id)}
                  aria-label="削除"
                  className="p-1 text-slate-500 hover:text-rose-300"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          {canSaveSet && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveSet}
                disabled={pending}
                className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-slate-300"
              >
                <Layers size={12} /> 今日の記録をセット保存
              </button>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className="floating-above-nav fixed inset-x-4 bottom-[88px] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border border-[#a3ff12]/40 bg-[#0b1018] px-4 py-3 text-sm shadow-2xl">
          <span className="min-w-0 truncate">✓ {toast.text}</span>
          {toast.ids.length > 0 && (
          <button
            type="button"
            onClick={undo}
            className="flex shrink-0 items-center gap-1 text-xs font-bold text-[#a3ff12]"
          >
            <Undo2 size={14} /> 取り消す
          </button>
          )}
        </div>
      )}
    </section>
  );
}
