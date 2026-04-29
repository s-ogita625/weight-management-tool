'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { addMealAction } from '@/app/actions/meal';
import { MEAL_TYPE_ICONS, MEAL_TYPE_LABELS, type MealType } from '@/lib/types';

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function suggestMealType(): MealType {
  const h = new Date().getHours();
  if (h >= 5 && h < 10) return 'breakfast';
  if (h >= 10 && h < 14) return 'lunch';
  if (h >= 14 && h < 17) return 'snack';
  if (h >= 17 && h < 22) return 'dinner';
  return 'snack';
}

const MEAL_TYPES: MealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'pre_workout',
  'post_workout',
];

export default function MealLogForm() {
  const [state, formAction, pending] = useActionState(addMealAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  const [date, setDate] = useState<string>(todayLocal());
  const [time, setTime] = useState<string>(nowHHMM());
  const [mealType, setMealType] = useState<MealType>(suggestMealType());
  const [foodName, setFoodName] = useState<string>('');

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      formRef.current?.reset();
      setDate(todayLocal());
      setTime(nowHHMM());
      setMealType(suggestMealType());
      setFoodName('');
    }
  }, [state]);

  return (
    <form action={formAction} ref={formRef} className="space-y-4">
      <input type="hidden" name="meal_type" value={mealType} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">日付</label>
          <input
            type="date"
            name="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-12 px-3 rounded-xl border border-gray-300 bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">時刻</label>
          <input
            type="time"
            name="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full h-12 px-3 rounded-xl border border-gray-300 bg-white"
          />
        </div>
      </div>

      {/* 食事区分 */}
      <div>
        <label className="block text-sm font-medium mb-2">食事区分</label>
        <div className="grid grid-cols-3 gap-2">
          {MEAL_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMealType(t)}
              className={`h-12 rounded-xl border text-sm font-medium ${
                mealType === t
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              <span className="mr-1">{MEAL_TYPE_ICONS[t]}</span>
              {MEAL_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* 料理名 */}
      <div>
        <label className="block text-sm font-medium mb-1">
          料理名 <span className="text-gray-500">(任意)</span>
        </label>
        <input
          type="text"
          name="food_name"
          value={foodName}
          onChange={(e) => setFoodName(e.target.value)}
          placeholder="例: 鶏むね肉と玄米、プロテインシェイク"
          className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white"
          maxLength={100}
        />
      </div>

      <NF label="カロリー" suffix="kcal" name="calories" />
      <NF label="タンパク質" suffix="g" name="protein_g" />
      <NF label="脂質" suffix="g" name="fat_g" />
      <NF label="炭水化物" suffix="g" name="carbs_g" />

      <div>
        <label className="block text-sm font-medium mb-1">メモ（任意）</label>
        <textarea
          name="memo"
          rows={2}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white"
          placeholder="満腹度、気分、補足など"
        />
      </div>

      {state && 'error' in state && state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state && 'ok' in state && state.ok && (
        <p className="text-sm text-green-700">記録しました ✓</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl"
      >
        {pending ? '保存中...' : 'この食事を記録'}
      </button>
    </form>
  );
}

function NF({
  label,
  suffix,
  name,
}: {
  label: string;
  suffix: string;
  name: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label} <span className="text-gray-500">({suffix})</span>
      </label>
      <input
        type="number"
        name={name}
        inputMode="decimal"
        min={0}
        step={0.1}
        defaultValue={0}
        className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white text-lg"
      />
    </div>
  );
}
