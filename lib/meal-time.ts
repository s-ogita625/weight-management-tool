import type { MealType } from '@/lib/types';

/** 時刻 (HH:MM) から食事区分を推定する */
export function inferMealType(hhmm: string): MealType {
  const hour = Number(hhmm.slice(0, 2));
  if (hour >= 4 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 15) return 'lunch';
  if (hour >= 17 && hour < 23) return 'dinner';
  return 'snack';
}
