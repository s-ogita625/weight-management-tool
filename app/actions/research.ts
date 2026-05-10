'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function toggleFavoriteAction(id: string) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  await sql`
    update research_articles
    set is_favorite = not is_favorite,
        expires_at = case
          when not is_favorite then now() + interval '365 days'
          else now() + interval '7 days'
        end
    where id = ${id} and user_id = ${userId}
  `;
  revalidatePath('/research');
}

export async function deleteResearchAction(id: string) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  await sql`
    delete from research_articles where id = ${id} and user_id = ${userId}
  `;
  revalidatePath('/research');
}
