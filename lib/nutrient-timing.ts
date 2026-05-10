/**
 * 食事タイミング分析・推奨ロジック
 *
 * 参考文献:
 *  - Kerksick CM et al. ISSN Position Stand: Nutrient Timing. JISSN 2017
 *  - Aragon AA, Schoenfeld BJ. Nutrient timing revisited. JISSN 2013
 *  - Schoenfeld BJ, Aragon AA. How much protein per meal. JISSN 2018 (0.4-0.55 g/kg BW/食)
 */

import type {
  MealLog,
  MealType,
  Profile,
  MealTimingAnalysis,
  MealTimingAdvice,
} from './types';
import type { FormulaResult } from './calculations';

export const PER_MEAL_PROTEIN_G_PER_KG_MIN = 0.4;
export const PER_MEAL_PROTEIN_G_PER_KG_MAX = 0.55;
export const LEUCINE_THRESHOLD_PROTEIN_G = 20; // 高齢者は40g
export const ANABOLIC_WINDOW_HOURS = 4;
const LONG_GAP_HOURS = 5; // 5時間以上空くと筋分解リスク

/** "HH:MM" → 0-23.99 の小数時間 */
function timeToHours(time: string | null): number | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (isNaN(h) || isNaN(min)) return null;
  return h + min / 60;
}

/** 食事を時刻順にソート（time が null のものは末尾） */
function sortByTime(meals: MealLog[]): MealLog[] {
  return [...meals].sort((a, b) => {
    const ta = timeToHours(a.time);
    const tb = timeToHours(b.time);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });
}

/** 1日の食事を時刻順に並べ、間隔・P 分布・leucine 達成を分析 */
export function analyzeMealTiming(meals: MealLog[]): MealTimingAnalysis {
  const sorted = sortByTime(meals);
  const withTime = sorted.filter((m) => m.time !== null);

  // 食事間隔
  const intervalsHours: number[] = [];
  for (let i = 1; i < withTime.length; i++) {
    const t0 = timeToHours(withTime[i - 1].time);
    const t1 = timeToHours(withTime[i].time);
    if (t0 !== null && t1 !== null) {
      intervalsHours.push(Math.max(0, t1 - t0));
    }
  }

  const proteinPerMeal = sorted.map((m) => Number(m.protein_g) || 0);
  const leucineThresholdMet = proteinPerMeal.filter(
    (p) => p >= LEUCINE_THRESHOLD_PROTEIN_G,
  ).length;
  const longestGapHours =
    intervalsHours.length > 0 ? Math.max(...intervalsHours) : 0;

  // P 配分: 朝(0-12) / 午後(12-18) / 夜(18-24) の合計を比較
  let amP = 0;
  let pmP = 0;
  let nightP = 0;
  for (const m of withTime) {
    const t = timeToHours(m.time);
    if (t === null) continue;
    const p = Number(m.protein_g) || 0;
    if (t < 12) amP += p;
    else if (t < 18) pmP += p;
    else nightP += p;
  }
  const totalP = amP + pmP + nightP || 1;
  const amPct = amP / totalP;
  const nightPct = nightP / totalP;
  let distribution: MealTimingAnalysis['distribution'] = 'unknown';
  if (withTime.length >= 3) {
    if (amPct >= 0.45) distribution = 'front-loaded';
    else if (nightPct >= 0.45) distribution = 'back-loaded';
    else distribution = 'even';
  }

  const notes: string[] = [];
  if (longestGapHours >= LONG_GAP_HOURS) {
    notes.push(
      `食事間隔が最大 ${longestGapHours.toFixed(1)}h と長めです。5時間以上空くと筋タンパク質合成が低下する可能性があります（ISSN 2017）`,
    );
  }
  if (
    sorted.length >= 3 &&
    leucineThresholdMet < Math.ceil(sorted.length / 2)
  ) {
    notes.push(
      `${LEUCINE_THRESHOLD_PROTEIN_G}g 以上のタンパク質を含む食事が ${leucineThresholdMet}/${sorted.length} 食です。leucine threshold に達する食事を増やすと筋肉合成が最大化されます`,
    );
  }
  if (distribution === 'back-loaded') {
    notes.push(
      'タンパク質が夜に偏っています。朝・昼にも均等に分散するとMPS（筋タンパク質合成）が4-5回起こります（Schoenfeld & Aragon 2018）',
    );
  }

  return {
    intervalsHours,
    proteinPerMeal,
    leucineThresholdMet,
    totalMeals: sorted.length,
    distribution,
    longestGapHours,
    notes,
  };
}

