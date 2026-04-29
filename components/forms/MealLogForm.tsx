'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { addMealAction } from '@/app/actions/meal';

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function MealLogForm() {
  const [state, formAction, pending] = useActionState(addMealAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [date, setDate] = useState<string>(todayLocal());

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      formRef.current?.reset();
      setDate(todayLocal());
    }
  }, [state]);

  return (
    <form action={formAction} ref={formRef} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">日付</label>
        <input
          type="date"
          name="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white"
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
          placeholder="朝食・昼食など"
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
        {pending ? '保存中...' : '記録を保存'}
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
