'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  GENDER_LABELS,
  PERIOD_LABELS,
  TRAINING_FREQ_LABELS,
  type Gender,
  type Period,
  type Profile,
  type TrainingFreq,
} from '@/lib/types';

interface Props {
  initial?: Profile | null;
}

export default function ProfileForm({ initial }: Props) {
  const router = useRouter();
  const [age, setAge] = useState<number>(initial?.age ?? 30);
  const [gender, setGender] = useState<Gender>(initial?.gender ?? 'male');
  const [heightCm, setHeightCm] = useState<number>(initial?.height_cm ?? 170);
  const [weightKg, setWeightKg] = useState<number>(
    initial?.current_weight_kg ?? 65,
  );
  const [bodyFatPct, setBodyFatPct] = useState<number>(
    initial?.body_fat_pct ?? 20,
  );
  const [trainingFreq, setTrainingFreq] = useState<TrainingFreq>(
    initial?.training_freq ?? '1-2',
  );
  const [targetWeightKg, setTargetWeightKg] = useState<number>(
    initial?.target_weight_kg ?? 60,
  );
  const [targetBodyFatPct, setTargetBodyFatPct] = useState<number>(
    initial?.target_body_fat_pct ?? 15,
  );
  const [period, setPeriod] = useState<Period>(initial?.target_period ?? '3mo');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
    const payload = {
      user_id: user.id,
      height_cm: heightCm,
      gender,
      age,
      current_weight_kg: weightKg,
      body_fat_pct: bodyFatPct,
      training_freq: trainingFreq,
      target_weight_kg: targetWeightKg,
      target_body_fat_pct: targetBodyFatPct,
      target_period: period,
    };
    const { error } = await supabase.from('profiles').upsert(payload);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/plan');
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* 性別 */}
      <div>
        <label className="block text-sm font-medium mb-2">性別</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(GENDER_LABELS) as Gender[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={`h-12 rounded-xl border font-medium ${
                gender === g
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {GENDER_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      {/* 年齢 */}
      <NumberField
        label="年齢"
        value={age}
        onChange={setAge}
        min={10}
        max={100}
        suffix="歳"
      />

      {/* 身長 */}
      <NumberField
        label="身長"
        value={heightCm}
        onChange={setHeightCm}
        min={100}
        max={250}
        step={0.1}
        suffix="cm"
      />

      {/* 現在の体重 */}
      <NumberField
        label="現在の体重"
        value={weightKg}
        onChange={setWeightKg}
        min={30}
        max={300}
        step={0.1}
        suffix="kg"
      />

      {/* 現在の体脂肪率 */}
      <NumberField
        label="現在の体脂肪率"
        value={bodyFatPct}
        onChange={setBodyFatPct}
        min={3}
        max={60}
        step={0.1}
        suffix="%"
      />

      {/* 筋トレ頻度 */}
      <div>
        <label className="block text-sm font-medium mb-2">筋トレ頻度</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(TRAINING_FREQ_LABELS) as TrainingFreq[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setTrainingFreq(f)}
              className={`h-12 rounded-xl border text-sm font-medium ${
                trainingFreq === f
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {TRAINING_FREQ_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* 目標体重 */}
      <NumberField
        label="目標体重"
        value={targetWeightKg}
        onChange={setTargetWeightKg}
        min={30}
        max={300}
        step={0.1}
        suffix="kg"
      />

      {/* 目標体脂肪率 */}
      <NumberField
        label="目標体脂肪率"
        value={targetBodyFatPct}
        onChange={setTargetBodyFatPct}
        min={3}
        max={60}
        step={0.1}
        suffix="%"
      />

      {/* 期間 */}
      <div>
        <label className="block text-sm font-medium mb-2">達成期間</label>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`h-12 rounded-xl border text-sm font-medium ${
                period === p
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl"
      >
        {loading ? '保存中...' : '保存して食事プランを見る'}
      </button>
    </form>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}
        {suffix && <span className="text-gray-500 ml-1">({suffix})</span>}
      </label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white text-lg"
      />
    </div>
  );
}
