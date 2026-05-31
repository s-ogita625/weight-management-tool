'use client';

import { useRouter } from 'next/navigation';
import type { ComponentType } from 'react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Coffee, Droplets, GlassWater, Plus, Minus, Sparkles } from 'lucide-react';
import { addHydrationAction } from '@/app/actions/hydration';
import { dateInJST, timeInJST } from '@/lib/date';
import {
  HYDRATION_DRINK_LABELS,
  type HydrationDrinkType,
} from '@/lib/types';

const DRINK_TYPES: Array<{
  type: HydrationDrinkType;
  icon: ComponentType<{ size?: number; className?: string }>;
  hint: string;
}> = [
  { type: 'water', icon: Droplets, hint: '基本' },
  { type: 'protein', icon: GlassWater, hint: '補給' },
  { type: 'coffee', icon: Coffee, hint: 'カフェイン' },
  { type: 'other', icon: Sparkles, hint: 'その他' },
];

const QUICK_AMOUNTS = [200, 300, 500, 700];

export default function HydrationLogForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(addHydrationAction, null);
  const [date, setDate] = useState(dateInJST());
  const [time, setTime] = useState(timeInJST());
  const [drinkType, setDrinkType] = useState<HydrationDrinkType>('water');
  const [amount, setAmount] = useState(300);
  const [memo, setMemo] = useState('');

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      formRef.current?.reset();
      window.setTimeout(() => {
        setDate(dateInJST());
        setTime(timeInJST());
        setDrinkType('water');
        setAmount(300);
        setMemo('');
        router.refresh();
      }, 0);
    }
  }, [router, state]);

  const stepAmount = (diff: number) => {
    setAmount((prev) => Math.min(3000, Math.max(100, prev + diff)));
  };

  return (
    <form
      id="hydration"
      action={formAction}
      ref={formRef}
      className="sport-card space-y-4 p-4"
    >
      <input type="hidden" name="drink_type" value={drinkType} />
      <input type="hidden" name="amount_ml" value={amount} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="sport-kicker">Hydration log</div>
          <h2 className="mt-1 text-lg font-black">水分補給を記録</h2>
        </div>
        <div className="rounded-lg border border-[#20e0ff]/30 bg-[#20e0ff]/10 px-2 py-1 text-xs font-bold text-[#7af7ff]">
          100ml単位
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-400">
            日付
          </span>
          <input
            type="date"
            name="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="sport-input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-400">
            時刻
          </span>
          <input
            type="time"
            name="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="sport-input"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {DRINK_TYPES.map(({ type, icon: Icon, hint }) => {
          const active = drinkType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setDrinkType(type)}
              className={`rounded-lg border p-3 text-left transition active:scale-[0.99] ${
                active
                  ? 'border-[#a3ff12]/70 bg-[#a3ff12]/14 text-white shadow-[0_0_22px_rgba(163,255,18,0.13)]'
                  : 'border-white/10 bg-black/20 text-slate-300'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <Icon
                  size={20}
                  className={active ? 'text-[#a3ff12]' : 'text-slate-400'}
                />
                <span className="text-[10px] font-bold text-slate-500">
                  {hint}
                </span>
              </div>
              <div className="text-sm font-black">
                {HYDRATION_DRINK_LABELS[type]}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => stepAmount(-100)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 text-slate-200"
            aria-label="100ml減らす"
          >
            <Minus size={18} />
          </button>
          <div className="text-center">
            <div className="text-4xl font-black tabular-nums text-white">
              {amount}
              <span className="ml-1 text-sm text-slate-400">ml</span>
            </div>
            <div className="text-xs font-semibold text-slate-500">
              {(amount / 1000).toFixed(1)}L
            </div>
          </div>
          <button
            type="button"
            onClick={() => stepAmount(100)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#a3ff12]/40 bg-[#a3ff12]/10 text-[#a3ff12]"
            aria-label="100ml増やす"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {QUICK_AMOUNTS.map((ml) => (
            <button
              key={ml}
              type="button"
              onClick={() => setAmount(ml)}
              className={`h-10 rounded-lg border text-sm font-bold tabular-nums ${
                amount === ml
                  ? 'border-[#20e0ff]/70 bg-[#20e0ff]/16 text-[#7af7ff]'
                  : 'border-white/10 bg-white/[0.035] text-slate-300'
              }`}
            >
              {ml}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-400">
          メモ（任意）
        </span>
        <input
          type="text"
          name="memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="例: トレ前、外出中、塩分多めの日など"
          className="sport-input"
          maxLength={160}
        />
      </label>

      {state && 'error' in state && state.error && (
        <p className="text-sm font-semibold text-rose-300">{state.error}</p>
      )}
      {state && 'ok' in state && state.ok && (
        <p className="text-sm font-semibold text-[#a3ff12]">記録しました</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="sport-button-primary flex h-12 w-full items-center justify-center gap-2"
      >
        <Droplets size={18} />
        {pending ? '保存中...' : '水分を記録'}
      </button>
    </form>
  );
}
