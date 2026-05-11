/**
 * 残りカロリーを「おにぎり何個分」「アイス何個分」のような身近な食材で表現するためのデータ。
 * 数値は文部科学省「日本食品標準成分表 2020 年版」および主要メーカー公表値の代表値を採用。
 */

export interface FunFood {
  emoji: string;
  name: string;
  kcal: number;
  /** 計量単位（個・本・枚など） */
  unit: string;
}

export const FUN_FOODS: FunFood[] = [
  { emoji: '🍙', name: 'おにぎり', kcal: 180, unit: '個' },
  { emoji: '🍩', name: 'ドーナツ', kcal: 230, unit: '個' },
  { emoji: '🍫', name: '板チョコ', kcal: 280, unit: '枚' },
  { emoji: '🍦', name: 'ハーゲンダッツ', kcal: 250, unit: '個' },
  { emoji: '🍪', name: 'クッキー', kcal: 50, unit: '枚' },
  { emoji: '🍰', name: 'ショートケーキ', kcal: 350, unit: '個' },
  { emoji: '🍔', name: 'ハンバーガー', kcal: 260, unit: '個' },
  { emoji: '🍟', name: 'マックフライポテト(M)', kcal: 410, unit: '個' },
  { emoji: '🍕', name: 'ピザ', kcal: 270, unit: '切れ' },
  { emoji: '🍣', name: '握り寿司', kcal: 45, unit: '貫' },
  { emoji: '🍜', name: 'ラーメン', kcal: 500, unit: '杯' },
  { emoji: '🍱', name: '幕の内弁当', kcal: 650, unit: '個' },
  { emoji: '🥐', name: 'クロワッサン', kcal: 180, unit: '個' },
  { emoji: '🍞', name: '食パン(6枚切)', kcal: 160, unit: '枚' },
  { emoji: '🥯', name: 'ベーグル', kcal: 280, unit: '個' },
  { emoji: '🍌', name: 'バナナ', kcal: 86, unit: '本' },
  { emoji: '🍎', name: 'りんご', kcal: 140, unit: '個' },
  { emoji: '🥚', name: 'ゆで卵', kcal: 90, unit: '個' },
  { emoji: '🍗', name: 'ファミチキ', kcal: 240, unit: '個' },
  { emoji: '🍤', name: 'えびフライ', kcal: 70, unit: '尾' },
  { emoji: '🌭', name: 'アメリカンドッグ', kcal: 270, unit: '本' },
  { emoji: '🥞', name: 'パンケーキ', kcal: 220, unit: '枚' },
  { emoji: '🍮', name: 'プリン', kcal: 130, unit: '個' },
  { emoji: '🥛', name: '牛乳(コップ1杯)', kcal: 134, unit: '杯' },
  { emoji: '☕', name: 'カフェオレ', kcal: 80, unit: '杯' },
  { emoji: '🍺', name: '缶ビール(350ml)', kcal: 140, unit: '本' },
  { emoji: '🥟', name: '餃子', kcal: 50, unit: '個' },
  { emoji: '🍡', name: 'みたらし団子', kcal: 90, unit: '本' },
  { emoji: '🍘', name: 'せんべい', kcal: 100, unit: '枚' },
  { emoji: '🍵', name: '抹茶ラテ(M)', kcal: 200, unit: '杯' },
  // タンパク質寄り（筋トレ向け）
  { emoji: '💪', name: 'プロテインバー', kcal: 180, unit: '本' },
  { emoji: '🍳', name: 'プロテインシェイク', kcal: 120, unit: '杯' },
  { emoji: '🥗', name: 'サラダチキン', kcal: 110, unit: 'パック' },
];

/**
 * 与えられた kcal を、ランダムに選ばれた N 種類の身近な食材で表現する
 * @param kcal 残りカロリー（負数の場合は超過扱い）
 * @param count 表示する例の数
 * @param seed 同じ seed で同じ結果（ハイドレーション一致用）。省略時はランダム
 */
export function pickFunComparisons(
  kcal: number,
  count = 3,
  seed?: number,
): { food: FunFood; quantity: number; display: string }[] {
  const absKcal = Math.abs(kcal);
  if (absKcal < 20) return [];

  // seed があれば擬似乱数を固定
  const rng = seed !== undefined ? createSeededRandom(seed) : Math.random;
  const shuffled = [...FUN_FOODS].sort(() => rng() - 0.5);

  const picked: { food: FunFood; quantity: number; display: string }[] = [];
  for (const food of shuffled) {
    if (picked.length >= count) break;
    const qty = absKcal / food.kcal;
    // 表示適性: 0.3-30 個の範囲が現実的
    if (qty < 0.3 || qty > 30) continue;
    const rounded =
      qty >= 10
        ? Math.round(qty)
        : qty >= 1
          ? Math.round(qty * 10) / 10
          : Math.round(qty * 10) / 10;
    picked.push({
      food,
      quantity: rounded,
      display: `${food.emoji} ${food.name} ${rounded}${food.unit}`,
    });
  }
  return picked;
}

/** 簡易シード乱数（Mulberry32） */
function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
