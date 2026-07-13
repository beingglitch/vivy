import { NextResponse } from 'next/server';
import { sendPushToAll } from '@/lib/notify';

// "Send a test" button on /settings — proves the whole pipe end to end.
export async function POST() {
  const result = await sendPushToAll({
    title: 'Vivy',
    body: 'Push works. I can reach you here now.',
    url: '/notifications',
  });
  return NextResponse.json(result);
}
