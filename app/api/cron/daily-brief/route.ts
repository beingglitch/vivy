import { NextRequest, NextResponse } from 'next/server';
import { generateDailyBrief } from '@/lib/ai/daily-brief';
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

// Morning cron: drain the event queue first (so freshly extracted tasks make
// today's plan), then write the one brief for today. Re-running regenerates it.
export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const processed = await processEvents().catch((err) => ({
    error: err instanceof Error ? err.message : String(err),
  }));
  const brief = await generateDailyBrief();
  return NextResponse.json({ ok: true, processed, ...brief });
}
