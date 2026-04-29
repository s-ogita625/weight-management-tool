import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

export default async function Home() {
  const userId = await getSessionUserId();

  if (!userId) {
    return (
      <div className="py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
          体重管理ツール
        </h1>
        <p className="text-gray-600 leading-relaxed mb-6">
          身体データと目標から、エビデンスに基づいた食事プラン（カロリー・PFC栄養）を算出します。
          <br />
          科学的に検証された Mifflin-St Jeor 式と Katch-McArdle 式の両方を比較表示。
        </p>
        <ul className="space-y-2 text-sm text-gray-700 mb-8 bg-white rounded-xl p-4 border border-gray-200">
          <li>✓ 1ヶ月／3ヶ月／半年／1年から期間選択</li>
          <li>✓ 筋トレ頻度を考慮した活動代謝量算出</li>
          <li>✓ ISSN・ACSM 推奨マクロ配分</li>
          <li>✓ 日々の食事記録と履歴管理</li>
          <li>✓ スマホ最適化UI</li>
        </ul>
        <div className="flex flex-col gap-3">
          <Link
            href="/signup"
            className="h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
          >
            新規登録ではじめる
          </Link>
          <Link
            href="/login"
            className="h-12 flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold rounded-xl"
          >
            ログイン
          </Link>
        </div>
      </div>
    );
  }

  const rows = (await sql`
    select 1 from profiles where user_id = ${userId} limit 1
  `) as unknown[];

  redirect(rows.length > 0 ? '/plan' : '/onboarding');
}
