import { NextRequest, NextResponse } from 'next/server';
import { processEvents } from '@/lib/ai/process-events';
import { verifySessionValue, SESSION_COOKIE } from '@/lib/auth';

export const maxDuration = 300;

async function authorized(req: NextRequest): Promise<boolean> {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (bearer && bearer === process.env.CRON_SECRET) return true;
  const key = req.headers.get('x-vivy-key');
  if (key && key === process.env.VIVY_INGEST_KEY) return true;
  return verifySessionValue(req.cookies.get(SESSION_COOKIE)?.value);
}

// Drain the unprocessed-events queue: text events → AI task extraction,
// everything else just marked processed. Idempotent; retries failures next run.
export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await processEvents();
  return NextResponse.json({ ok: true, ...result });
}
