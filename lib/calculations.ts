/**
 * 体重管理ツール — 計算エンジン
 *
 * 参考文献:
 *  - Mifflin MD et al., A new predictive equation for resting energy expenditure
 *    in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247.
 *  - Katch FI, McArdle WD. Exercise Physiology: Energy, Nutrition, and Human
 *    Performance.
 *  - ISSN Position Stand: Protein and Exercise (Jäger et al., 2017)
 *  - ISSN Position Stand: Diets and Body Composition (Aragon et al., 2017)
 *  - ACSM Guidelines for Exercise Testing and Prescription (11th ed.)
 */

import type { Gender, Period, TrainingFreq } from './types';

export interface CalcInput {
  heightCm: number;
  weightKg: number;
  bodyFatPct: number;
  age: number;
  gender: Gender;
  trainingFreq: TrainingFreq;
  targetWeightKg: number;
  targetBodyFatPct: number;
  period: Period;
}

export interface FormulaResult {
  bmr: number;
  tdee: number;
  targetCalories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  weeklyDeltaKg: number;
  goal: 'cut' | 'bulk' | 'maintain';
  warnings: string[];
}

export interface CalcOutput {
  mifflin: FormulaResult;
  katchMcArdle: FormulaResult;
  lbmKg: number;
  recommendedFormula: 'mifflin' | 'katchMcArdle';
  recommendedNote: string;
}

const ACTIVITY: Record<TrainingFreq, number> = {
  none: 1.2,
  '1-2': 1.375,
  '3-4': 1.55,
  '5+': 1.725,
};

const WEEKS: Record<Period, number> = {
  '1mo': 4.345,
  '3mo': 13.04,
  '6mo': 26.07,
  '1yr': 52.14,
};

const KCAL_PER_KG_BODYWEIGHT = 7700;

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function round(v: number, digits = 0): number {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

/** Mifflin-St Jeor BMR (kcal/day) */
export function mifflinStJeorBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

/** Katch-McArdle BMR (kcal/day) requires LBM */
export function katchMcArdleBMR(lbmKg: number): number {
  return 370 + 21.6 * lbmKg;
}

function buildResult(
  bmr: number,
  input: CalcInput,
  lbmKg: number,
): FormulaResult {
  const warnings: string[] = [];
  const tdee = bmr * ACTIVITY[input.trainingFreq];

  // 期間あたりの週次変化（kg/週）
  const weeks = WEEKS[input.period];
  const totalDeltaKg = input.targetWeightKg - input.weightKg;
  const rawWeekly = totalDeltaKg / weeks;

  // 安全レンジ: ±1%/週 にクランプ
  const maxWeekly = input.weightKg * 0.01;
  const clampedWeekly = clamp(rawWeekly, -maxWeekly, maxWeekly);
  if (Math.abs(rawWeekly) > maxWeekly) {
    warnings.push(
      `期間が短すぎるため、週次変化を安全レンジ（体重の±1%/週）にクランプしました（理想 ${rawWeekly.toFixed(2)}kg/週 → 採用 ${clampedWeekly.toFixed(2)}kg/週）`,
    );
  }

  // 1日あたりカロリー差分
  const dailyDelta = (clampedWeekly * KCAL_PER_KG_BODYWEIGHT) / 7;
  const targetCalories = tdee + dailyDelta;

  // ゴール分類
  const goal: FormulaResult['goal'] =
    clampedWeekly < -0.05 ? 'cut' : clampedWeekly > 0.05 ? 'bulk' : 'maintain';

  // マクロ配分
  let protein_g: number;
  let fat_g: number;
  if (goal === 'cut') {
    protein_g = 2.2 * lbmKg; // 2.0–2.4 g/kg LBM
    fat_g = 0.9 * input.weightKg; // 0.8–1.0 g/kg BW
  } else if (goal === 'bulk') {
    protein_g = 1.8 * lbmKg; // 1.6–2.2 g/kg LBM
    fat_g = (targetCalories * 0.275) / 9; // ~27.5% kcal
  } else {
    protein_g = 1.8 * input.weightKg;
    fat_g = (targetCalories * 0.275) / 9;
  }
  const carbs_g = Math.max(
    0,
    (targetCalories - protein_g * 4 - fat_g * 9) / 4,
  );

  // 警告チェック
  const minBF = input.gender === 'male' ? 5 : 12;
  if (input.targetBodyFatPct < minBF) {
    warnings.push(
      `目標体脂肪率 ${input.targetBodyFatPct}% は健康的下限（${input.gender === 'male' ? '男性5%' : '女性12%'}）を下回っています`,
    );
  }
  if (carbs_g < 100 && goal !== 'maintain') {
    warnings.push(
      `炭水化物が ${round(carbs_g)}g と非常に少なめです。エネルギー不足やパフォーマンス低下に注意してください`,
    );
  }
  if (targetCalories < 1200 && input.gender === 'female') {
    warnings.push('目標摂取カロリーが女性の最低推奨値（1,200kcal）を下回っています');
  }
  if (targetCalories < 1500 && input.gender === 'male') {
    warnings.push('目標摂取カロリーが男性の最低推奨値（1,500kcal）を下回っています');
  }

  return {
    bmr: round(bmr),
    tdee: round(tdee),
    targetCalories: round(targetCalories),
    protein_g: round(protein_g),
    fat_g: round(fat_g),
    carbs_g: round(carbs_g),
    weeklyDeltaKg: round(clampedWeekly, 2),
    goal,
    warnings,
  };
}

export function calculate(input: CalcInput): CalcOutput {
  const lbmKg = input.weightKg * (1 - input.bodyFatPct / 100);

  const mifflinBMR = mifflinStJeorBMR(
    input.weightKg,
    input.heightCm,
    input.age,
    input.gender,
  );
  const katchBMR = katchMcArdleBMR(lbmKg);

  const mifflin = buildResult(mifflinBMR, input, lbmKg);
  const katchMcArdle = buildResult(katchBMR, input, lbmKg);

  // 推奨式：体脂肪率が信頼できる（ユーザー入力済み）かつ筋トレ頻度が高い場合
  // Katch-McArdle のほうが除脂肪体重を反映するため精度が高い。
  const recommendedFormula: 'mifflin' | 'katchMcArdle' =
    input.trainingFreq === '3-4' || input.trainingFreq === '5+'
      ? 'katchMcArdle'
      : 'mifflin';

  const recommendedNote =
    recommendedFormula === 'katchMcArdle'
      ? '筋トレ習慣があり体脂肪率が把握できているため、除脂肪体重を反映する Katch-McArdle 式を主に参考にすることを推奨します。'
      : '体脂肪率の測定精度に依存しないため、まずは Mifflin-St Jeor 式の値を主に参考にすることを推奨します。';

  return {
    mifflin,
    katchMcArdle,
    lbmKg: round(lbmKg, 1),
    recommendedFormula,
    recommendedNote,
  };
}
