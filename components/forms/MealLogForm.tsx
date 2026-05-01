'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { addMealAction, type MealSuggestion } from '@/app/actions/meal';
import MealSuggestPicker from '@/components/forms/MealSuggestPicker';
import { dateInJST, timeInJST } from '@/lib/date';
import { MEAL_TYPE_ICONS, MEAL_TYPE_LABELS, type MealType } from '@/lib/types';

function suggestMealType(): MealType {
  const h = Number(timeInJST().slice(0, 2));
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

function fmtNum(n: number): string {
  // 整数なら整数、小数があれば小数1桁まで
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 10) / 10);
}

export default function MealLogForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(addMealAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  const [date, setDate] = useState<string>(dateInJST());
  const [time, setTime] = useState<string>(timeInJST());
  const [mealType, setMealType] = useState<MealType>(suggestMealType());
  const [foodName, setFoodName] = useState<string>('');
  const [calories, setCalories] = useState<string>('0');
  const [protein, setProtein] = useState<string>('0');
  const [fat, setFat] = useState<string>('0');
  const [carbs, setCarbs] = useState<string>('0');
  const [memo, setMemo] = useState<string>('');
  const [appliedFromSuggestion, setAppliedFromSuggestion] = useState<
    string | null
  >(null);

  const resetForm = () => {
    setDate(dateInJST());
    setTime(timeInJST());
    setMealType(suggestMealType());
    setFoodName('');
    setCalories('0');
    setProtein('0');
    setFat('0');
    setCarbs('0');
    setMemo('');
    setAppliedFromSuggestion(null);
  };

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      formRef.current?.reset();
      resetForm();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handlePickSuggestion = (s: MealSuggestion) => {
    setFoodName(s.food_name);
    setCalories(fmtNum(s.calories));
    setProtein(fmtNum(s.protein_g));
    setFat(fmtNum(s.fat_g));
    setCarbs(fmtNum(s.carbs_g));
    if (s.last_meal_type) {
      setMealType(s.last_meal_type as MealType);
    }
    setAppliedFromSuggestion(s.food_name);
  };

  return (
    <form action={formAction} ref={formRef} className="space-y-4">
      <input type="hidden" name="meal_type" value={mealType} />

      <MealSuggestPicker onPick={handlePickSuggestion} />

      {appliedFromSuggestion && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-700 flex items-center justify-between">
          <span>
            ✓「{appliedFromSuggestion}」の値を反映しました（必要なら編集してください）
          </span>
          <button
            type="button"
            onClick={() => {
              setFoodName('');
              setCalories('0');
              setProtein('0');
              setFat('0');
              setCarbs('0');
              setAppliedFromSuggestion(null);
            }}
            className="text-blue-600 underline whitespace-nowrap ml-2"
          >
            クリア
          </button>
        </div>
      )}

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
          onChange={(e) => {
            setFoodName(e.target.value);
            setAppliedFromSuggestion(null);
          }}
          placeholder="例: 鶏むね肉と玄米、プロテインシェイク"
          className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white"
          maxLength={100}
        />
      </div>

      <NF
        label="カロリー"
        suffix="kcal"
        name="calories"
        value={calories}
        onChange={setCalories}
      />
      <NF
        label="タンパク質"
        suffix="g"
        name="protein_g"
        value={protein}
        onChange={setProtein}
      />
      <NF
        label="脂質"
        suffix="g"
        name="fat_g"
        value={fat}
        onChange={setFat}
      />
      <NF
        label="炭水化物"
        suffix="g"
        name="carbs_g"
        value={carbs}
        onChange={setCarbs}
      />

      <div>
        <label className="block text-sm font-medium mb-1">メモ（任意）</label>
        <textarea
          name="memo"
          rows={2}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
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
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          // 0 のときはタップ時に消す（入力しやすく）
          if (e.target.value === '0') onChange('');
        }}
        onBlur={(e) => {
          if (e.target.value === '') onChange('0');
        }}
        className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white text-lg"
      />
    </div>
  );
}
