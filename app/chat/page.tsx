import { redirect } from 'next/navigation';
import ChatView from '@/components/ai/ChatView';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import type { AiChatMessage } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const rows = (await sql`
    select id, user_id, role, content, created_at
    from ai_chat_messages
    where user_id = ${userId}
    order by created_at asc
    limit 100
  `) as AiChatMessage[];

  return (
    <div className="py-4 space-y-3">
      <h1 className="text-2xl font-bold">AIに質問</h1>
      <p className="text-sm text-gray-600">
        体・食事・筋トレに関する質問にAIが専門的にお答えします。
      </p>
      <ChatView initial={rows} />
    </div>
  );
}
