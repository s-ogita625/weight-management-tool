import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getGeminiClient, GEMINI_FLASH } from '@/lib/ai/gemini';
import { sql } from '@/lib/db';
import type { ResearchArticle, ResearchCitation } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Gemini SDK の型
interface GroundingChunk {
  web?: {
    uri: string;
    title?: string;
  };
}

export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const topic = String(body?.topic ?? '').trim().slice(0, 80);
    const focus = String(body?.focus ?? '').trim().slice(0, 200) || null;
    if (!topic) {
      return NextResponse.json(
        { error: 'topic を指定してください' },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI機能が利用できません（GEMINI_API_KEY 未設定）' },
        { status: 503 },
      );
    }

    // キャッシュチェック（同 topic + focus、未失効）
    const cached = (await sql`
      select id, user_id, topic, focus, summary, citations, is_favorite,
             to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
             to_char(expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as expires_at
      from research_articles
      where user_id = ${userId}
        and topic = ${topic}
        and (focus is not distinct from ${focus})
        and now() < expires_at
      order by created_at desc
      limit 1
    `) as unknown as ResearchArticle[];
    if (cached.length > 0) {
      return NextResponse.json({ ...cached[0], cached: true });
    }

    // Gemini に Web 検索 grounding 付きで問い合わせ
    const client = getGeminiClient();
    const userPrompt = `以下のトピックについて、最新（2023-2026年）の論文・公式ガイドライン・信頼できる解説記事を Web で検索し、ボディメイク実践者向けに簡潔にまとめてください。

【トピック】 ${topic}
${focus ? `【特に知りたいこと】 ${focus}` : ''}

【出力フォーマット (Markdown)】

## 概要
（200字以内で要約）

## 主要な知見（3-5個）
- 知見1（具体的数値があれば含める）
- 知見2
- 知見3

## 実践への落とし込み
（実際のトレーニーが今日から取り入れられる行動を 2-3 個、具体的な数値で）

## 注意点
（個人差・前提条件・限界）

ユーザーは日本人のボディメイク実践者です。エビデンスレベルが低い情報は明示してください。`;

    let summary = '';
    let citations: ResearchCitation[] = [];

    try {
      // Google Search Grounding を有効化
      const response = await client.models.generateContent({
        model: GEMINI_FLASH,
        contents: userPrompt,
        config: {
          maxOutputTokens: 6000,
          temperature: 0.5,
          thinkingConfig: { thinkingBudget: 0 },
          tools: [{ googleSearch: {} }],
        },
      });

      summary = response.text ?? '';

      // grounding metadata から URL を抽出
      const candidates = response.candidates ?? [];
      const groundingMetadata = (
        candidates[0] as { groundingMetadata?: { groundingChunks?: GroundingChunk[] } }
      )?.groundingMetadata;
      const chunks = groundingMetadata?.groundingChunks ?? [];
      const seen = new Set<string>();
      for (const chunk of chunks) {
        const url = chunk?.web?.uri;
        const title = chunk?.web?.title ?? url;
        if (url && !seen.has(url)) {
          seen.add(url);
          citations.push({ url, title: title ?? url });
        }
      }
    } catch (e: unknown) {
      // grounding がエラーになる場合、grounding なしで再試行
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[research] grounding failed, fallback:', msg);
      const fallback = await client.models.generateContent({
        model: GEMINI_FLASH,
        contents:
          userPrompt +
          '\n\n注意: Web検索は使えないため、一般的な専門知識からまとめてください。',
        config: {
          maxOutputTokens: 6000,
          temperature: 0.5,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      summary = fallback.text ?? '';
      citations = [];
    }

    if (!summary) {
      return NextResponse.json(
        { error: 'AIから応答を取得できませんでした' },
        { status: 502 },
      );
    }

    // DB に保存
    const inserted = (await sql`
      insert into research_articles (
        user_id, topic, focus, summary, citations
      ) values (
        ${userId}, ${topic}, ${focus}, ${summary}, ${JSON.stringify(citations)}::jsonb
      )
      returning id, user_id, topic, focus, summary, citations, is_favorite,
                to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
                to_char(expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as expires_at
    `) as unknown as ResearchArticle[];

    return NextResponse.json({ ...inserted[0], cached: false });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[research] error:', msg);
    return NextResponse.json(
      { error: `リサーチに失敗しました: ${msg}` },
      { status: 500 },
    );
  }
}
