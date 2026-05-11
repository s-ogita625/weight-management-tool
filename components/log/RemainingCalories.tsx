'use client';

import { useMemo, useState } from 'react';
import { pickFunComparisons } from '@/lib/fun-foods';

interface Props {
  totalCalories: number;
  targetCalories: number;
  totalProtein: number;
  targetProtein: number;
  totalFat: number;
  targetFat: number;
  totalCarbs: number;
  targetCarbs: number;
}

export default function RemainingCalories({
  totalCalories,
  targetCalories,
  totalProtein,
  targetProtein,
  totalFat,
  targetFat,
  totalCarbs,
  targetCarbs,
}: Props) {
  // 「再シャッフル」ボタン用の seed。初期値は1日ごとに固定でハイドレーション一致
  const initialSeed = useMemo(() => {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }, []);
  const [seed, setSeed] = useState<number>(initialSeed);

  const remaining = Math.max(0, targetCalories - totalCalories);
  const over = totalCalories > targetCalories;
  const overAmount = Math.max(0, totalCalories - targetCalories);

  const remP = Math.max(0, targetProtein - totalProtein);
  const remF = Math.max(0, targetFat - totalFat);
  const remC = Math.max(0, targetCarbs - totalCarbs);

  const comparisons = useMemo(
    () => pickFunComparisons(over ? overAmount : remaining, 3, seed),
    [remaining, overAmount, over, seed],
  );

  return (
    <div
      className={`rounded-xl border p-4 ${
        over
          ? 'bg-rose-50 border-rose-200'
          : remaining < 200
            ? 'bg-amber-50 border-amber-200'
            : 'bg-emerald-50 border-emerald-200'
      }`}
    >
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-xs text-gray-600">
          {over ? '🚨 目標オーバー' : '🔥 残り摂取可能カロリー'}
        </div>
        <button
          type="button"
          onClick={() => setSeed(Date.now())}
          className="text-[10px] text-blue-600 hover:underline"
          aria-label="食材例を再シャッフル"
        >
          🎲 シャッフル
        </button>
      </div>
      <div className="text-3xl font-bold tabular-nums">
        {over ? '+' : ''}
        {Math.round(over ? overAmount : remaining).toLocaleString()}
        <span className="text-sm font-normal ml-1">kcal</span>
      </div>

      {/* マクロ別残り */}
      <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
        <div className="bg-white/60 rounded-lg p-2">
          <div className="text-rose-600">P 残り</div>
          <div className="font-semibold tabular-nums">{Math.round(remP)}g</div>
        </div>
        <div className="bg-white/60 rounded-lg p-2">
          <div className="text-amber-600">F 残り</div>
          <div className="font-semibold tabular-nums">{Math.round(remF)}g</div>
        </div>
        <div className="bg-white/60 rounded-lg p-2">
          <div className="text-emerald-600">C 残り</div>
          <div className="font-semibold tabular-nums">{Math.round(remC)}g</div>
        </div>
      </div>

      {/* 面白い食材例 */}
      {comparisons.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/60">
          <div className="text-[10px] text-gray-500 mb-1">
            {over ? 'この量の超過は…' : '残り分でこれくらい食べられる！'}
          </div>
          <ul className="space-y-1 text-sm">
            {comparisons.map((c, i) => (
              <li key={i} className="tabular-nums">
                {c.display}
              </li>
            ))}
          </ul>
        </div>
      )}

      {comparisons.length === 0 && !over && remaining > 0 && (
        <div className="text-[10px] text-gray-500 mt-2">
          残りカロリーが少ないため、軽い間食程度です
        </div>
      )}
    </div>
  );
}
