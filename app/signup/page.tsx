'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signupAction } from '@/app/actions/auth';

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupAction, null);

  return (
    <div className="py-8">
      <h1 className="text-2xl font-bold mb-6">新規登録</h1>
      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">メールアドレス</label>
          <input
            type="email"
            name="email"
            required
            className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            パスワード（6文字以上）
          </label>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white"
            autoComplete="new-password"
          />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl"
        >
          {pending ? '登録中...' : '新規登録'}
        </button>
      </form>
      <p className="text-sm text-gray-600 mt-6 text-center">
        すでにアカウントをお持ちの方は{' '}
        <Link href="/login" className="text-blue-600 underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}
