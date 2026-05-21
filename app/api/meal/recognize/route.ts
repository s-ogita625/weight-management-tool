import { NextResponse } from 'next/server';
import { Type } from '@google/genai';
import { getSessionUserId } from '@/lib/auth';
import { getGeminiClient, GEMINI_FLASH } from '@/lib/ai/gemini';
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
食事の写真から、写っている料理・食材を識別し、栄養情報を推定します。

【ルール】
- 写真にある食材を items 配列に列挙（例: ["白米", "鶏もも肉の照り焼き", "サラダ"]）
- 量は写真の見た目から日本人の標準的な1人前を仮定して推定
- カロリー・PFCは整数か小数1桁
- 食事区分(meal_type)は写っている内容から類推。判断できなければ "unknown"
- food_name は写真全体の一言まとめ（30文字以内）
- 信頼度: high(明確に判別) / medium(一部曖昧) / low(暗い・ピンぼけ・判別困難)
- notes には推定の根拠や量の仮定を簡潔に（150文字以内）
- 食事以外の写真の場合は confidence=low、food_name="食事を判別できません"、栄養値0で返す`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    food_name: { type: Type.STRING },
    items: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    calories: { type: Type.NUMBER },
    protein_g: { type: Type.NUMBER },
    fat_g: { type: Type.NUMBER },
    carbs_g: { type: Type.NUMBER },
    meal_type: {
      type: Type.STRING,
      enum: [
        'breakfast',
        'lunch',
        'dinner',
        'snack',
        'pre_workout',
        'post_workout',
        'unknown',
      ],
    },
    confidence: {
      type: Type.STRING,
      enum: ['high', 'medium', 'low'],
    },
    notes: { type: Type.STRING },
  },
  required: [
    'food_name',
    'items',
    'calories',
    'protein_g',
    'fat_g',
    'carbs_g',
    'meal_type',
    'confidence',
    'notes',
  ],
};

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

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI機能が利用できません（GEMINI_API_KEY 未設定）' },
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

    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: GEMINI_FLASH,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: file.type,
                data: base64,
              },
            },
            {
              text: 'この食事の写真を分析して、JSON形式で出力してください。',
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 2500,
        temperature: 0.4,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const raw = response.text ?? '';
    const parsed = parseAndValidate(raw);
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
    // Gemini のレート制限・クォータ超過を 429 に正規化
    if (/\b429\b|quota|exceeded|rate\s*limit|RESOURCE_EXHAUSTED/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            'AIの利用上限に達しました。少し時間を置いて再試行してください',
        },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: '画像認識に失敗しました。少し経ってから再試行してください' },
      { status: 500 },
    );
  }
}

function parseAndValidate(raw: string): RecognizedMeal | null {
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
