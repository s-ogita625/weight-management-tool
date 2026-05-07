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

    const ctx = await buildUserContext(userId, 14);
    if (!ctx.profile) {
      return NextResponse.json(
        { error: 'プロフィールが未入力です' },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI機能が利用できません（GEMINI_API_KEY 未設定）' },
        { status: 503 },
      );
    }

    const client = getGeminiClient();
    const systemPrompt = buildSystemPrompt(ctx);

    const userQuestion =
      ctx.stats.daysLogged === 0
        ? 'まだ食事記録がありません。これから記録を始めるユーザーへ、最初の3日間で意識すべきポイントと、目標達成のための具体的な食事の組み立て方（PFCバランスの実践イメージ）をアドバイスしてください。'
        : `直近${ctx.stats.daysLogged}日分の食事記録を踏まえて、以下を含む簡潔なアドバイスを生成してください：
1. 良い点（具体的な数値や傾向で1-2点）
2. 改善できる点（最も影響の大きい点を1-2点、具体的な数値で）
3. 明日からの実践的アクション（2-3個、すぐ試せる具体的な食材・タイミング・量で）
4. モチベーションのひとこと
構成は ## 見出しで区切ってください。`;

    const response = await client.models.generateContent({
      model: GEMINI_FLASH,
      contents: userQuestion,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 8000,
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 }, // 軽量タスクは thinking 不要
      },
    });

    const text = response.text ?? '';
    if (!text) {
      console.warn('[advice] empty text. finishReason:', response.candidates?.[0]?.finishReason);
    }

    return NextResponse.json({
      advice: text,
      stats: ctx.stats,
      target: ctx.target,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[advice] error:', msg);
    return NextResponse.json(
      { error: `生成に失敗しました: ${msg}` },
      { status: 500 },
    );
  }
}
