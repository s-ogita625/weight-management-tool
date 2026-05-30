import { calculate, type FormulaResult } from './calculations';
import type { CheatDayFrequency, Profile } from './types';

export interface CheatDayPlan {
  enabled: boolean;
  goal: FormulaResult['goal'];
  frequency: CheatDayFrequency;
  frequencyLabel: string;
  intervalDays: number | null;
  nextDate: string | null;
  birthdayDate: string | null;
  birthdayWindow: string | null;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  title: string;
  advice: string[];
  isTodayCheatDay: boolean;
}

function round(v: number): number {
  return Math.round(v);
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseBirthday(mmdd?: string): { month: number; day: number } {
  const match = /^(\d{2})-(\d{2})$/.exec(mmdd ?? '');
  const month = match ? Number(match[1]) : 6;
  const day = match ? Number(match[2]) : 25;
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { month: 6, day: 25 };
  }
  return { month, day };
}

function nextBirthday(mmdd: string | undefined, today: Date): Date {
  const { month, day } = parseBirthday(mmdd);
  const candidate = new Date(today.getFullYear(), month - 1, day);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (candidate < todayDate) candidate.setFullYear(candidate.getFullYear() + 1);
  return candidate;
}

function nextCycleDate(anchor: Date, today: Date, intervalDays: number): Date {
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const next = new Date(anchor);
  while (next < todayDate) next.setDate(next.getDate() + intervalDays);
  while (next > todayDate) {
    const previous = addDays(next, -intervalDays);
    if (previous < todayDate) break;
    next.setTime(previous.getTime());
  }
  return next;
}

function resolveFrequency(
  profile: Profile,
  goal: FormulaResult['goal'],
  weeklyDeltaKg: number,
): { frequency: CheatDayFrequency; intervalDays: number | null; label: string } {
  const selected = profile.cheat_day_frequency ?? 'auto';
  const bodyFatLean =
    profile.gender === 'male'
      ? Number(profile.body_fat_pct) <= 15
      : Number(profile.body_fat_pct) <= 23;
  const hardTraining =
    profile.training_freq === '3-4' || profile.training_freq === '5+';
  const deficitRate = Math.abs(weeklyDeltaKg) / Number(profile.current_weight_kg);

  const automatic: CheatDayFrequency =
    goal !== 'cut'
      ? 'event_only'
      : bodyFatLean || hardTraining || deficitRate >= 0.0075
        ? 'weekly'
        : 'biweekly';

  const frequency = selected === 'auto' ? automatic : selected;
  const intervalDays =
    frequency === 'weekly'
      ? 7
      : frequency === 'biweekly'
        ? 14
        : frequency === 'monthly'
          ? 28
          : null;
  const label =
    selected === 'auto'
      ? `自動: ${
          frequency === 'weekly'
            ? '週1回'
            : frequency === 'biweekly'
              ? '2週間に1回'
              : frequency === 'monthly'
                ? '月1回'
                : 'イベント時のみ'
        }`
      : frequency === 'weekly'
        ? '週1回'
        : frequency === 'biweekly'
          ? '2週間に1回'
          : frequency === 'monthly'
            ? '月1回'
            : 'イベント時のみ';

  return { frequency, intervalDays, label };
}

export function buildCheatDayPlan(profile: Profile, today = new Date()): CheatDayPlan {
  const result = calculate({
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

  const recommended =
    result.recommendedFormula === 'katchMcArdle'
      ? result.katchMcArdle
      : result.mifflin;
  const birthday = nextBirthday(profile.birthday_mmdd, today);
  const frequency = resolveFrequency(profile, recommended.goal, recommended.weeklyDeltaKg);
  const enabled = profile.cheat_day_enabled ?? true;
  const refeedCalories =
    recommended.goal === 'cut'
      ? recommended.tdee
      : Math.max(recommended.targetCalories, recommended.tdee);
  const protein_g = recommended.protein_g;
  const fat_g = Math.min(
    recommended.fat_g,
    round(
      Math.max(
        Number(profile.current_weight_kg) * 0.6,
        (refeedCalories * 0.2) / 9,
      ),
    ),
  );
  const carbs_g = Math.max(
    0,
    round((refeedCalories - protein_g * 4 - fat_g * 9) / 4),
  );
  const nextDate = frequency.intervalDays
    ? nextCycleDate(birthday, today, frequency.intervalDays)
    : birthday;
  const birthdayStart = addDays(birthday, -1);
  const birthdayEnd = addDays(birthday, 1);
  const todayISO = toISODate(today);
  const isBirthdayWindow = today >= birthdayStart && today <= birthdayEnd;
  const isIntervalDay = frequency.intervalDays ? todayISO === toISODate(nextDate) : false;

  return {
    enabled,
    goal: recommended.goal,
    frequency: frequency.frequency,
    frequencyLabel: frequency.label,
    intervalDays: frequency.intervalDays,
    nextDate: enabled ? toISODate(nextDate) : null,
    birthdayDate: enabled ? toISODate(birthday) : null,
    birthdayWindow: enabled
      ? `${toISODate(birthdayStart)}〜${toISODate(birthdayEnd)}のうち1日`
      : null,
    calories: round(refeedCalories),
    protein_g: round(protein_g),
    fat_g,
    carbs_g,
    title: recommended.goal === 'cut' ? 'チートデイ（リフィード）' : 'イベント食事枠',
    advice:
      recommended.goal === 'cut'
        ? [
            '摂取カロリーは原則メンテナンスまで。誕生日などのイベント日は最大でもメンテナンス+10%を1日だけに留めます。',
            'タンパク質は通常日と同じ量を確保し、脂質を増やしすぎず炭水化物を中心に増やします。',
            '停滞・疲労・筋トレ出力低下が強い場合は、1日リフィードより3〜7日のダイエットブレイクを優先します。',
          ]
        : [
            '維持・増量中は定期チートを増やす必要は低めです。イベント日に食事を楽しむ設定として扱います。',
            '翌日以降に帳尻を極端に削らず、週平均のカロリーで調整します。',
          ],
    isTodayCheatDay: enabled && (isBirthdayWindow || isIntervalDay),
  };
}
