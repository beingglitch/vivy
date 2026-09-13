import 'server-only';
import { redirect } from 'next/navigation';
import { currentUserId } from './session';

export async function requirePageUserId(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) redirect('/login');
  return userId;
}
