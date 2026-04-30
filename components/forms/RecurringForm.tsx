'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import {
  addRecurringAction,
  updateRecurringAction,
} from '@/app/actions/recurring';
import { dateInJST } from '@/lib/date';
import { EXPENSE_CATEGORIES, type RecurringExpense } from '@/lib/types';

interface Props {
  initial?: RecurringExpense | null;
  /** 保存後のコールバック（モーダル閉じ用） */
  onDone?: () => void;
}

function currentYM(): string {
  return dateInJST().slice(0, 7);
}

export default function RecurringForm({ initial, onDone }: Props) {
  const router = useRouter();
  const isEdit = !!initial;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateRecurringAction : addRecurringAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? '住居');
  const [amount, setAmount] = useState(
    initial?.amount !== undefined ? String(initial.amount) : '',
  );
  const [billingDay, setBillingDay] = useState(
    initial?.billing_day ? String(initial.billing_day) : '27',
  );
  const [purpose, setPurpose] = useState(initial?.purpose ?? '');
  const [startMonth, setStartMonth] = useState(
    initial?.start_month ?? currentYM(),
  );
  const [endMonth, setEndMonth] = useState(initial?.end_month ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      if (!isEdit) {
        formRef.current?.reset();
        setName('');
        setAmount('');
        setPurpose('');
        setEndMonth('');
      }
      router.refresh();
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} ref={formRef} className="space-y-4">
      {isEdit && initial && (
        <input type="hidden" name="id" value={initial.id} />
      )}

      {/* 名前 */}
      <div>
        <label className="block text-sm font-medium mb-1">名称</label>
        <input
          type="text"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 家賃 / Spotify / ジム月会費"
          maxLength={60}
          required
          className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white"
        />
      </div>

      {/* カテゴリ */}
      <div>
        <label className="block text-sm font-medium mb-2">カテゴリ</label>
        <input type="hidden" name="category" value={category} />
        <div className="grid grid-cols-3 gap-1.5">
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`h-10 rounded-lg border text-xs font-medium ${
                category === c
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 金額 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            金額 <span className="text-gray-500">(円)</span>
          </label>
          <input
            type="number"
            name="amount"
            inputMode="numeric"
            min={0}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white text-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">請求日</label>
          <select
            name="billing_day"
            value={billingDay}
            onChange={(e) => setBillingDay(e.target.value)}
            className="w-full h-12 px-3 rounded-xl border border-gray-300 bg-white"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}日
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 用途・メモ */}
      <div>
        <label className="block text-sm font-medium mb-1">
          用途・メモ <span className="text-gray-500">(何に使っているか)</span>
        </label>
        <textarea
          name="purpose"
          rows={2}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="例: 家族との共有用 / トレーニング動画視聴 / 経理事務スタッフ向け"
          maxLength={200}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white"
        />
      </div>

      {/* 有効期間 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">開始月</label>
          <input
            type="month"
            name="start_month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            required
            className="w-full h-12 px-3 rounded-xl border border-gray-300 bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            終了月 <span className="text-gray-500">(任意)</span>
          </label>
          <input
            type="month"
            name="end_month"
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            className="w-full h-12 px-3 rounded-xl border border-gray-300 bg-white"
          />
        </div>
      </div>

      {/* 有効/無効スイッチ */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="w-5 h-5"
        />
        <span>有効（オフにすると集計から除外）</span>
      </label>

      {state && 'error' in state && state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state && 'ok' in state && state.ok && (
        <p className="text-sm text-green-700">
          {isEdit ? '更新しました ✓' : '登録しました ✓'}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl"
      >
        {pending ? '保存中...' : isEdit ? '更新' : '登録'}
      </button>
    </form>
  );
}
