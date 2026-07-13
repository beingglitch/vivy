import { desc } from 'drizzle-orm';
import { db, chatMessages } from '@/lib/db';
import { Chat } from './chat';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const rows = await db
    .select()
    .from(chatMessages)
    .orderBy(desc(chatMessages.createdAt))
    .limit(60);

  const history = rows.reverse().map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    text: m.content,
  }));

  return <Chat history={history} />;
}
