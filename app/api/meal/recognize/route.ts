import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getAnthropicClient, HAIKU_MODEL } from '@/lib/ai/anthropic';
import type { MealType } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RecognizedMeal {
  food_name: string;
  items: string[];
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  meal_type: MealType | null;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

const SYSTEM_PROMPT = `あなたは経験豊富な管理栄養士のアシスタントです。
食事の写真から、写っている料理・食材を識別し、栄養情報を推定してJSON形式で返します。

【ルール】
- 必ず JSON 形式のみで出力。前後の説明・コードブロック記号は不要
- 写真にある食材を items 配列に列挙（例: ["白米", "鶏もも肉の照り焼き", "サラダ"]）
- 量は写真の見た目から日本人の標準的な1人前を仮定して推定
- カロリー・PFCは整数か小数1桁
- 食事区分(meal_type)は写っている内容から類推
- food_name は写真全体の一言まとめ（30文字以内）
- 信頼度: high(明確に判別できる) / medium(一部曖昧) / low(暗い・ピンぼけ・判別困難)
- notes には推定の根拠や量の仮定を簡潔に（150文字以内）
- 食事以外の写真の場合は confidence=low、food_name="食事を判別できません"、栄養値0で返す

【出力JSON形式】
{
  "food_name": "string",
  "items": ["string"],
  "calories": number,
  "protein_g": number,
  "fat_g": number,
  "carbs_g": number,
  "meal_type": "breakfast|lunch|dinner|snack|pre_workout|post_workout|null",
  "confidence": "high|medium|low",
  "notes": "string"
}`;

const ALLOWED_MEDIA = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'AI機能が利用できません（ANTHROPIC_API_KEY 未設定）' },
        { status: 503 },
      );
    }

    const formData = await req.formData();
    const file = formData.get('image');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: '画像ファイルが必要です' },
        { status: 400 },
      );
    }

    if (!ALLOWED_MEDIA.has(file.type)) {
      return NextResponse.json(
        { error: 'JPEG/PNG/WebP/GIF のみ対応しています' },
        { status: 400 },
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: '画像サイズが5MBを超えています' },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: file.type as
                  | 'image/jpeg'
                  | 'image/png'
                  | 'image/webp'
                  | 'image/gif',
                data: base64,
              },
            },
            {
              type: 'text',
              text: 'この食事の写真を分析して、上記JSON形式で出力してください。',
            },
          ],
        },
      ],
    });

    const raw = response.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('')
      .trim();

    const parsed = parseJSON(raw);
    if (!parsed) {
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした', raw },
        { status: 502 },
      );
    }

    return NextResponse.json({ result: parsed });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[meal/recognize] error:', msg);
    return NextResponse.json(
      { error: `画像認識に失敗しました: ${msg}` },
      { status: 500 },
    );
  }
}

function parseJSON(raw: string): RecognizedMeal | null {
  let s = raw.trim();
  s = s
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  const json = s.slice(start, end + 1);
  try {
    const obj = JSON.parse(json);
    return {
      food_name: String(obj.food_name ?? '').slice(0, 100),
      items: Array.isArray(obj.items)
        ? obj.items.map((x: unknown) => String(x).slice(0, 50)).slice(0, 20)
        : [],
      calories: clamp(Number(obj.calories ?? 0), 0, 100000),
      protein_g: clamp(Number(obj.protein_g ?? 0), 0, 5000),
      fat_g: clamp(Number(obj.fat_g ?? 0), 0, 5000),
      carbs_g: clamp(Number(obj.carbs_g ?? 0), 0, 5000),
      meal_type: validateMealType(obj.meal_type),
      confidence:
        obj.confidence === 'high' || obj.confidence === 'medium'
          ? obj.confidence
          : 'low',
      notes: String(obj.notes ?? '').slice(0, 300),
    };
  } catch {
    return null;
  }
}

function clamp(n: number, min: number, max: number): number {
  if (isNaN(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

function validateMealType(v: unknown): MealType | null {
  const valid: MealType[] = [
    'breakfast',
    'lunch',
    'dinner',
    'snack',
    'pre_workout',
    'post_workout',
  ];
  return typeof v === 'string' && (valid as string[]).includes(v)
    ? (v as MealType)
    : null;
}
