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

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI機能が利用できません（GEMINI_API_KEY 未設定）' },
        { status: 503 },
      );
    }

    const ctx = await buildUserContext(userId, 7);
    const systemPrompt = buildSystemPrompt(ctx);

    const userQuestion = `直近7日間（過去1週間）の振り返りレポートを作成してください。
以下のセクション構成で簡潔にまとめてください：

## 📊 今週のハイライト
（記録の状況、平均カロリー、体重変化など、数値で具体的に）

## ✅ よかった点
（食事/運動/コンディション/家計の観点から1-3個、具体的に）

## ⚠️ 課題と改善余地
（最も影響の大きい課題を1-3個、具体的な数値・対策とともに）

## 🎯 来週のアクション (3つまで)
（明日からすぐ実行できる具体的な行動。食材・量・タイミングを明示）

## 💪 ひとこと
（モチベーションを高める短い一文）

データが少ない場合（記録日数3日未満等）は、その旨を率直に伝え、まず記録習慣をつけるためのアドバイスを中心にしてください。`;

    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: GEMINI_FLASH,
      contents: userQuestion,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 2000,
        temperature: 0.7,
      },
    });

    const text = response.text ?? '';

    return NextResponse.json({
      report: text,
      stats: ctx.stats,
      target: ctx.target,
      weightTrend: ctx.weightTrend,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[weekly-report] error:', msg);
    return NextResponse.json(
      { error: `レポート生成に失敗しました: ${msg}` },
      { status: 500 },
    );
  }
}
