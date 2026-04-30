'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { addTransactionAction } from '@/app/actions/transaction';
import { dateInJST } from '@/lib/date';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type TxKind } from '@/lib/types';

export default function TransactionForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    addTransactionAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const [kind, setKind] = useState<TxKind>('expense');
  const [date, setDate] = useState(dateInJST());
  const [category, setCategory] = useState('食費');

  const categories = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  useEffect(() => {
    // 種別切り替え時、現在のカテゴリが対応リストにない場合はリセット
    if (!(categories as readonly string[]).includes(category)) {
      setCategory(categories[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      formRef.current?.reset();
      setDate(dateInJST());
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} ref={formRef} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="category" value={category} />

      {/* 種別 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setKind('expense')}
          className={`h-12 rounded-xl border font-medium ${
            kind === 'expense'
              ? 'bg-rose-600 text-white border-rose-600'
              : 'bg-white border-gray-300 text-gray-700'
          }`}
        >
          支出
        </button>
        <button
          type="button"
          onClick={() => setKind('income')}
          className={`h-12 rounded-xl border font-medium ${
            kind === 'income'
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white border-gray-300 text-gray-700'
          }`}
        >
          収入
        </button>
      </div>

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
          <label className="block text-sm font-medium mb-1">
            金額 <span className="text-gray-500">(円)</span>
          </label>
          <input
            type="number"
            name="amount"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={0}
            className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white text-lg"
          />
        </div>
      </div>

      {/* カテゴリ */}
      <div>
        <label className="block text-sm font-medium mb-2">カテゴリ</label>
        <div className="grid grid-cols-3 gap-1.5">
          {categories.map((c) => (
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

      {/* メモ */}
      <div>
        <label className="block text-sm font-medium mb-1">メモ（任意）</label>
        <input
          type="text"
          name="memo"
          maxLength={200}
          placeholder="例: スーパーまとめ買い、ジム月会費"
          className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white"
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
        {pending ? '保存中...' : '記録'}
      </button>
    </form>
  );
}
