'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { addMealAction, type MealSuggestion } from '@/app/actions/meal';
import AiMealEstimator, {
  type AiEstimate,
} from '@/components/forms/AiMealEstimator';
import MealSuggestPicker from '@/components/forms/MealSuggestPicker';
import { dateInJST } from '@/lib/date';

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
  const [foodName, setFoodName] = useState<string>('');
  const [calories, setCalories] = useState<string>('0');
  const [protein, setProtein] = useState<string>('0');
  const [fat, setFat] = useState<string>('0');
  const [carbs, setCarbs] = useState<string>('0');
  const [appliedFromSuggestion, setAppliedFromSuggestion] = useState<
    string | null
  >(null);

  const resetForm = () => {
    setDate(dateInJST());
    setFoodName('');
    setCalories('0');
    setProtein('0');
    setFat('0');
    setCarbs('0');
    setAppliedFromSuggestion(null);
  };

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      formRef.current?.reset();
      window.setTimeout(() => {
        resetForm();
        router.refresh();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handlePickSuggestion = (s: MealSuggestion) => {
    setFoodName(s.food_name);
    setCalories(fmtNum(s.calories));
    setProtein(fmtNum(s.protein_g));
    setFat(fmtNum(s.fat_g));
    setCarbs(fmtNum(s.carbs_g));
    setAppliedFromSuggestion(s.food_name);
  };

  const handleAiEstimate = (e: AiEstimate) => {
    setFoodName(e.food_name);
    setCalories(fmtNum(e.calories));
    setProtein(fmtNum(e.protein_g));
    setFat(fmtNum(e.fat_g));
    setCarbs(fmtNum(e.carbs_g));
    setAppliedFromSuggestion(`AI推定: ${e.food_name}`);
  };

  return (
    <form action={formAction} ref={formRef} className="space-y-4">
      <div className="grid grid-cols-1 gap-2">
        <AiMealEstimator onApply={handleAiEstimate} />
        <MealSuggestPicker onPick={handlePickSuggestion} />
      </div>

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

      <div className="grid grid-cols-2 gap-3">
        <NF label="カロリー" suffix="kcal" name="calories" value={calories} onChange={setCalories} />
        <NF label="タンパク質 P" suffix="g" name="protein_g" value={protein} onChange={setProtein} />
        <NF label="脂質 F" suffix="g" name="fat_g" value={fat} onChange={setFat} />
        <NF label="炭水化物 C" suffix="g" name="carbs_g" value={carbs} onChange={setCarbs} />
      </div>
      <p className="-mt-2 text-xs text-gray-500">
        カロリーを空欄（0）にすると、PFC から自動で計算します。
      </p>

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
