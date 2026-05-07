import { NextResponse } from 'next/server';
import { Type } from '@google/genai';
import { getSessionUserId } from '@/lib/auth';
import { getGeminiClient, GEMINI_FLASH } from '@/lib/ai/gemini';
import type { MealType } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ParsedMeal {
  food_name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  meal_type: MealType | null;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

const SYSTEM_PROMPT = `あなたは経験豊富な管理栄養士のアシスタントです。
ユーザーが日本語で自然に書いた食事内容を、構造化された栄養情報に変換します。

【ルール】
- 量が明示されていない場合は、日本人の標準的な1人前で推定する（例: ご飯=150g, 鶏むね100g, etc.）
- カロリー・PFCは整数か小数1桁まで
- 食事区分(meal_type)は内容から類推。判断できなければ "unknown" を返す
- food_name は簡潔にまとめる（30文字以内）
- 推定の信頼度を confidence で示す: high(明確) / medium(量が曖昧) / low(食材不明など)
- notes には推定の根拠や注意点を簡潔に（80文字以内）

【参考栄養価（100gあたり）】
- 白米(炊飯済): 168kcal, P2.5/F0.3/C37
- 鶏むね肉(皮なし): 108kcal, P22/F2/C0
- 卵(1個約60g): 91kcal, P7.4/F6.2/C0.2
- 食パン(6枚切1枚60g): 158kcal, P5.4/F2.6/C28
- 納豆(1パック40g): 80kcal, P6.6/F4/C5
- バナナ(1本100g): 86kcal, P1.1/F0.2/C22.5
- プロテイン1スクープ(30g): 約120kcal, P24/F2/C2`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    food_name: { type: Type.STRING },
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
    'calories',
    'protein_g',
    'fat_g',
    'carbs_g',
    'meal_type',
    'confidence',
    'notes',
  ],
};

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

    const body = await req.json().catch(() => ({}));
    const text = String(body?.text ?? '').trim();
    if (!text) {
      return NextResponse.json(
        { error: '食事内容を入力してください' },
        { status: 400 },
      );
    }
    if (text.length > 1000) {
      return NextResponse.json(
        { error: '入力が長すぎます（1000文字以内）' },
        { status: 400 },
      );
    }

    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: GEMINI_FLASH,
      contents: text,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 2000,
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
    console.error('[meal/parse] error:', msg);
    return NextResponse.json(
      { error: `解析に失敗しました: ${msg}` },
      { status: 500 },
    );
  }
}

function parseAndValidate(raw: string): ParsedMeal | null {
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
      calories: clamp(Number(obj.calories ?? 0), 0, 100000),
      protein_g: clamp(Number(obj.protein_g ?? 0), 0, 5000),
      fat_g: clamp(Number(obj.fat_g ?? 0), 0, 5000),
      carbs_g: clamp(Number(obj.carbs_g ?? 0), 0, 5000),
      meal_type: validateMealType(obj.meal_type),
      confidence:
        obj.confidence === 'high' || obj.confidence === 'medium'
          ? obj.confidence
          : 'low',
      notes: String(obj.notes ?? '').slice(0, 200),
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
