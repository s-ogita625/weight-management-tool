import { redirect } from 'next/navigation';
import ResearchPanel from '@/components/research/ResearchPanel';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import type { ResearchArticle } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ResearchPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const rows = (await sql`
    select id, user_id, topic, focus, summary, citations, is_favorite,
           to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
           to_char(expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as expires_at
    from research_articles
    where user_id = ${userId}
    order by is_favorite desc, created_at desc
    limit 30
  `) as unknown as ResearchArticle[];

  return (
    <div className="py-4 space-y-4">
      <h1 className="text-2xl font-bold">📚 文献リサーチ</h1>
      <p className="text-sm text-gray-600">
        ボディメイク・栄養・トレーニングについて、AIがWeb検索で最新の知見をまとめます。
      </p>
      <ResearchPanel history={rows} />
      <div className="text-xs text-gray-400 leading-relaxed">
        ※ AIは情報を要約しますが、引用元のURLを必ず確認してください。リサーチ結果は7日間自動キャッシュ、お気に入り保存で365日保持します。
      </div>
    </div>
  );
}
