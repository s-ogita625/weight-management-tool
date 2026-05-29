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

export type Priority = 'fat_loss' | 'muscle_retention' | 'recomposition';

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
  lean_cut_mode?: boolean;
  priority?: Priority;
  created_at?: string;
  updated_at?: string;
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  fat_loss: '体脂肪優先',
  muscle_retention: '筋肉維持優先',
  recomposition: '同時達成（リコンプ）',
};

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
// 筋トレ記録
// =================
export type BodyPart =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'arms'
  | 'triceps'
  | 'core'
  | 'cardio'
  | 'full_body'
  | 'other';

export type WorkoutSetType = 'warmup' | 'working' | 'drop' | 'failure';
export type WorkoutSide = 'both' | 'left' | 'right';

export interface WorkoutSet {
  id: string;
  exercise_id: string;
  set_order: number;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  rir: number | null;
  set_type: WorkoutSetType;
  side: WorkoutSide;
  memo: string | null;
  created_at?: string;
}

export interface WorkoutExercise {
  id: string;
  session_id: string;
  exercise_order: number;
  name: string;
  body_part: BodyPart;
  memo: string | null;
  sets: WorkoutSet[];
  created_at?: string;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  start_time: string | null; // HH:MM or null
  duration_min: number | null;
  main_body_part: BodyPart | null;
  perceived_effort: number | null; // 1..10
  memo: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WorkoutSessionDetail extends WorkoutSession {
  exercises: WorkoutExercise[];
  totalSets: number;
  totalVolumeKg: number;
}

export interface WorkoutStats {
  sessionsThisWeek: number;
  sessionsThisMonth: number;
  setsThisWeek: number;
  setsThisMonth: number;
  volumeThisWeekKg: number;
  volumeThisMonthKg: number;
  lastWorkoutDate: string | null;
  restDays: number | null;
  bodyPartSets: Array<{ body_part: BodyPart; sets: number; volumeKg: number }>;
  frequentExercises: Array<{ name: string; body_part: BodyPart; count: number }>;
}

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  chest: '胸',
  back: '背中',
  legs: '脚',
  shoulders: '肩',
  arms: '腕',
  triceps: '三頭',
  core: '体幹',
  cardio: '有酸素',
  full_body: '全身',
  other: 'その他',
};

export const BODY_PART_ICONS: Record<BodyPart, string> = {
  chest: 'CH',
  back: 'BK',
  legs: 'LG',
  shoulders: 'SH',
  arms: 'AR',
  triceps: 'TR',
  core: 'CR',
  cardio: 'CD',
  full_body: 'FB',
  other: 'OT',
};

export const WORKOUT_SET_TYPE_LABELS: Record<WorkoutSetType, string> = {
  warmup: 'ウォームアップ',
  working: 'メイン',
  drop: 'ドロップ',
  failure: '限界',
};

export const WORKOUT_SIDE_LABELS: Record<WorkoutSide, string> = {
  both: '両側',
  left: '左',
  right: '右',
};

// =================
// 文献リサーチ
// =================
export interface ResearchCitation {
  title: string;
  url: string;
}

export interface ResearchArticle {
  id: string;
  user_id: string;
  topic: string;
  focus: string | null;
  summary: string;
  citations: ResearchCitation[];
  is_favorite: boolean;
  created_at: string;
  expires_at: string;
}

export const RESEARCH_PRESET_TOPICS = [
  'リーンカット',
  'タンパク質タイミング',
  'レジスタンストレーニング容量',
  'リフィード／ダイエットブレイク',
  'アナボリックウィンドウ',
  'ボディリコンポジション',
  'ミニカット',
  '睡眠と減量',
] as const;

// =================
// 食事タイミング解析
// =================
export interface MealTimingAnalysis {
  intervalsHours: number[];
  proteinPerMeal: number[];
  leucineThresholdMet: number;
  totalMeals: number;
  distribution: 'even' | 'front-loaded' | 'back-loaded' | 'unknown';
  longestGapHours: number;
  notes: string[];
}

export interface MealTimingAdvice {
  perMealProteinTargetG: number;
  recommendedMealCount: number;
  preWorkout: { hoursBefore: number; carbsG: number; proteinG: number };
  postWorkout: { hoursAfter: number; proteinG: number; carbsG: number };
  notes: string[];
  alerts: string[];
}

// =================
// 深掘り分析
// =================
export interface HistoricalAnalysis {
  windowDays: number;
  caloriesAdherenceMedianPct: number;
  proteinAdherenceMedianPct: number;
  weightSlopeKgPerWeek: number;
  weightSlopeAccelKgPerWeek2: number;
  consistencyScore: number; // 0-100
  weightVolatilityKg: number;
  sleepWeightCorrelation: number | null;
  fatigueAdherenceCorrelation: number | null;
  isPlateau: boolean;
  plateauReason: string | null;
}
