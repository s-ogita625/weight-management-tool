import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getGeminiClient, GEMINI_FLASH } from '@/lib/ai/gemini';
import { buildSystemPrompt, buildUserContext } from '@/lib/ai/context';
import type { AiChatMessage } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_HISTORY = 20;

export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message ?? '').trim();
    if (!message) {
      return NextResponse.json(
        { error: 'メッセージが空です' },
        { status: 400 },
      );
    }
    if (message.length > 4000) {
      return NextResponse.json(
        { error: 'メッセージが長すぎます（4000文字以内）' },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI機能が利用できません（GEMINI_API_KEY 未設定）' },
        { status: 503 },
      );
    }

    // ユーザーメッセージを保存
    await sql`
      insert into ai_chat_messages (user_id, role, content)
      values (${userId}, 'user', ${message})
    `;

    // 過去メッセージ取得（古い順）
    const historyDesc = (await sql`
      select id, user_id, role, content, created_at
      from ai_chat_messages
      where user_id = ${userId}
      order by created_at desc
      limit ${MAX_HISTORY}
    `) as AiChatMessage[];
    const history = historyDesc.reverse();

    const ctx = await buildUserContext(userId, 14);
    const systemPrompt = buildSystemPrompt(ctx);

    const client = getGeminiClient();

    // Gemini の contents 形式: [{role: 'user'|'model', parts: [{text: ...}]}, ...]
    const contents = history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const streamRes = await client.models.generateContentStream({
      model: GEMINI_FLASH,
      contents,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 1500,
        temperature: 0.7,
      },
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let assistantText = '';
        try {
          for await (const chunk of streamRes) {
            const t = chunk.text ?? '';
            if (t) {
              assistantText += t;
              controller.enqueue(encoder.encode(t));
            }
          }
          if (assistantText) {
            await sql`
              insert into ai_chat_messages (user_id, role, content)
              values (${userId}, 'assistant', ${assistantText})
            `;
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          controller.enqueue(encoder.encode(`\n\n[エラー: ${msg}]`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[chat] error:', msg);
    return NextResponse.json(
      { error: `応答の生成に失敗しました: ${msg}` },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  await sql`delete from ai_chat_messages where user_id = ${userId}`;
  return NextResponse.json({ ok: true });
}
