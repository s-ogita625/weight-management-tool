import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getAnthropicClient, HAIKU_MODEL } from '@/lib/ai/anthropic';
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

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'AI機能が利用できません（ANTHROPIC_API_KEY 未設定）' },
        { status: 503 },
      );
    }

    const client = getAnthropicClient();
    const systemPrompt = buildSystemPrompt(ctx);

    const userQuestion = ctx.stats.daysLogged === 0
      ? 'まだ食事記録がありません。これから記録を始めるユーザーへ、最初の3日間で意識すべきポイントと、目標達成のための具体的な食事の組み立て方（PFCバランスの実践イメージ）をアドバイスしてください。'
      : `直近${ctx.stats.daysLogged}日分の食事記録を踏まえて、以下を含む簡潔なアドバイスを生成してください：
1. 良い点（具体的な数値や傾向で1-2点）
2. 改善できる点（最も影響の大きい点を1-2点、具体的な数値で）
3. 明日からの実践的アクション（2-3個、すぐ試せる具体的な食材・タイミング・量で）
4. モチベーションのひとこと
構成は ## 見出しで区切ってください。`;

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userQuestion }],
    });

    const text = response.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('');

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
