import { NextRequest, NextResponse } from 'next/server';
import { generatePlan, planContext } from '@/lib/ai/planner';

export async function GET() {
  const ctx = await planContext();
  return NextResponse.json(ctx);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const intent = typeof body.intent === 'string' ? body.intent.trim() : '';
  const plan = await generatePlan(intent);
  return NextResponse.json({ plan });
}
