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
