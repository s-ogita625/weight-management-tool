'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function MealLogForm() {
  const router = useRouter();
  const [date, setDate] = useState<string>(todayLocal());
  const [calories, setCalories] = useState<number>(0);
  const [protein, setProtein] = useState<number>(0);
  const [fat, setFat] = useState<number>(0);
  const [carbs, setCarbs] = useState<number>(0);
  const [memo, setMemo] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setCalories(0);
    setProtein(0);
    setFat(0);
    setCarbs(0);
    setMemo('');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError('ログインが必要です');
      setLoading(false);
      return;
    }
    const { error } = await supabase.from('meal_logs').insert({
      user_id: user.id,
      date,
      calories,
      protein_g: protein,
      fat_g: fat,
      carbs_g: carbs,
      memo: memo || null,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo('記録しました ✓');
    reset();
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">日付</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white"
        />
      </div>

      <NF label="カロリー" suffix="kcal" value={calories} onChange={setCalories} />
      <NF label="タンパク質" suffix="g" value={protein} onChange={setProtein} />
      <NF label="脂質" suffix="g" value={fat} onChange={setFat} />
      <NF label="炭水化物" suffix="g" value={carbs} onChange={setCarbs} />

      <div>
        <label className="block text-sm font-medium mb-1">メモ（任意）</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white"
          placeholder="朝食・昼食など"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {info && <p className="text-sm text-green-700">{info}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl"
      >
        {loading ? '保存中...' : '記録を保存'}
      </button>
    </form>
  );
}

function NF({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label} <span className="text-gray-500">({suffix})</span>
      </label>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={0.1}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(isNaN(v) ? 0 : v);
        }}
        className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white text-lg"
      />
    </div>
  );
}
