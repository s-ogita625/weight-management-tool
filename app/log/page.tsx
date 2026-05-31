import { redirect } from 'next/navigation';
import { Coffee, Droplets, GlassWater } from 'lucide-react';
import HydrationLogForm from '@/components/forms/HydrationLogForm';
import MealLogForm from '@/components/forms/MealLogForm';
import TodayHydrationList from '@/components/forms/TodayHydrationList';
import TodayMealList from '@/components/forms/TodayMealList';
import RemainingCalories from '@/components/log/RemainingCalories';
import { calculate } from '@/lib/calculations';
import { buildCheatDayPlan, type CheatDayPlan } from '@/lib/cheat-day';
import { getSessionUserId } from '@/lib/auth';
import { dateInJST } from '@/lib/date';
import { sql } from '@/lib/db';
import type { HydrationLog, MealLog, Profile } from '@/lib/types';

// SSR を毎リクエスト実行してキャッシュを使わない
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LogPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  // JST 基準で「今日」を計算（クライアントの dateInJST と一致させる）
  const date = dateInJST();

  const [mealRowsRaw, hydrationRowsRaw, profileRowsRaw] = await Promise.all([
    sql`
      select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
             to_char(time, 'HH24:MI') as time,
             meal_type, food_name,
             calories, protein_g, fat_g, carbs_g, memo, created_at
      from meal_logs
      where user_id = ${userId} and date = ${date}
      order by time asc nulls last, created_at asc
    `,
    sql`
      select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
             to_char(time, 'HH24:MI') as time,
             drink_type, amount_ml, memo, created_at
      from hydration_logs
      where user_id = ${userId} and date = ${date}
      order by time asc nulls last, created_at asc
    `,
    sql`select * from profiles where user_id = ${userId} limit 1`,
  ]);
  const mealRows = mealRowsRaw as unknown as MealLog[];
  const hydrationRows = hydrationRowsRaw as unknown as HydrationLog[];
  const profileRows = profileRowsRaw as unknown as Profile[];

  const total = mealRows.reduce<{
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  }>(
    (a, r) => ({
      calories: a.calories + Number(r.calories),
      protein_g: a.protein_g + Number(r.protein_g),
      fat_g: a.fat_g + Number(r.fat_g),
      carbs_g: a.carbs_g + Number(r.carbs_g),
    }),
    { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
  );
  const hydrationTotal = hydrationRows.reduce(
    (acc, row) => {
      const amount = Number(row.amount_ml);
      acc.total += amount;
      acc[row.drink_type] += amount;
      return acc;
    },
    { total: 0, water: 0, protein: 0, coffee: 0, other: 0 },
  );

  // プロフィールがあれば目標との差分を計算
  let target: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  } | null = null;
  let cheatDayPlan: CheatDayPlan | null = null;
  if (profileRows[0]) {
    const p = profileRows[0];
    const result = calculate({
      heightCm: Number(p.height_cm),
      weightKg: Number(p.current_weight_kg),
      bodyFatPct: Number(p.body_fat_pct),
      age: Number(p.age),
      gender: p.gender,
      trainingFreq: p.training_freq,
      targetWeightKg: Number(p.target_weight_kg),
      targetBodyFatPct: Number(p.target_body_fat_pct),
      period: p.target_period,
      // リーンカット & 優先度をプロフィール設定から反映
      leanCutMode: p.lean_cut_mode,
      priority: p.priority,
    });
    const recommended =
      result.recommendedFormula === 'katchMcArdle'
        ? result.katchMcArdle
        : result.mifflin;
    cheatDayPlan = buildCheatDayPlan(p);
    target = cheatDayPlan.isTodayCheatDay
      ? null
      : {
          calories: recommended.targetCalories,
          protein_g: recommended.protein_g,
          fat_g: recommended.fat_g,
          carbs_g: recommended.carbs_g,
        };
  }

  function pct(actual: number, t: number): number {
    if (t <= 0) return 0;
    return Math.min(Math.round((actual / t) * 100), 999);
  }

  return (
    <div className="py-4 space-y-5">
      <h1 className="text-2xl font-bold">食事を記録</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex justify-between items-baseline mb-1">
          <div className="text-xs text-gray-500">本日の合計</div>
          {target && (
            <div className="text-xs text-gray-500">
              目標: {target.calories.toLocaleString()} kcal
            </div>
          )}
        </div>
        <div className="text-2xl font-bold tabular-nums">
          {Math.round(total.calories).toLocaleString()}
          <span className="text-sm font-normal ml-1">kcal</span>
          {target && (
            <span
              className={`text-sm font-normal ml-2 ${
                pct(total.calories, target.calories) > 110
                  ? 'text-red-600'
                  : pct(total.calories, target.calories) >= 90
                    ? 'text-emerald-600'
                    : 'text-gray-500'
              }`}
            >
              ({pct(total.calories, target.calories)}%)
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
          <MacroCell
            label="P"
            actual={total.protein_g}
            target={target?.protein_g}
            tone="protein"
          />
          <MacroCell
            label="F"
            actual={total.fat_g}
            target={target?.fat_g}
            tone="fat"
          />
          <MacroCell
            label="C"
            actual={total.carbs_g}
            target={target?.carbs_g}
            tone="carbs"
          />
        </div>
        {cheatDayPlan?.isTodayCheatDay && (
          <div className="mt-3 rounded-xl border border-[#a3ff12]/30 bg-[#a3ff12]/10 px-3 py-2 text-xs font-semibold text-[#a3ff12]">
            今日は{cheatDayPlan.currentFreeDayLabel ?? 'フリーデイ'}です。残りカロリーやPFC達成率は気にせず、食べたいものを楽しんでください。
          </div>
        )}
      </div>

      {/* 残りカロリー + 面白い食材換算 */}
      {target && (
        <RemainingCalories
          totalCalories={total.calories}
          targetCalories={target.calories}
          totalProtein={total.protein_g}
          targetProtein={target.protein_g}
          totalFat={total.fat_g}
          targetFat={target.fat_g}
          totalCarbs={total.carbs_g}
          targetCarbs={target.carbs_g}
        />
      )}

      {mealRows.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            本日の記録 ({mealRows.length}件)
          </h2>
          <TodayMealList logs={mealRows} />
        </div>
      )}

      <HydrationSummary total={hydrationTotal} count={hydrationRows.length} />

      <HydrationLogForm />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-200">
          本日の水分記録 ({hydrationRows.length}件)
        </h2>
        <TodayHydrationList logs={hydrationRows} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          新しい食事を追加
        </h2>
        <MealLogForm />
      </div>
    </div>
  );
}

