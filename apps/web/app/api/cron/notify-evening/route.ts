import { NextRequest, NextResponse } from 'next/server';
import { eveningReview } from '@/lib/notify';
import { verifySessionValue, SESSION_COOKIE } from '@/lib/auth';

export const maxDuration = 60;

async function authorized(req: NextRequest): Promise<boolean> {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (bearer && bearer === process.env.CRON_SECRET) return true;
  return verifySessionValue(req.cookies.get(SESSION_COOKIE)?.value);
}

// 21:30 IST — evening review + "line up tomorrow" prompt.
export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await eveningReview();
  return NextResponse.json({ ok: true, ...result });
}
