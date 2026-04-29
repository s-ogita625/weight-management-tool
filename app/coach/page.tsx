import Link from 'next/link';
import { redirect } from 'next/navigation';
import CoachView from '@/components/ai/CoachView';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function CoachPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const profileRows = (await sql`
    select 1 from profiles where user_id = ${userId} limit 1
  `) as unknown[];

  if (profileRows.length === 0) {
    return (
      <div className="py-8 space-y-4">
        <h1 className="text-2xl font-bold">AIコーチング</h1>
        <p className="text-sm text-gray-600">
          先にプロフィールを入力してください。
        </p>
        <Link
          href="/onboarding"
          className="block h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center"
        >
          プロフィール入力へ
        </Link>
      </div>
    );
  }

  return (
    <div className="py-4 space-y-4">
      <h1 className="text-2xl font-bold">AIコーチング</h1>
      <p className="text-sm text-gray-600">
        食事記録と身体データを踏まえ、AIがあなた専用のアドバイスを生成します。
      </p>
      <CoachView />
    </div>
  );
}