function HydrationSummary({
  total,
  count,
}: {
  total: {
    total: number;
    water: number;
    protein: number;
    coffee: number;
    other: number;
  };
  count: number;
}) {
  return (
    <section className="sport-card-strong p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="sport-kicker">Today hydration</div>
          <h2 className="mt-1 text-lg font-black">本日の水分補給</h2>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/25 text-[#20e0ff] ring-1 ring-white/10">
          <Droplets size={21} />
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-4xl font-black tabular-nums text-white">
            {(total.total / 1000).toFixed(1)}
            <span className="ml-1 text-base text-slate-400">L</span>
          </div>
          <div className="text-xs font-semibold text-slate-400">
            {total.total.toLocaleString()}ml / {count}件
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-right">
          <div className="text-[10px] font-semibold text-slate-500">
            カフェイン系
          </div>
          <div className="text-sm font-black tabular-nums text-amber-200">
            {total.coffee.toLocaleString()}ml
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <HydrationMiniMetric
          icon={Droplets}
          label="水"
          value={`${total.water.toLocaleString()}ml`}
          tone="water"
        />
        <HydrationMiniMetric
          icon={GlassWater}
          label="プロテイン"
          value={`${total.protein.toLocaleString()}ml`}
          tone="protein"
        />
        <HydrationMiniMetric
          icon={Coffee}
          label="その他"
          value={`${(total.coffee + total.other).toLocaleString()}ml`}
          tone="other"
        />
      </div>
    </section>
  );
}

function HydrationMiniMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Droplets;
  label: string;
  value: string;
  tone: 'water' | 'protein' | 'other';
}) {
  const toneClass =
    tone === 'water'
      ? 'text-[#7af7ff]'
      : tone === 'protein'
        ? 'text-[#a3ff12]'
        : 'text-amber-200';
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-2">
      <Icon size={16} className={toneClass} />
      <div className="mt-1 text-[10px] font-semibold text-slate-500">
        {label}
      </div>
      <div className={`text-sm font-black tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function MacroCell({
  label,
  actual,
  target,
  tone,
}: {
  label: string;
  actual: number;
  target?: number;
  tone: 'protein' | 'fat' | 'carbs';
}) {
  const toneClass =
    tone === 'protein'
      ? 'text-rose-200 border-rose-300/25'
      : tone === 'fat'
        ? 'text-amber-200 border-amber-300/25'
        : 'text-[#a3ff12] border-[#a3ff12]/25';

  return (
    <div className={`rounded-lg border bg-black/30 p-2 ${toneClass}`}>
      <div className="font-black">{label}</div>
      <div className="font-black tabular-nums text-white">
        {Math.round(actual)}g
        {target && (
          <span className="font-semibold text-slate-300">
            /{Math.round(target)}
          </span>
        )}
      </div>
    </div>
  );
}
