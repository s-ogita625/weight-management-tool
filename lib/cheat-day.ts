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
  freeDayDates: string[];
  currentFreeDayLabel: string | null;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  title: string;
  advice: string[];
  isTodayCheatDay: boolean;
  isBirthdayFreeDay: boolean;
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
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

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function dateForMonth(year: number, month: number, day: number): Date {
  const clampedDay = Math.min(day, lastDayOfMonth(year, month));
  return new Date(year, month - 1, clampedDay);
}

function nextBirthday(mmdd: string | undefined, today: Date): Date {
  const { month, day } = parseBirthday(mmdd);
  const candidate = dateForMonth(today.getFullYear(), month, day);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (candidate < todayDate) candidate.setFullYear(candidate.getFullYear() + 1);
  return candidate;
}

function quarterlyFreeDates(mmdd: string | undefined, year: number): Date[] {
  const { month, day } = parseBirthday(mmdd);
  const monthSet = new Set<number>();
  for (let offset = 0; offset < 12; offset += 3) {
    monthSet.add(((month - 1 + offset) % 12) + 1);
  }
  return Array.from(monthSet)
    .sort((a, b) => a - b)
    .map((m) => dateForMonth(year, m, day));
}

function freeDayLabel(date: Date, birthdayMmdd?: string): string {
  const { month, day } = parseBirthday(birthdayMmdd);
  const birthday = dateForMonth(date.getFullYear(), month, day);
  return toISODate(date) === toISODate(birthday)
    ? '誕生日フリーデイ'
    : '四半期フリーデイ';
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
  const enabled = profile.cheat_day_enabled ?? true;
  const todayISO = toISODate(today);
  const birthdayISO = toISODate(birthday);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const currentYearDates = quarterlyFreeDates(
    profile.birthday_mmdd,
    todayDate.getFullYear(),
  );
  const nextYearDates = quarterlyFreeDates(
    profile.birthday_mmdd,
    todayDate.getFullYear() + 1,
  );
  const allCandidateDates = [...currentYearDates, ...nextYearDates];
  const nextFreeDay =
    allCandidateDates.find((date) => date >= todayDate) ?? allCandidateDates[0];
  const freeDayDates = currentYearDates.map(toISODate);
  const isTodayFreeDay =
    enabled && currentYearDates.some((date) => toISODate(date) === todayISO);
  const isBirthdayFreeDay = enabled && todayISO === birthdayISO;
  const isCut = recommended.goal === 'cut';
  const currentFreeDayLabel = isTodayFreeDay
    ? freeDayLabel(todayDate, profile.birthday_mmdd)
    : null;
  const advice = isTodayFreeDay
    ? [
        `今日は${currentFreeDayLabel}です。カロリーやPFCの上限を気にせず、食べたいものを楽しんでください。`,
        '記録は「振り返り用」として残すだけでOKです。翌日から通常の目標に戻します。',
        'できれば水分と睡眠だけは確保し、翌日に極端な帳尻合わせはしないでください。',
      ]
    : isCut
      ? [
          'フリーデイは年4回、約3ヶ月間隔の各1日に絞ります。通常日はカロリー/PFC目標を維持します。',
          '対象日は本当に好きなものを食べてOKです。翌日以降に極端な帳尻合わせはせず、通常運転へ戻します。',
          '停滞・疲労・筋トレ出力低下が強い場合は、フリーデイ追加ではなく睡眠・水分・減量ペースを見直します。',
        ]
      : [
          '維持・増量中でもフリーデイは年4回、約3ヶ月間隔の各1日です。普段は通常の食事目標を使います。',
          '翌日以降に帳尻を極端に削らず、通常の記録と食事ペースに戻します。',
        ];

  return {
    enabled,
    goal: recommended.goal,
    frequency: 'quarterly_free',
    frequencyLabel: '年4回（約3ヶ月間隔・各1日）',
    intervalDays: 90,
    nextDate: enabled ? toISODate(nextFreeDay) : null,
    birthdayDate: enabled ? toISODate(birthday) : null,
    birthdayWindow: enabled ? freeDayDates.join(' / ') : null,
    freeDayDates: enabled ? freeDayDates : [],
    currentFreeDayLabel,
    calories: 0,
    protein_g: 0,
    fat_g: 0,
    carbs_g: 0,
    title: isTodayFreeDay ? currentFreeDayLabel ?? 'フリーデイ' : '年4回フリーデイ',
    advice,
    isTodayCheatDay: isTodayFreeDay,
    isBirthdayFreeDay,
  };
}
