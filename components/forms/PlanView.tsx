'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import ComparisonTable from '@/components/results/ComparisonTable';
import MacroChart from '@/components/results/MacroChart';
import CitationNote from '@/components/results/CitationNote';
import { calculate } from '@/lib/calculations';
import { buildCheatDayPlan } from '@/lib/cheat-day';
import {
  GENDER_LABELS,
  PERIOD_LABELS,
  PRIORITY_LABELS,
  TRAINING_FREQ_LABELS,
  type Period,
  type Profile,
} from '@/lib/types';

interface Props {
  profile: Profile;
}

export default function PlanView({ profile }: Props) {
  const [period, setPeriod] = useState<Period>(profile.target_period);
  // プロフィール設定を初期値にしつつ、UI 側で一時切替可能
  const [leanCutMode, setLeanCutMode] = useState<boolean>(
    profile.lean_cut_mode ?? false,
  );

  const baseInput = {
    heightCm: profile.height_cm,
    weightKg: profile.current_weight_kg,
    bodyFatPct: profile.body_fat_pct,
    age: profile.age,
    gender: profile.gender,
    trainingFreq: profile.training_freq,
    targetWeightKg: profile.target_weight_kg,
    targetBodyFatPct: profile.target_body_fat_pct,
    priority: profile.priority,
  };

  const result = useMemo(
    () =>
      calculate({
        ...baseInput,
        period,
        leanCutMode,
      }),
    // baseInput はプロフィール内の値で構成、profile が変わらない限り変化しない
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, period, leanCutMode],
  );

  // 比較用：常に通常モードの結果も計算
  const normalResult = useMemo(
    () => calculate({ ...baseInput, period, leanCutMode: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, period],
  );

  const recommended =
    result.recommendedFormula === 'katchMcArdle'
      ? result.katchMcArdle
      : result.mifflin;
  const normalRecommended =
    normalResult.recommendedFormula === 'katchMcArdle'
      ? normalResult.katchMcArdle
      : normalResult.mifflin;

  const goalLabel =
    recommended.goal === 'cut'
      ? '減量'
      : recommended.goal === 'bulk'
        ? '増量'
        : '維持';

  const allWarnings = Array.from(
    new Set([...result.mifflin.warnings, ...result.katchMcArdle.warnings]),
  );
  const cheatDayPlan = useMemo(
    () =>
      buildCheatDayPlan({
        ...profile,
        target_period: period,
        lean_cut_mode: leanCutMode,
      }),
    [profile, period, leanCutMode],
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

      {/* リーンカット モード切替 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">
              💪 リーンカットモード
            </div>
            <div className="text-xs text-gray-600 mt-0.5">
              筋肉維持を最優先（タンパク質強化 + 減量ペース 0.5-0.75%/週）
            </div>
            {profile.priority && (
              <div className="text-[10px] text-gray-400 mt-1">
                優先度: {PRIORITY_LABELS[profile.priority]}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setLeanCutMode(!leanCutMode)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              leanCutMode ? 'bg-blue-600' : 'bg-gray-300'
            }`}
            aria-pressed={leanCutMode}
            aria-label="リーンカットモード切替"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                leanCutMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {/* 差分: 通常 cut → リーンカット */}
        {leanCutMode &&
          recommended.goal === 'cut' &&
          normalRecommended.goal === 'cut' && (
            <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-xs">
              <DiffCell
                label="タンパク質"
                normalVal={normalRecommended.protein_g}
                leanVal={recommended.protein_g}
                unit="g"
              />
              <DiffCell
                label="目標kcal"
                normalVal={normalRecommended.targetCalories}
                leanVal={recommended.targetCalories}
                unit="kcal"
              />
              <DiffCell
                label="週次変化"
                normalVal={normalRecommended.weeklyDeltaKg}
                leanVal={recommended.weeklyDeltaKg}
                unit="kg/週"
                decimals={2}
              />
            </div>
          )}
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

      {/* 年4回フリーデイ */}
      <div className="bg-emerald-400/10 rounded-xl border border-emerald-300/25 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{cheatDayPlan.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              誕生日を軸に約3ヶ月間隔で年4回だけ、カロリーやPFCを気にせず好きなものを楽しむ日です。各回は1日のみです。
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              cheatDayPlan.enabled
                ? 'bg-emerald-500 text-black'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {cheatDayPlan.enabled ? 'ON' : 'OFF'}
          </span>
        </div>

        {cheatDayPlan.enabled && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-500">許可日数</div>
                <div className="font-bold">{cheatDayPlan.frequencyLabel}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">次回目安</div>
                <div className="font-bold tabular-nums">
                  {cheatDayPlan.nextDate}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-gray-500">今年の自動配置</div>
                <div className="font-bold tabular-nums">
                  {cheatDayPlan.birthdayWindow}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-gray-500">誕生日当日の扱い</div>
              <div className="mt-1 text-2xl font-black text-[#a3ff12]">
                上限なし
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                対象日は「なんでも食べていい日」として扱います。食事記録は振り返り用に残せますが、達成率や残りPFCの判定には使いません。
              </p>
            </div>
            <ul className="mt-3 list-disc list-inside space-y-1 text-xs leading-relaxed text-gray-600">
              {cheatDayPlan.advice.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}
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

function DiffCell({
  label,
  normalVal,
  leanVal,
  unit,
  decimals = 0,
}: {
  label: string;
  normalVal: number;
  leanVal: number;
  unit: string;
  decimals?: number;
}) {
  const diff = leanVal - normalVal;
  const sign = diff > 0 ? '+' : '';
  const fmt = (n: number) =>
    decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString();
  const diffColor =
    Math.abs(diff) < 0.01
      ? 'text-gray-500'
      : diff > 0
        ? 'text-emerald-600'
        : 'text-rose-600';
  return (
    <div className="bg-gray-50 rounded-lg p-2">
      <div className="text-gray-500">{label}</div>
      <div className="font-semibold tabular-nums">
        {fmt(leanVal)}
        <span className="text-[10px] text-gray-500 ml-1">{unit}</span>
      </div>
      <div className={`text-[10px] tabular-nums ${diffColor}`}>
        {sign}
        {fmt(diff)}
        {unit === 'kcal' || unit === 'g' ? '' : ''}
      </div>
    </div>
  );
}
