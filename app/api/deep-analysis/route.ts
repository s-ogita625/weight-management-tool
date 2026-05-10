import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getGeminiClient, GEMINI_FLASH } from '@/lib/ai/gemini';
import { buildSystemPrompt, buildUserContext } from '@/lib/ai/context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const ctx = await buildUserContext(userId, 30);
    if (!ctx.profile) {
      return NextResponse.json(
        { error: 'プロフィールが未入力です' },
        { status: 400 },
      );
    }

    if (!ctx.historicalAnalysis) {
      return NextResponse.json(
        { error: '分析に必要なデータが不足しています（朝の記録を増やしてください）' },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        analysis: ctx.historicalAnalysis,
        narrative: '',
        recommendations: [],
        note: 'AIによる解釈はGEMINI_API_KEY未設定のため利用できません',
      });
    }

    const client = getGeminiClient();
    const systemPrompt = buildSystemPrompt(ctx);

    const ha = ctx.historicalAnalysis;
    const userQuestion = `過去30日のデータを深掘り分析した上で、停滞期の有無と脱出戦略について簡潔にレポートしてください。

【分析結果】
- 記録継続率: ${ha.consistencyScore}%
- カロリー達成率中央値: ${ha.caloriesAdherenceMedianPct}%
- タンパク質達成率中央値: ${ha.proteinAdherenceMedianPct}%
- 体重スロープ: ${ha.weightSlopeKgPerWeek.toFixed(2)} kg/週
- 体重スロープ加速度: ${ha.weightSlopeAccelKgPerWeek2.toFixed(2)} kg/週²（プラスは減速、マイナスは加速）
- 体重 volatility (標準偏差): ${ha.weightVolatilityKg.toFixed(2)} kg
- 睡眠×体重変化 相関: ${ha.sleepWeightCorrelation === null ? 'N/A' : ha.sleepWeightCorrelation.toFixed(2)}
- 疲労×カロリー達成 相関: ${ha.fatigueAdherenceCorrelation === null ? 'N/A' : ha.fatigueAdherenceCorrelation.toFixed(2)}
- 停滞期: ${ha.isPlateau ? `あり — ${ha.plateauReason}` : 'なし'}

以下のセクション構成で：

## 📊 状況の解釈
（直近のスロープ・加速度から客観評価。1-2文）

## ${ha.isPlateau ? '🚧 停滞期の原因候補' : '🟢 停滞リスクの予兆'}
${ha.isPlateau ? '（記録継続率・コンディション・代謝適応・volatility 等から最も可能性高い原因2-3個）' : '（プラトー入りを避けるためのリスク要因2-3個）'}

## 🎯 推奨アクション (3つまで)
（具体的な数値変更：例「カロリーを-100kcal」「タンパク質を+10g」「refeed日を入れる」「睡眠時間を30分増やす」）

## 💡 ひとこと
（短いモチベーションメッセージ）

注意: 体重volatility が ${ha.weightVolatilityKg.toFixed(1)}kg と大きい場合は水分・グリコーゲンの自然変動による可能性も言及。女性ユーザーは月経周期での1-3kg変動も考慮。`;

    const response = await client.models.generateContent({
      model: GEMINI_FLASH,
      contents: userQuestion,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 5000,
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const narrative = response.text ?? '';
    if (!narrative) {
      console.warn(
        '[deep-analysis] empty text. finishReason:',
        response.candidates?.[0]?.finishReason,
      );
    }

    return NextResponse.json({
      analysis: ctx.historicalAnalysis,
      narrative,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[deep-analysis] error:', msg);
    return NextResponse.json(
      { error: `分析に失敗しました: ${msg}` },
      { status: 500 },
    );
  }
}
