'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction } from '@/app/actions/auth';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <div className="py-8">
      <h1 className="text-2xl font-bold mb-6">ログイン</h1>
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
          <label className="block text-sm font-medium mb-1">パスワード</label>
          <input
            type="password"
            name="password"
            required
            className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white"
            autoComplete="current-password"
          />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl"
        >
          {pending ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
      <p className="text-sm text-gray-600 mt-6 text-center">
        アカウントをお持ちでない方は{' '}
        <Link href="/signup" className="text-blue-600 underline">
          新規登録
        </Link>
      </p>
    </div>
  );
}
