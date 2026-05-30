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

import type { Gender, Period, Priority, TrainingFreq } from './types';

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
  /** リーンカット モード（筋肉維持を最優先した安全な減量） */
  leanCutMode?: boolean;
  /** 優先度 */
  priority?: Priority;
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

  const isLeanCut = input.leanCutMode === true;

  // 安全レンジ: 通常 ±1%/週、リーンカット時は ±0.75%/週 (ISSN/Helms 2014: 0.5-1.0%)
  const maxWeekly = input.weightKg * (isLeanCut ? 0.0075 : 0.01);
  const clampedWeekly = clamp(rawWeekly, -maxWeekly, maxWeekly);
  if (Math.abs(rawWeekly) > maxWeekly) {
    warnings.push(
      `${isLeanCut ? 'リーンカット時の安全レンジ（±0.75%/週）' : '安全レンジ（体重の±1%/週）'}を超えていたためクランプしました（理想 ${rawWeekly.toFixed(2)}kg/週 → 採用 ${clampedWeekly.toFixed(2)}kg/週）`,
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
    const deficitRate = Math.abs(clampedWeekly) / input.weightKg;
    const isLean =
      input.gender === 'male'
        ? input.bodyFatPct <= 15
        : input.bodyFatPct <= 23;
    const isHardTraining =
      input.trainingFreq === '3-4' || input.trainingFreq === '5+';
    const proteinPerBodyWeight =
      isLeanCut || isLean || isHardTraining || deficitRate >= 0.0075
        ? 2.2
        : 2.0;
    const proteinPerLeanMass =
      isLeanCut || isLean || deficitRate >= 0.0075 ? 2.6 : 2.3;

    // 減量中は筋量維持を優先し、体重ベースと除脂肪体重ベースの高い方を採用。
    protein_g = Math.max(
      proteinPerBodyWeight * input.weightKg,
      proteinPerLeanMass * lbmKg,
    );
    fat_g = clamp(
      (targetCalories * 0.22) / 9,
      0.6 * input.weightKg,
      0.9 * input.weightKg,
    );
  } else if (goal === 'bulk') {
    protein_g = Math.max(1.8 * input.weightKg, 2.0 * lbmKg);
    fat_g = (targetCalories * 0.275) / 9; // ~27.5% kcal
  } else {
    // maintain - リコンプならタンパク質を高めに (Barakat 2020)
    const isRecomp = input.priority === 'recomposition';
    protein_g = isRecomp
      ? Math.max(2.2 * input.weightKg, 2.4 * lbmKg)
      : Math.max(1.8 * input.weightKg, 2.0 * lbmKg);
    fat_g = (targetCalories * 0.275) / 9;
  }
  const carbs_g = Math.max(
    0,
    (targetCalories - protein_g * 4 - fat_g * 9) / 4,
  );

  // リーンカット時の追加警告
  if (isLeanCut && goal === 'cut') {
    warnings.push(
      'リーンカットではレジスタンストレーニング週2-3回以上が筋量維持に必須です（Schoenfeld 2017, 各筋群週10-20セット）',
    );
    if (input.period === '3mo' || input.period === '6mo' || input.period === '1yr') {
      warnings.push(
        '4週以上の減量では1週間の維持カロリー（refeed/diet break）を挟むと代謝適応を抑え、筋量維持に有利です（MATADOR study, Byrne 2018）',
      );
    }
  }
  if (isLeanCut && goal === 'bulk') {
    warnings.push(
      'リーンカットモードは減量目的のみ有効です。目標体重が現体重を上回る場合はモードを OFF にしてください',
    );
  }
  if (isLeanCut && goal === 'maintain') {
    warnings.push(
      'リーンカットモードは減量フェーズで効果を発揮します。維持期では通常モードまたはリコンプ優先度を検討してください',
    );
  }
  if (input.priority === 'recomposition' && goal === 'maintain') {
    warnings.push(
      'ボディリコンポジション（同時に減量＋筋肥大）はトレーニング初心者・肥満者・休止期復帰者で達成しやすいとされます（Barakat et al., 2020）',
    );
  }

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
  if (goal === 'cut' && protein_g < input.weightKg * 2) {
    warnings.push(
      '減量中のタンパク質が体重×2gを下回っています。筋量維持を優先する場合は目標期間を延ばしてください',
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

  // 推奨式：リーンカット時は除脂肪体重ベースの精度が必要なため Katch-McArdle 固定
  // 通常時は筋トレ頻度が高い場合のみ Katch-McArdle を推奨
  const recommendedFormula: 'mifflin' | 'katchMcArdle' =
    input.leanCutMode === true ||
    input.trainingFreq === '3-4' ||
    input.trainingFreq === '5+'
      ? 'katchMcArdle'
      : 'mifflin';

  const recommendedNote =
    input.leanCutMode === true
      ? 'リーンカット時は除脂肪体重を反映する Katch-McArdle 式の値を採用しています（筋量維持の精度が高いため）。'
      : recommendedFormula === 'katchMcArdle'
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
