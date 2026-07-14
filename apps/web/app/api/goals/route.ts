import { NextRequest, NextResponse } from 'next/server';
import { db, goals } from '@/lib/db';
import { activeGoalsProgress, GOAL_KINDS, METRICS, readMetric, type MetricKey } from '@/lib/goals';

export async function GET() {
  const progress = await activeGoalsProgress();
  return NextResponse.json({
    goals: progress.map((p) => ({
      ...p.goal,
      current: p.current,
      fraction: p.fraction,
      onPace: p.onPace,
      line: p.line,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 });
  const kind = GOAL_KINDS.includes(body.kind) ? body.kind : 'custom';
  const metric: MetricKey | null = body.metric && body.metric in METRICS ? body.metric : null;
  const target =
    Number.isFinite(Number(body.target)) && body.target !== '' ? String(Number(body.target)) : null;
  if (metric && target === null) {
    return NextResponse.json({ error: 'a measured goal needs a target number' }, { status: 400 });
  }

  // Baseline the metric NOW — pace is measured from here, never typed in.
  const startValue = metric ? String(await readMetric(metric)) : null;

  const [row] = await db
    .insert(goals)
    .values({
      title: body.title.trim(),
      kind,
      metric,
      target,
      startValue,
      deadline: typeof body.deadline === 'string' && body.deadline ? body.deadline : null,
      note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
    })
    .returning();
  return NextResponse.json({ goal: row });
}
