'use client';

import { Dumbbell } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction } from '@/app/actions/auth';

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <div className="py-8">
      <div className="sport-card-strong mb-5 p-5">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#a3ff12] text-[#061006]">
          <Dumbbell size={22} />
        </div>
        <div className="sport-kicker">Welcome back</div>
        <h1 className="mt-1 text-3xl font-black">ログイン</h1>
      </div>
      <form action={formAction} className="sport-card space-y-4 p-4">
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
          className="sport-button-primary h-12 w-full"
        >
          {pending ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        アカウントをお持ちでない方は{' '}
        <Link href="/signup" className="text-blue-600 underline">
          新規登録
        </Link>
      </p>
    </div>
  );
}