/** プロフィール+目標から、その日のタイミング推奨を作成 */
export function getMealTimingAdvice(
  profile: Profile,
  plan: FormulaResult,
  todayMeals: MealLog[],
): MealTimingAdvice {
  const bw = Number(profile.current_weight_kg);
  // per-meal protein 目安（Schoenfeld & Aragon 2018: 0.4-0.55 g/kg）
  const perMealMid = Math.round(
    bw * ((PER_MEAL_PROTEIN_G_PER_KG_MIN + PER_MEAL_PROTEIN_G_PER_KG_MAX) / 2),
  );
  // cut/lean cut 時は5食推奨、bulk/maintain は3-4食
  const recommendedMealCount = plan.goal === 'cut' ? 5 : 4;

  const trains = profile.training_freq !== 'none';
  const preWorkout = {
    hoursBefore: 1.5,
    carbsG: Math.round(bw * 0.75), // 0.5-1.0 g/kg
    proteinG: 20,
  };
  const postWorkout = {
    hoursAfter: 1,
    proteinG: Math.min(40, Math.round(bw * 0.4)), // ≤ 40g
    carbsG: Math.round(bw * 1.0), // 0.8-1.2 g/kg
  };

  const notes: string[] = [
    `1食あたりタンパク質目安：約 ${perMealMid}g（${PER_MEAL_PROTEIN_G_PER_KG_MIN}-${PER_MEAL_PROTEIN_G_PER_KG_MAX}g/kg BW、Schoenfeld & Aragon 2018）`,
    `推奨食事回数：1日 ${recommendedMealCount} 食前後`,
    'leucine threshold（20g protein/食）を 4-5 回満たすことで MPS を最大化',
    'アナボリックウィンドウは数時間に拡張（Aragon & Schoenfeld 2013）。post-workout は2時間以内が望ましい',
  ];
  if (!trains) {
    notes.push(
      '筋トレ頻度が「週0回」となっています。リーンカットや筋量維持にはレジスタンストレーニングが必須です',
    );
  }

  // アラート（今日のログから）
  const alerts: string[] = [];
  const todayP = todayMeals.reduce((a, m) => a + (Number(m.protein_g) || 0), 0);
  const targetP = plan.protein_g;
  if (todayP < targetP * 0.5 && todayMeals.length >= 2) {
    alerts.push(
      `本日のタンパク質摂取が目標 ${Math.round(targetP)}g に対して ${Math.round(todayP)}g です。残りの食事で意識的に補ってください`,
    );
  }
  if (todayMeals.length === 0) {
    alerts.push('本日まだ記録がありません。朝食を抜くと総摂取量が落ちやすい傾向');
  }

  return {
    perMealProteinTargetG: perMealMid,
    recommendedMealCount,
    preWorkout,
    postWorkout,
    notes,
    alerts,
  };
}

/** 「次の食事は何分後・どれくらい・何タイプ」を提案 */
export function nextMealRecommendation(
  todayMeals: MealLog[],
  advice: MealTimingAdvice,
  nowHHMM: string,
): {
  etaMinutes: number;
  type: MealType;
  protein_g: number;
  suggestion: string;
} | null {
  const nowH = timeToHours(nowHHMM);
  if (nowH === null) return null;
  const sorted = sortByTime(todayMeals.filter((m) => m.time !== null));
  const lastMeal = sorted[sorted.length - 1];

  if (!lastMeal || !lastMeal.time) {
    // 朝食 or 昼食
    const type: MealType =
      nowH < 10 ? 'breakfast' : nowH < 14 ? 'lunch' : 'snack';
    return {
      etaMinutes: 0,
      type,
      protein_g: advice.perMealProteinTargetG,
      suggestion: '本日まだ記録がありません。次の食事をすぐ取りましょう',
    };
  }

  const lastH = timeToHours(lastMeal.time)!;
  const gap = nowH - lastH;
  const idealGapH = 4; // 3-5h の中央値
  const etaH = Math.max(0, idealGapH - gap);
  const etaMinutes = Math.round(etaH * 60);

  // 次の type 推測
  const nextH = nowH + etaH;
  const type: MealType =
    nextH < 10
      ? 'breakfast'
      : nextH < 14
        ? 'lunch'
        : nextH < 17
          ? 'snack'
          : nextH < 21
            ? 'dinner'
            : 'snack';

  const suggestion =
    etaMinutes === 0
      ? `${idealGapH}時間以上空いています。すぐ次の食事を取りましょう`
      : `次の食事まで約 ${etaMinutes}分。${type === 'snack' ? '間食でもOK' : 'メイン食をしっかり'}`;

  return {
    etaMinutes,
    type,
    protein_g: advice.perMealProteinTargetG,
    suggestion,
  };
}
