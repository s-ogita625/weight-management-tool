import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  BarChart3,
  Bot,
  Dumbbell,
  TrendingUp,
  Utensils,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import QuickMeals, { type MealSetView, type TodayMeal } from '@/components/home/QuickMeals';
import WaterQuick from '@/components/home/WaterQuick';
import WeightQuickCard from '@/components/home/WeightQuickCard';
import WeightTrendMini, { type WeightPoint } from '@/components/home/WeightTrendMini';
import WorkoutQuick, { type WorkoutTemplateView } from '@/components/home/WorkoutQuick';
import type { QuickMealItem } from '@/app/actions/quick';
import { getSessionUserId } from '@/lib/auth';
import { GoalCheckCard, InsightList, WeeklyReportCard } from '@/components/home/InsightsPanel';
import { calculate, PERIOD_WEEKS } from '@/lib/calculations';
import {
  findRecentPRs,
  buildBodyPartBalance,
  buildExerciseHistories,
} from '@/lib/workout-analysis';
import {
  goalCheck,
  plateauInsight,
  refeedRecoveryInsight,
  reminderInsight,
  weeklyReport,
  workoutInsights,
  type DayCondition,
  type Insight,
  type MealDay,
} from '@/lib/insights';
import { buildCheatDayPlan } from '@/lib/cheat-day';
import { dateInJST, timeInJST } from '@/lib/date';
import { sql } from '@/lib/db';
import { pickFunComparisons } from '@/lib/fun-foods';
import { inferMealType } from '@/lib/meal-time';
import { addDays, daysBetween } from '@/lib/stats';
import { buildSplitTemplates } from '@/lib/workout-templates';
import { getWorkoutSessions, getWorkoutStats } from '@/lib/workouts';
import type { DailyLog, MealType, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const userId = await getSessionUserId();

  if (!userId) {
    return (
      <div className="py-8">
        <div className="sport-card-strong p-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#a3ff12] text-[#061006]">
            <Dumbbell size={24} strokeWidth={2.6} />
          </div>
          <div className="sport-kicker">Body recomposition tracker</div>
          <h1 className="mt-2 text-3xl font-black leading-tight md:text-4xl">
            体重管理ツール
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            身体データと目標から、食事プラン、PFC、体重推移、筋トレ記録、AIコーチングまでまとめて管理します。
          </p>
        </div>

        <div className="my-6 grid grid-cols-2 gap-2">
          <FeatureTile icon={BarChart3} label="科学的PFC" />
          <FeatureTile icon={Utensils} label="ワンタップ食事記録" />
          <FeatureTile icon={TrendingUp} label="体重推移" />
          <FeatureTile icon={Bot} label="AIコーチ" />
          <FeatureTile icon={Dumbbell} label="筋トレ記録" />
          <FeatureTile icon={Zap} label="リーンカット" />
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/signup"
            className="sport-button-primary flex h-12 items-center justify-center"
          >
            新規登録ではじめる
          </Link>
          <Link
            href="/login"
            className="sport-button-secondary flex h-12 items-center justify-center font-semibold"
          >
            ログイン
          </Link>
        </div>
      </div>
    );
  }

  const today = dateInJST();
  const currentMealType = inferMealType(timeInJST());

  const [
    profileRowsRaw,
    weightRowsRaw,
    todayLogRaw,
    mealRowsRaw,
    hydrationRowsRaw,
    frequentRaw,
    setsRaw,
    workoutStats,
    workoutSessions,
    conditionsRaw,
    mealDaysRaw,
  ] = await Promise.all([
    sql`select * from profiles where user_id = ${userId} limit 1`,
    sql`
      select to_char(date, 'YYYY-MM-DD') as date, weight_kg::float as weight
      from daily_logs
      where user_id = ${userId} and weight_kg is not null
      order by date desc
      limit 60
    `,
    sql`
      select to_char(date, 'YYYY-MM-DD') as date, weight_kg, sleep_hours, sleep_quality, fatigue, mood
      from daily_logs
      where user_id = ${userId} and date = ${today}
      limit 1
    `,
    sql`
      select id, to_char(time, 'HH24:MI') as time, meal_type, food_name,
             calories::float as calories, protein_g::float as protein_g,
             fat_g::float as fat_g, carbs_g::float as carbs_g
      from meal_logs
      where user_id = ${userId} and date = ${today}
      order by time nulls last, created_at
    `,
    sql`
      select coalesce(sum(amount_ml), 0)::int as total
      from hydration_logs
      where user_id = ${userId} and date = ${today}
    `,
    // よく食べるメニュー：回数 + 今の時間帯（朝食など）での回数を重み付けして並べる
    sql`
      with base as (
        select food_name, meal_type, calories, protein_g, fat_g, carbs_g, date, created_at
        from meal_logs
        where user_id = ${userId} and food_name is not null and food_name <> ''
          and food_name not like 'ざっくり記録%'
      ),
      latest as (
        select distinct on (food_name)
          food_name, calories::float as calories, protein_g::float as protein_g,
          fat_g::float as fat_g, carbs_g::float as carbs_g
        from base
        order by food_name, date desc, created_at desc
      ),
      agg as (
        select food_name,
               count(*)::int as uses,
               count(*) filter (where meal_type = ${currentMealType})::int as type_uses,
               max(date) as last_date
        from base
        group by food_name
      )
      select l.*
      from latest l join agg a using (food_name)
      order by (a.uses + a.type_uses * 3) desc, a.last_date desc
      limit 10
    `,
    sql`
      select id, name, meal_type, items
      from meal_sets
      where user_id = ${userId}
      order by (meal_type = ${currentMealType}) desc nulls last, created_at
    `.catch(() => []), // マイグレーション未適用でもホームは表示する
    getWorkoutStats(userId),
    getWorkoutSessions(userId, 60),
    sql`
      select to_char(date, 'YYYY-MM-DD') as date, weight_kg::float as weight,
             sleep_hours::float as sleep_hours, mood, fatigue
      from daily_logs
      where user_id = ${userId}
      order by date desc
      limit 120
    `,
    sql`
      select to_char(date, 'YYYY-MM-DD') as date,
             sum(calories)::float as kcal, sum(protein_g)::float as protein,
             count(*)::int as entries
      from meal_logs
      where user_id = ${userId} and date >= ${addDays(today, -14)}
      group by date
    `,
  ]);

  const profileRows = profileRowsRaw as unknown as Profile[];
  if (profileRows.length === 0) redirect('/onboarding');
  const profile = profileRows[0];

  // ---------- 体重 ----------
  const weightsDesc = weightRowsRaw as unknown as Array<{ date: string; weight: number }>;
  const weights = [...weightsDesc].reverse();
  // カレンダー上の7日間（記録がある日だけ）で移動平均を出す
  const points: WeightPoint[] = weights.map((w) => {
    const from = addDays(w.date, -6);
    const window = weights.filter((x) => x.date >= from && x.date <= w.date);
    const ma = window.reduce((s, x) => s + x.weight, 0) / window.length;
    return { date: w.date, weight: w.weight, ma7: Math.round(ma * 100) / 100 };
  });
  const latestPoint = points.at(-1) ?? null;
  // 1週間前の比較対象は 7〜10日前の記録に限る（記録が空いた後の再開時に古いデータと比べない）
  const weekAgoPoint = latestPoint
    ? [...points]
        .reverse()
        .find(
          (p) =>
            p.date <= addDays(latestPoint.date, -7) &&
            p.date >= addDays(latestPoint.date, -10),
        ) ?? null
    : null;
  // グラフは直近60日分だけ（長いブランクで横軸が潰れないように）
  const chartPoints = latestPoint
    ? points.filter((p) => p.date >= addDays(latestPoint.date, -60))
    : [];
  const ma7WeeklyDelta =
    latestPoint && weekAgoPoint
      ? Math.round((latestPoint.ma7 - weekAgoPoint.ma7) * 10) / 10
      : null;

  const todayLog = (todayLogRaw as unknown as DailyLog[])[0] ?? null;
  const todayWeight =
    todayLog?.weight_kg !== null && todayLog?.weight_kg !== undefined
      ? Number(todayLog.weight_kg)
      : null;
  const hasCondition = Boolean(
    todayLog &&
      (todayLog.sleep_hours !== null ||
        todayLog.sleep_quality !== null ||
        todayLog.fatigue !== null ||
        todayLog.mood !== null),
  );
  const lastLogDate = weightsDesc[0]?.date ?? null;
  const daysSinceLastLog = lastLogDate ? daysBetween(lastLogDate, today) : null;

  // ---------- 食事 ----------
  const meals = mealRowsRaw as unknown as Array<
    TodayMeal & { protein_g: number; fat_g: number; carbs_g: number }
  >;
  const mealTotal = meals.reduce(
    (a, r) => ({
      calories: a.calories + Number(r.calories),
      protein_g: a.protein_g + Number(r.protein_g),
      fat_g: a.fat_g + Number(r.fat_g),
      carbs_g: a.carbs_g + Number(r.carbs_g),
    }),
    { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
  );
  const typeCounts = new Map<MealType, number>();
  for (const m of meals) {
    if (m.meal_type && m.food_name) {
      typeCounts.set(m.meal_type, (typeCounts.get(m.meal_type) ?? 0) + 1);
    }
  }
  const savableTypes = [...typeCounts.entries()]
    .filter(([, n]) => n >= 2)
    .map(([t]) => t);

  const calcResult = calculate({
    heightCm: Number(profile.height_cm),
    weightKg: Number(profile.current_weight_kg),
    bodyFatPct: Number(profile.body_fat_pct),
    age: Number(profile.age),
    gender: profile.gender,
    trainingFreq: profile.training_freq,
    targetWeightKg: Number(profile.target_weight_kg),
    targetBodyFatPct: Number(profile.target_body_fat_pct),
    period: profile.target_period,
    leanCutMode: profile.lean_cut_mode,
    priority: profile.priority,
  });
  const basePlan =
    calcResult.recommendedFormula === 'katchMcArdle'
      ? calcResult.katchMcArdle
      : calcResult.mifflin;
  // D2: トレ日は炭水化物を +25g（+100kcal）、休養日は -38g（-150kcal）
  const isTrainingDay = workoutSessions.some((s) => s.date === today);
  const dayAdjustKcal = isTrainingDay ? 100 : -150;
  const plan = {
    ...basePlan,
    targetCalories: basePlan.targetCalories + dayAdjustKcal,
    carbs_g: Math.max(0, basePlan.carbs_g + dayAdjustKcal / 4),
  };
  const roughItems: QuickMealItem[] = (
    [
      ['軽め', 0.2],
      ['普通', 0.3],
      ['多め', 0.45],
    ] as const
  ).map(([label, ratio]) => ({
    food_name: `ざっくり記録（${label}）`,
    calories: Math.round(plan.targetCalories * ratio),
    protein_g: Math.round(plan.protein_g * ratio),
    fat_g: Math.round(plan.fat_g * ratio),
    carbs_g: Math.round(plan.carbs_g * ratio),
  }));
  const cheatDayPlan = buildCheatDayPlan(profile);
  const isFreeDay = cheatDayPlan.isTodayCheatDay;
  const remainingKcal = Math.max(0, plan.targetCalories - mealTotal.calories);
  const overKcal = Math.max(0, mealTotal.calories - plan.targetCalories);
  const funExample = pickFunComparisons(
    overKcal > 0 ? overKcal : remainingKcal,
    1,
    Number(today.replaceAll('-', '')),
  )[0];

  // ---------- 筋トレ ----------
  const templates: WorkoutTemplateView[] = buildSplitTemplates(workoutSessions)
    .slice(0, 4)
    .map((t) => ({
      key: t.key,
      label: t.label,
      sessionId: t.session.id,
      date: t.session.date,
      exerciseCount: t.session.exercises.length,
      setCount: t.session.totalSets,
      daysAgo: daysBetween(t.session.date, today),
    }));
  const todaySessions = buildSplitTemplates(
    workoutSessions.filter((s) => s.date === today),
  ).map((t) => ({ label: t.label, setCount: t.session.totalSets }));

  // ---------- 気づき・レポート ----------
  const conditions = (conditionsRaw as unknown as DayCondition[]).reverse();
  const mealDays = mealDaysRaw as unknown as MealDay[];
  const histories = buildExerciseHistories(workoutSessions);
  const balance = buildBodyPartBalance(workoutSessions, today);
  const recentWorkout = workoutSessions.some((s) => s.date >= addDays(today, -14));
  const insights: Insight[] = [
    reminderInsight(timeInJST(), todayWeight !== null, meals.length),
    plateauInsight(weights, today, Number(profile.target_weight_kg), basePlan.targetCalories),
    refeedRecoveryInsight(weights, mealDays, today, basePlan.targetCalories, cheatDayPlan.freeDayDates),
    ...workoutInsights(findRecentPRs(histories, addDays(today, -7)), balance, today, recentWorkout),
  ].filter((i): i is Insight => i !== null);
  const goal = goalCheck(
    weights,
    today,
    Number(profile.target_weight_kg),
    PERIOD_WEEKS[profile.target_period],
  );
  const report = weeklyReport(
    weights,
    conditions,
    mealDays,
    workoutSessions.map((s) => s.date),
    today,
    basePlan.targetCalories,
    basePlan.protein_g,
  );
  const showReport = report.weightDays + report.mealDays + report.workouts > 0;

  const hydrationTotal = Number(
    (hydrationRowsRaw as unknown as Array<{ total: number }>)[0]?.total ?? 0,
  );

  return (
    <div className="space-y-4 py-4">
      {/* ヘッダー：今日のカロリー */}
      <div className="sport-card-strong p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="sport-kicker">Today</div>
            <h1 className="text-xl font-black">{formatJaDate(today)}</h1>
          </div>
          <Link href="/plan" className="text-xs text-slate-400 underline-offset-2 hover:underline">
            目標 {Number(profile.target_weight_kg).toFixed(1)}kg / {Number(profile.target_body_fat_pct).toFixed(0)}%
          </Link>
        </div>

        {isFreeDay ? (
          <div className="mt-3 rounded-lg bg-[#a3ff12]/10 px-3 py-2 text-sm font-bold text-[#a3ff12]">
            🎂 {cheatDayPlan.currentFreeDayLabel ?? 'フリーデイ'}：今日は好きなものを楽しむ日です
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-[11px] text-slate-400">
                  {overKcal > 0 ? 'オーバー' : '残り'}
                </div>
                <div
                  className={`text-4xl font-black tabular-nums ${
                    overKcal > 0 ? 'text-rose-300' : 'text-[#a3ff12]'
                  }`}
                >
                  {Math.round(overKcal > 0 ? overKcal : remainingKcal).toLocaleString()}
                  <span className="ml-1 text-sm font-semibold text-slate-400">kcal</span>
                </div>
                {funExample && (
                  <div className="text-[11px] text-slate-500">≒ {funExample.display}</div>
                )}
              </div>
              <div className="text-right text-xs tabular-nums text-slate-400">
                {Math.round(mealTotal.calories).toLocaleString()} /{' '}
                {Math.round(plan.targetCalories).toLocaleString()} kcal
              </div>
            </div>
            <ProgressBar value={mealTotal.calories} max={plan.targetCalories} />
            <div className="mt-2 text-[10px] text-slate-500">
              {isTrainingDay ? '💪 トレ日：炭水化物 +25g（+100kcal）' : '🛌 休養日：炭水化物 -38g（-150kcal）。筋トレを記録するとトレ日の目標に切り替わります'}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Macro label="P" value={mealTotal.protein_g} target={plan.protein_g} color="#a3ff12" />
              <Macro label="F" value={mealTotal.fat_g} target={plan.fat_g} color="#fbbf24" />
              <Macro label="C" value={mealTotal.carbs_g} target={plan.carbs_g} color="#20e0ff" />
            </div>
          </>
        )}
      </div>

      {daysSinceLastLog !== null && daysSinceLastLog > 3 && todayWeight === null && (
        <div className="rounded-lg border border-amber-300/35 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          前回の記録から <b>{daysSinceLastLog}日</b> 空いています。まずは体重だけでもOK、今日から再開しましょう。
        </div>
      )}

      <InsightList insights={insights} />

      <WeightQuickCard
        todayWeight={todayWeight}
        lastWeight={weightsDesc[0]?.weight ?? Number(profile.current_weight_kg)}
        hasCondition={hasCondition}
        recentlyLogged={daysSinceLastLog !== null && daysSinceLastLog <= 7}
        ma7={latestPoint?.ma7 ?? null}
        ma7WeeklyDelta={ma7WeeklyDelta}
      />

      <WeightTrendMini
        points={chartPoints}
        targetWeight={Number(profile.target_weight_kg)}
      />

      <QuickMeals
        frequent={frequentRaw as unknown as QuickMealItem[]}
        sets={setsRaw as unknown as MealSetView[]}
        today={meals}
        currentMealType={currentMealType}
        savableTypes={savableTypes}
        roughItems={roughItems}
      />

      <WaterQuick totalMl={hydrationTotal} />

      <WorkoutQuick
        templates={templates}
        todaySessions={todaySessions}
        sessionsThisWeek={workoutStats.sessionsThisWeek}
      />

      {goal && <GoalCheckCard goal={goal} />}

      {showReport && <WeeklyReportCard report={report} />}

      {!isFreeDay && cheatDayPlan.nextDate && (
        <Link
          href="/calendar"
          className="block text-center text-xs text-slate-500 underline-offset-2 hover:underline"
        >
          次のフリーデイ：{cheatDayPlan.nextDate}
        </Link>
      )}
    </div>
  );
}

function formatJaDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getUTCDay()];
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${w}）`;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = value > max;
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full ${over ? 'bg-rose-400' : 'bg-[#a3ff12]'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Macro({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px] tabular-nums">
        <span className="font-bold" style={{ color }}>
          {label}
        </span>
        <span className="text-slate-400">
          {Math.round(value)}/{Math.round(target)}g
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function FeatureTile({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="sport-card flex items-center gap-2 p-3">
      <Icon size={17} className="text-[#a3ff12]" />
      <span className="text-xs font-semibold text-slate-200">{label}</span>
    </div>
  );
}
