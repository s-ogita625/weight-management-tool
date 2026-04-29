'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import ComparisonTable from '@/components/results/ComparisonTable';
import MacroChart from '@/components/results/MacroChart';
import CitationNote from '@/components/results/CitationNote';
import { calculate } from '@/lib/calculations';
import {
  GENDER_LABELS,
  PERIOD_LABELS,
  TRAINING_FREQ_LABELS,
  type Period,
  type Profile,
} from '@/lib/types';

interface Props {
  profile: Profile;
}

export default function PlanView({ profile }: Props) {
  const [period, setPeriod] = useState<Period>(profile.target_period);

  const result = useMemo(
    () =>
      calculate({
        heightCm: profile.height_cm,
        weightKg: profile.current_weight_kg,
        bodyFatPct: profile.body_fat_pct,
        age: profile.age,
        gender: profile.gender,
        trainingFreq: profile.training_freq,
        targetWeightKg: profile.target_weight_kg,
        targetBodyFatPct: profile.target_body_fat_pct,
        period,
      }),
    [profile, period],
  );

  const recommended =
    result.recommendedFormula === 'katchMcArdle'
      ? result.katchMcArdle
      : result.mifflin;

  const goalLabel =
    recommended.goal === 'cut'
      ? '減量'
      : recommended.goal === 'bulk'
        ? '増量'
        : '維持';

  const allWarnings = Array.from(
    new Set([...result.mifflin.warnings, ...result.katchMcArdle.warnings]),
  );

  return (
    <div className="space-y-6 py-4">
      {/* 基本情報サマリ */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">あなたの情報</h2>
          <Link href="/onboarding" className="text-xs text-blue-600 underline">
            編集
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-y-1 text-sm text-gray-600">
          <div>性別：{GENDER_LABELS[profile.gender]}</div>
          <div>年齢：{profile.age}歳</div>
          <div>身長：{profile.height_cm}cm</div>
          <div>体重：{profile.current_weight_kg}kg</div>
          <div>体脂肪：{profile.body_fat_pct}%</div>
          <div>除脂肪：{result.lbmKg}kg</div>
          <div className="col-span-2">
            筋トレ：{TRAINING_FREQ_LABELS[profile.training_freq]}
          </div>
          <div className="col-span-2">
            目標：{profile.target_weight_kg}kg / 体脂肪{profile.target_body_fat_pct}%
          </div>
        </div>
      </div>

      {/* 期間セレクター */}
      <div>
        <label className="block text-sm font-medium mb-2">期間を選択</label>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`h-11 rounded-xl border text-sm font-medium ${
                period === p
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* ハイライト：推奨値 */}
      <div className="bg-blue-600 text-white rounded-xl p-5 shadow-sm">
        <div className="text-xs opacity-80">推奨プラン（{goalLabel}）</div>
        <div className="text-3xl font-bold tabular-nums mt-1">
          {recommended.targetCalories.toLocaleString()}
          <span className="text-base font-normal ml-1">kcal/日</span>
        </div>
        <div className="text-sm opacity-90 mt-1">
          週次変化：{recommended.weeklyDeltaKg > 0 ? '+' : ''}
          {recommended.weeklyDeltaKg}kg/週
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div className="bg-white/15 rounded-lg p-2">
            <div className="text-xs opacity-80">タンパク質</div>
            <div className="font-semibold tabular-nums">
              {recommended.protein_g}g
            </div>
          </div>
          <div className="bg-white/15 rounded-lg p-2">
            <div className="text-xs opacity-80">脂質</div>
            <div className="font-semibold tabular-nums">{recommended.fat_g}g</div>
          </div>
          <div className="bg-white/15 rounded-lg p-2">
            <div className="text-xs opacity-80">炭水化物</div>
            <div className="font-semibold tabular-nums">
              {recommended.carbs_g}g
            </div>
          </div>
        </div>
      </div>

      {/* マクロ比率 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold mb-3">マクロ栄養素の比率</h2>
        <MacroChart result={recommended} />
      </div>

      {/* 警告 */}
      {allWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          <div className="font-semibold mb-2">⚠️ 注意事項</div>
          <ul className="list-disc list-inside space-y-1">
            {allWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 比較表 */}
      <div>
        <h2 className="font-semibold mb-3">2つの計算式の比較</h2>
        <ComparisonTable result={result} />
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          {result.recommendedNote}
        </p>
      </div>

      {/* 引用 */}
      <CitationNote />

      {/* 免責 */}
      <p className="text-xs text-gray-400 leading-relaxed">
        ※ 本ツールが提供する数値は参考情報であり、医療・栄養指導の代替ではありません。
        基礎疾患のある方、妊娠中の方、未成年の方は医師・管理栄養士にご相談ください。
      </p>

      <div className="pt-2">
        <Link
          href="/log"
          className="block w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center"
        >
          食事を記録する →
        </Link>
      </div>
    </div>
  );
}
