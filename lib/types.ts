export type Gender = 'male' | 'female';
export type TrainingFreq = 'none' | '1-2' | '3-4' | '5+';
export type Period = '1mo' | '3mo' | '6mo' | '1yr';
export type MealType =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'
  | 'pre_workout'
  | 'post_workout';

export interface Profile {
  user_id: string;
  height_cm: number;
  gender: Gender;
  age: number;
  current_weight_kg: number;
  body_fat_pct: number;
  training_freq: TrainingFreq;
  target_weight_kg: number;
  target_body_fat_pct: number;
  target_period: Period;
  created_at?: string;
  updated_at?: string;
}

export interface MealLog {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM:SS or null
  meal_type: MealType | null;
  food_name: string | null;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  memo: string | null;
  created_at?: string;
}

export interface AiChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export const TRAINING_FREQ_LABELS: Record<TrainingFreq, string> = {
  none: '週0回（運動なし）',
  '1-2': '週1〜2回',
  '3-4': '週3〜4回',
  '5+': '週5回以上',
};

export const PERIOD_LABELS: Record<Period, string> = {
  '1mo': '1ヶ月',
  '3mo': '3ヶ月',
  '6mo': '半年',
  '1yr': '1年',
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: '男性',
  female: '女性',
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '朝食',
  lunch: '昼食',
  dinner: '夕食',
  snack: '間食',
  pre_workout: '運動前',
  post_workout: '運動後',
};

export const MEAL_TYPE_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '🌞',
  dinner: '🌙',
  snack: '🍪',
  pre_workout: '💪',
  post_workout: '🏋️',
};

// =================
// 体重・コンディション
// =================
export type Bowel = 'none' | 'soft' | 'normal' | 'firm' | 'diarrhea';

export interface DailyLog {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  weight_kg: number | null;
  body_fat_pct: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null; // 1..5
  fatigue: number | null; // 1..5
  mood: number | null; // 1..5
  bowel: Bowel | null;
  memo: string | null;
  custom_fields: Record<string, string | number | boolean> | null;
  created_at?: string;
  updated_at?: string;
}

export const BOWEL_LABELS: Record<Bowel, string> = {
  none: 'なし',
  soft: '軟',
  normal: '普通',
  firm: '硬',
  diarrhea: '下痢',
};

export const QUALITY_LABELS: Record<number, string> = {
  1: '最悪',
  2: '悪い',
  3: '普通',
  4: '良い',
  5: '最高',
};

export const FATIGUE_LABELS: Record<number, string> = {
  1: 'とても元気',
  2: '元気',
  3: '普通',
  4: '疲れ',
  5: 'とても疲れ',
};

// =================
// 家計簿
// =================
export type TxKind = 'income' | 'expense';

export interface Transaction {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  kind: TxKind;
  category: string;
  amount: number;
  memo: string | null;
  created_at?: string;
}

export const TX_KIND_LABELS: Record<TxKind, string> = {
  income: '収入',
  expense: '支出',
};

// よく使われるカテゴリ候補
export const INCOME_CATEGORIES = ['給与', '副業', '臨時', 'その他'] as const;
export const EXPENSE_CATEGORIES = [
  '食費',
  '外食',
  '日用品',
  '住居',
  '光熱費',
  '通信',
  '交通',
  '医療・健康',
  '教養娯楽',
  '衣服',
  'サプリ・プロテイン',
  'ジム',
  'サブスク',
  '交際',
  'その他',
] as const;

// =================
// 固定費
// =================
export interface RecurringExpense {
  id: string;
  user_id: string;
  name: string;
  category: string;
  amount: number;
  billing_day: number; // 1-31
  purpose: string | null;
  start_month: string; // YYYY-MM
  end_month: string | null; // YYYY-MM, null = 無期限
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
