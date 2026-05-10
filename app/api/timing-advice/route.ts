import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getGeminiClient, GEMINI_FLASH } from '@/lib/ai/gemini';
import { buildSystemPrompt, buildUserContext } from '@/lib/ai/context';
import { calculate } from '@/lib/calculations';
import { dateInJST, timeInJST } from '@/lib/date';
import { sql } from '@/lib/db';
import {
  analyzeMealTiming,
  getMealTimingAdvice,
  nextMealRecommendation,
} from '@/lib/nutrient-timing';
import type { MealLog } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const ctx = await buildUserContext(userId, 14);
    if (!ctx.profile) {
      return NextResponse.json(
        { error: 'プロフィールが未入力です' },
        { status: 400 },
      );
    }

    // 今日の食事を取得
    const today = dateInJST();
    const todayMealsRaw = await sql`
      select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
             to_char(time, 'HH24:MI') as time,
             meal_type, food_name,
             calories, protein_g, fat_g, carbs_g, memo, created_at
      from meal_logs
      where user_id = ${userId} and date = ${today}
      order by time asc nulls last, created_at asc
    `;
    const todayMeals = todayMealsRaw as unknown as MealLog[];

    // 計算
    const calcResult = calculate({
      heightCm: Number(ctx.profile.height_cm),
      weightKg: Number(ctx.profile.current_weight_kg),
      bodyFatPct: Number(ctx.profile.body_fat_pct),
      age: Number(ctx.profile.age),
      gender: ctx.profile.gender,
      trainingFreq: ctx.profile.training_freq,
      targetWeightKg: Number(ctx.profile.target_weight_kg),
      targetBodyFatPct: Number(ctx.profile.target_body_fat_pct),
      period: ctx.profile.target_period,
      leanCutMode: ctx.profile.lean_cut_mode,
      priority: ctx.profile.priority,
    });
    const plan =
      calcResult.recommendedFormula === 'katchMcArdle'
        ? calcResult.katchMcArdle
        : calcResult.mifflin;

    const analysis = analyzeMealTiming(todayMeals);
    const advice = getMealTimingAdvice(ctx.profile, plan, todayMeals);
    const nextMeal = nextMealRecommendation(
      todayMeals,
      advice,
      timeInJST(),
    );

    // AI で具体的な次の食事提案を生成（オプショナル）
    let aiMessage = '';
    if (process.env.GEMINI_API_KEY) {
      const client = getGeminiClient();
      const systemPrompt = buildSystemPrompt(ctx);

      const todayMealsSummary =
        todayMeals.length === 0
          ? '本日の記録なし'
          : todayMeals
              .map(
                (m) =>
                  `- ${m.time ?? '時刻不明'} ${m.meal_type ?? ''} ${m.food_name ?? ''}: ${Math.round(Number(m.calories))}kcal P${Math.round(Number(m.protein_g))} F${Math.round(Number(m.fat_g))} C${Math.round(Number(m.carbs_g))}`,
              )
              .join('\n');

      const userQuestion = `本日（${today}、現在時刻 ${timeInJST()}）の食事タイミングについて簡潔にアドバイスしてください。

【本日の食事】
${todayMealsSummary}

【1日の目標】
カロリー ${plan.targetCalories}kcal / P${plan.protein_g}g / F${plan.fat_g}g / C${plan.carbs_g}g

【タイミング分析】
- 食事数: ${analysis.totalMeals}
- leucine threshold (20g) 達成: ${analysis.leucineThresholdMet}/${analysis.totalMeals}
- 最大食間隔: ${analysis.longestGapHours.toFixed(1)}時間
- 配分: ${analysis.distribution}
${analysis.notes.length > 0 ? '- 課題: ' + analysis.notes.join(' / ') : ''}

【推奨】
- 1食P目安: ${advice.perMealProteinTargetG}g
- 推奨食事数: ${advice.recommendedMealCount}食
${nextMeal ? `- 次の食事: 約${nextMeal.etaMinutes}分後 (${nextMeal.type}) P=${nextMeal.protein_g}g` : ''}

以下の構成で5-8文程度で：
1. 本日のタイミング評価（良い点1つ、改善点1つ）
2. 次の食事の具体的提案（食材例つき。例: 「鶏むね150gと玄米茶碗1杯」など）
3. 残りの食事配分のアドバイス（運動前/後を含む場合は明示）

専門用語は最低限、実践しやすく。`;

      try {
        const response = await client.models.generateContent({
          model: GEMINI_FLASH,
          contents: userQuestion,
          config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: 4000,
            temperature: 0.7,
            thinkingConfig: { thinkingBudget: 0 },
          },
        });
        aiMessage = response.text ?? '';
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[timing-advice] AI failed:', msg);
        aiMessage = '';
      }
    }

    return NextResponse.json({
      analysis,
      advice,
      nextMeal,
      plan: {
        targetCalories: plan.targetCalories,
        protein_g: plan.protein_g,
        fat_g: plan.fat_g,
        carbs_g: plan.carbs_g,
        goal: plan.goal,
      },
      aiMessage,
      todayMealsCount: todayMeals.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[timing-advice] error:', msg);
    return NextResponse.json(
      { error: `生成に失敗しました: ${msg}` },
      { status: 500 },
    );
  }
}
