import { NextRequest, NextResponse } from 'next/server';
import { middaySpendCheck } from '@/lib/notify';
import { verifySessionValue, SESSION_COOKIE } from '@/lib/auth';

export const maxDuration = 60;

async function authorized(req: NextRequest): Promise<boolean> {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (bearer && bearer === process.env.CRON_SECRET) return true;
  return verifySessionValue(req.cookies.get(SESSION_COOKIE)?.value);
}

// 14:00 IST — overspend check.
export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await middaySpendCheck();
  return NextResponse.json({ ok: true, ...result });
}
