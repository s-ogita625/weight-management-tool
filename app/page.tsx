import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  BarChart3,
  Bot,
  CalendarDays,
  Droplets,
  Dumbbell,
  History,
  MessageCircle,
  Settings,
  TrendingUp,
  Utensils,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { getSessionUserId } from '@/lib/auth';
import { calculate } from '@/lib/calculations';
import { buildCheatDayPlan } from '@/lib/cheat-day';
import { dateInJST } from '@/lib/date';
import { sql } from '@/lib/db';
import { pickFunComparisons } from '@/lib/fun-foods';
import { getWorkoutStats } from '@/lib/workouts';
import type { DailyLog, MealLog, Profile } from '@/lib/types';

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
          <FeatureTile icon={Utensils} label="食事ごと記録" />
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

  // 4 つのデータ取得を並列実行（neon HTTP は 1 SQL = 1 リクエストなので並列化が効く）
  const [
    profileRowsRaw,
    morningRowsRaw,
    mealRowsRaw,
    hydrationRowsRaw,
    workoutStats,
  ] =
    await Promise.all([
      sql`select * from profiles where user_id = ${userId} limit 1`,
      sql`
        select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
               weight_kg, body_fat_pct, sleep_hours, sleep_quality, fatigue, mood, bowel
        from daily_logs
        where user_id = ${userId} and date = ${today}
        limit 1
      `,
      sql`
        select calories, protein_g, fat_g, carbs_g
        from meal_logs
        where user_id = ${userId} and date = ${today}
      `,
      sql`
        select drink_type, amount_ml
        from hydration_logs
        where user_id = ${userId} and date = ${today}
      `,
      getWorkoutStats(userId),
    ]);

  const profileRows = profileRowsRaw as unknown as Profile[];
  if (profileRows.length === 0) redirect('/onboarding');
  const profile = profileRows[0];

  const morningRows = morningRowsRaw as unknown as DailyLog[];
  const morning = morningRows[0] ?? null;

  const mealRows = mealRowsRaw as unknown as MealLog[];
  const hydrationRows = hydrationRowsRaw as unknown as Array<{
    drink_type: string;
    amount_ml: number;
  }>;
  const mealTotal = mealRows.reduce(
    (a, r) => ({
      calories: a.calories + Number(r.calories),
      protein_g: a.protein_g + Number(r.protein_g),
      fat_g: a.fat_g + Number(r.fat_g),
      carbs_g: a.carbs_g + Number(r.carbs_g),
    }),
    { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
  );
  const hydrationTotal = hydrationRows.reduce(
    (sum, row) => sum + Number(row.amount_ml),
    0,
  );
  const waterTotal = hydrationRows
    .filter((row) => row.drink_type === 'water')
    .reduce((sum, row) => sum + Number(row.amount_ml), 0);
  const proteinDrinkTotal = hydrationRows
    .filter((row) => row.drink_type === 'protein')
    .reduce((sum, row) => sum + Number(row.amount_ml), 0);
  const coffeeTotal = hydrationRows
    .filter((row) => row.drink_type === 'coffee')
    .reduce((sum, row) => sum + Number(row.amount_ml), 0);

  // 1日の目標カロリーを算出（リーンカット設定込み）
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
  const dailyPlan =
    calcResult.recommendedFormula === 'katchMcArdle'
      ? calcResult.katchMcArdle
      : calcResult.mifflin;
  const cheatDayPlan = buildCheatDayPlan(profile);
  const isFreeDay = cheatDayPlan.isTodayCheatDay;
  const targetPlan = dailyPlan;
  const remainingKcal = isFreeDay
    ? 0
    : Math.max(0, targetPlan.targetCalories - mealTotal.calories);
  const overKcal = isFreeDay
    ? 0
    : Math.max(0, mealTotal.calories - targetPlan.targetCalories);
  // ホームでは1日固定 seed で1つだけ食材例を表示（軽量）
  const todaySeed =
    new Date().getFullYear() * 10000 +
    (new Date().getMonth() + 1) * 100 +
    new Date().getDate();
  const funExamples = pickFunComparisons(
    overKcal > 0 ? overKcal : remainingKcal,
    1,
    todaySeed,
  );

  return (
    <div className="space-y-5 py-4">
      <div className="sport-card-strong overflow-hidden p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="sport-kicker">Daily dashboard</div>
            <h1 className="mt-1 text-3xl font-black leading-tight">
              今日のサマリー
            </h1>
            <p className="mt-1 text-sm text-slate-300">{today}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-black/25 text-[#a3ff12] ring-1 ring-white/10">
            <Zap size={25} strokeWidth={2.6} />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <HeroMetric label="摂取" value={Math.round(mealTotal.calories).toLocaleString()} unit="kcal" />
          <HeroMetric
            label="目標"
            value={isFreeDay ? 'FREE' : Math.round(targetPlan.targetCalories).toLocaleString()}
            unit={isFreeDay ? 'free day' : 'kcal'}
            tone={isFreeDay ? 'success' : 'neutral'}
          />
          <HeroMetric
            label={isFreeDay ? '今日は' : '残り'}
            value={isFreeDay ? 'ENJOY' : Math.round(overKcal > 0 ? overKcal : remainingKcal).toLocaleString()}
            unit={isFreeDay ? 'no limit' : 'kcal'}
            tone={overKcal > 0 ? 'danger' : 'success'}
          />
        </div>
      </div>

      {/* 朝の記録カード */}
      <ShortcutCard
        href="/morning"
        title={morning ? '朝の記録 ✓' : '朝の記録を入力'}
        icon={Dumbbell}
        tone={morning ? 'success' : 'warning'}
      >
        {morning ? (
          <div className="text-sm text-gray-700 space-y-0.5">
            {morning.weight_kg !== null && (
              <div>
                体重:{' '}
                <span className="font-semibold tabular-nums">
                  {Number(morning.weight_kg).toFixed(1)}kg
                </span>
              </div>
            )}
            {morning.body_fat_pct !== null && (
              <div>
                体脂肪:{' '}
                <span className="font-semibold tabular-nums">
                  {Number(morning.body_fat_pct).toFixed(1)}%
                </span>
              </div>
            )}
            {morning.sleep_hours !== null && (
              <div>
                睡眠:{' '}
                <span className="font-semibold tabular-nums">
                  {Number(morning.sleep_hours).toFixed(1)}h
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-700">
            体重・体脂肪率・コンディションを記録しましょう
          </div>
        )}
      </ShortcutCard>

      {/* 食事サマリー */}
      <ShortcutCard
        href="/log"
        title="食事を記録"
        icon={Utensils}
      >
        <div className="text-sm text-gray-700">
          <div className="text-lg font-bold tabular-nums">
            {Math.round(mealTotal.calories).toLocaleString()} kcal
            <span className="text-xs font-normal text-gray-500 ml-1">
              / {Math.round(targetPlan.targetCalories).toLocaleString()} 目標 ({mealRows.length}件)
            </span>
          </div>
          <div className="text-xs text-gray-600">
            {isFreeDay
              ? `P${Math.round(mealTotal.protein_g)} F${Math.round(mealTotal.fat_g)} C${Math.round(mealTotal.carbs_g)}（今日は目標判定なし）`
              : `P${Math.round(mealTotal.protein_g)}/${Math.round(targetPlan.protein_g)} F${Math.round(mealTotal.fat_g)}/${Math.round(targetPlan.fat_g)} C${Math.round(mealTotal.carbs_g)}/${Math.round(targetPlan.carbs_g)}`}
          </div>
          <div
            className={`mt-1.5 text-xs font-medium ${
              overKcal > 0
                ? 'text-rose-600'
                : remainingKcal < 200
                  ? 'text-amber-600'
                  : 'text-emerald-600'
            }`}
          >
            {isFreeDay
              ? `🎂 ${cheatDayPlan.currentFreeDayLabel ?? 'フリーデイ'}。今日は好きなものを楽しむ日です`
              : overKcal > 0
              ? `🚨 ${Math.round(overKcal)}kcal オーバー`
              : `🔥 残り ${Math.round(remainingKcal)}kcal`}
            {funExamples.length > 0 && remainingKcal > 0 && overKcal === 0 && !isFreeDay && (
              <span className="text-gray-500 font-normal ml-1">
                = {funExamples[0].display}
              </span>
            )}
          </div>
        </div>
      </ShortcutCard>

      <ShortcutCard href="/hydration" title="水分補給を記録" icon={Droplets}>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-gray-500">合計</div>
            <div className="font-semibold tabular-nums text-[#20e0ff]">
              {(hydrationTotal / 1000).toFixed(1)}L
            </div>
          </div>
          <div>
            <div className="text-gray-500">水</div>
            <div className="font-semibold tabular-nums text-[#a3ff12]">
              {waterTotal}ml
            </div>
          </div>
          <div>
            <div className="text-gray-500">コーヒー</div>
            <div className="font-semibold tabular-nums text-amber-200">
              {coffeeTotal}ml
            </div>
          </div>
        </div>
        {proteinDrinkTotal > 0 && (
          <div className="mt-2 text-xs text-slate-400">
            プロテイン飲料 {proteinDrinkTotal}ml も記録済み
          </div>
        )}
      </ShortcutCard>

      <ShortcutCard href="/plan" title={cheatDayPlan.title} icon={Zap}>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-gray-500">次回目安</div>
            <div className="font-semibold tabular-nums text-[#a3ff12]">
              {cheatDayPlan.nextDate ?? '-'}
            </div>
          </div>
          <div>
            <div className="text-gray-500">当日</div>
            <div className="font-semibold tabular-nums text-[#20e0ff]">
              上限なし
            </div>
          </div>
        </div>
      </ShortcutCard>

      {/* 筋トレサマリー */}
      <ShortcutCard
        href="/workout"
        title="筋トレを記録"
        icon={Dumbbell}
      >
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-gray-500">今週</div>
            <div className="font-semibold tabular-nums text-[#a3ff12]">
              {workoutStats.sessionsThisWeek}回
            </div>
          </div>
          <div>
            <div className="text-gray-500">セット</div>
            <div className="font-semibold tabular-nums text-[#20e0ff]">
              {workoutStats.setsThisWeek}set
            </div>
          </div>
          <div>
            <div className="text-gray-500">休息</div>
            <div className="font-semibold tabular-nums text-slate-200">
              {workoutStats.restDays === null ? '-' : `${workoutStats.restDays}日`}
            </div>
          </div>
        </div>
      </ShortcutCard>

      {/* クイックリンク */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-200">
          クイックリンク
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <QuickLink href="/plan" icon={BarChart3} label="食事プラン" />
          <QuickLink href="/calendar" icon={CalendarDays} label="カレンダー" />
          <QuickLink href="/trend" icon={TrendingUp} label="体重推移" />
          <QuickLink href="/workout" icon={Dumbbell} label="筋トレメモ" />
          <QuickLink href="/history" icon={History} label="食事履歴" />
          <QuickLink href="/coach" icon={Bot} label="AIコーチング" />
          <QuickLink href="/chat" icon={MessageCircle} label="AIチャット" />
          <QuickLink href="/onboarding" icon={Settings} label="プロフィール" />
        </div>
      </div>

      <div className="text-xs text-gray-500 text-center">
        現在の目標: {Number(profile.target_weight_kg).toFixed(1)}kg /
        体脂肪{Number(profile.target_body_fat_pct).toFixed(1)}%
      </div>
    </div>
  );
}

function ShortcutCard({
  href,
  title,
  icon: Icon,
  tone = 'neutral',
  children,
}: {
  href: string;
  title: string;
  icon: LucideIcon;
  tone?: 'neutral' | 'success' | 'warning';
  children: React.ReactNode;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-300/35 bg-emerald-400/10'
      : tone === 'warning'
        ? 'border-amber-300/35 bg-amber-400/10'
        : 'border-white/10 bg-white/[0.035]';
  return (
    <Link
      href={href}
      className={`block rounded-lg border p-4 transition active:scale-[0.99] ${toneClass}`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/25 text-[#a3ff12] ring-1 ring-white/10">
            <Icon size={17} />
          </span>
          {title}
        </div>
        <span className="text-[#a3ff12]">→</span>
      </div>
      {children}
    </Link>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="sport-card flex items-center gap-3 p-3 transition hover:border-[#a3ff12]/50 active:scale-[0.99]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#a3ff12]/10 text-[#a3ff12]">
        <Icon size={18} />
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </Link>
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

function HeroMetric({
  label,
  value,
  unit,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  unit: string;
  tone?: 'neutral' | 'success' | 'danger';
}) {
  const color =
    tone === 'success'
      ? 'text-[#a3ff12]'
      : tone === 'danger'
        ? 'text-rose-300'
        : 'text-white';
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-2">
      <div className="text-[10px] font-semibold text-slate-400">{label}</div>
      <div className={`text-base font-black tabular-nums ${color}`}>
        {value}
      </div>
      <div className="text-[10px] text-slate-500">{unit}</div>
    </div>
  );
}
