'use client';

import { Zap } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';
import { signupAction } from '@/app/actions/auth';

export default function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, null);

  return (
    <div className="py-8">
      <div className="sport-card-strong mb-5 p-5">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#a3ff12] text-[#061006]">
          <Zap size={22} />
        </div>
        <div className="sport-kicker">Start tracking</div>
        <h1 className="mt-1 text-3xl font-black">新規登録</h1>
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
          className="sport-button-primary h-12 w-full"
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
