import { calculate, type FormulaResult } from './calculations';
import type { Profile } from './types';

export interface CheatDayPlan {
  enabled: boolean;
  goal: FormulaResult['goal'];
  frequency: 'event_only';
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

function nextBirthday(mmdd: string | undefined, today: Date): Date {
  const { month, day } = parseBirthday(mmdd);
  const candidate = new Date(today.getFullYear(), month - 1, day);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (candidate < todayDate) candidate.setFullYear(candidate.getFullYear() + 1);
  return candidate;
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
  const isBirthdayFreeDay = enabled && todayISO === birthdayISO;
  const isCut = recommended.goal === 'cut';
  const advice = isBirthdayFreeDay
    ? [
        '今日は誕生日フリーデイです。カロリーやPFCの上限を気にせず、食べたいものを楽しんでください。',
        '記録は「振り返り用」として残すだけでOKです。翌日から通常の目標に戻します。',
        'できれば水分と睡眠だけは確保し、翌日に極端な帳尻合わせはしないでください。',
      ]
    : isCut
      ? [
          'フリーデイは年1回、誕生日当日の1日のみに絞ります。通常日はカロリー/PFC目標を維持します。',
          'この日は本当に好きなものを食べてOKです。翌日以降に極端な帳尻合わせはせず、通常運転へ戻します。',
          '停滞・疲労・筋トレ出力低下が強い場合は、フリーデイ追加ではなく睡眠・水分・減量ペースを見直します。',
        ]
      : [
          '維持・増量中でもフリーデイは誕生日当日の1日のみです。普段は通常の食事目標を使います。',
          '翌日以降に帳尻を極端に削らず、通常の記録と食事ペースに戻します。',
        ];

  return {
    enabled,
    goal: recommended.goal,
    frequency: 'event_only',
    frequencyLabel: '年1回（誕生日当日のみ）',
    intervalDays: null,
    nextDate: enabled ? birthdayISO : null,
    birthdayDate: enabled ? toISODate(birthday) : null,
    birthdayWindow: enabled ? `${birthdayISO} の1日のみ（フリーデイ）` : null,
    calories: 0,
    protein_g: 0,
    fat_g: 0,
    carbs_g: 0,
    title: '誕生日フリーデイ',
    advice,
    isTodayCheatDay: isBirthdayFreeDay,
    isBirthdayFreeDay,
  };
}
