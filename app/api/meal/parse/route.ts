import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getAnthropicClient, HAIKU_MODEL } from '@/lib/ai/anthropic';
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
ユーザーが日本語で自然に書いた食事内容を、JSON形式で構造化された栄養情報に変換します。

【ルール】
- 必ず JSON 形式で出力する。前後の説明・コードブロック記号は不要、純粋なJSONのみ
- 量が明示されていない場合は、日本人の標準的な1人前で推定する（例: ご飯=150g, 鶏むね100g, etc.）
- カロリー・PFCは整数か小数1桁まで
- 食事区分(meal_type)は内容から類推して以下のいずれか: breakfast/lunch/dinner/snack/pre_workout/post_workout
  判断できなければ null
- food_name は簡潔にまとめる（30文字以内）
- 推定の信頼度を confidence で示す: high(明確) / medium(量が曖昧) / low(食材不明など)
- notes には推定の根拠や注意点を簡潔に（80文字以内）

【出力JSON形式】
{
  "food_name": "string",
  "calories": number,
  "protein_g": number,
  "fat_g": number,
  "carbs_g": number,
  "meal_type": "breakfast|lunch|dinner|snack|pre_workout|post_workout|null",
  "confidence": "high|medium|low",
  "notes": "string"
}

【参考栄養価（100gあたり）】
- 白米(炊飯済): 168kcal, P2.5/F0.3/C37
- 鶏むね肉(皮なし): 108kcal, P22/F2/C0
- 卵(1個約60g): 91kcal, P7.4/F6.2/C0.2
- 食パン(6枚切1枚60g): 158kcal, P5.4/F2.6/C28
- 納豆(1パック40g): 80kcal, P6.6/F4/C5
- バナナ(1本100g): 86kcal, P1.1/F0.2/C22.5
- プロテイン1スクープ(30g): 約120kcal, P24/F2/C2`;

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

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
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
    console.error('[meal/parse] error:', msg);
    return NextResponse.json(
      { error: `解析に失敗しました: ${msg}` },
      { status: 500 },
    );
  }
}

function parseJSON(raw: string): ParsedMeal | null {
  // ```json ... ``` で囲まれていた場合も対応
  let s = raw.trim();
  s = s
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  // 最初の { から最後の } までを抽出
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
