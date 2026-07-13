import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { VIVY_MODEL_FAST } from '@/lib/ai';

export const maxDuration = 30;

// Applies a spoken correction to a dictated draft ("make it 300 not 200").
// Session-authed by the proxy like every other /api route.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const draft = String(body?.draft ?? '').trim();
  const instruction = String(body?.instruction ?? '').trim();
  if (!draft || !instruction) {
    return NextResponse.json({ error: 'draft and instruction required' }, { status: 400 });
  }

  const { text } = await generateText({
    model: VIVY_MODEL_FAST,
    system:
      'You fix dictated message drafts. Apply the spoken correction to the draft and ' +
      'return ONLY the corrected draft text — no quotes, no commentary. If the ' +
      'correction is unclear, return the draft unchanged.',
    prompt: `Draft: ${draft}\nSpoken correction: ${instruction}`,
  });

  return NextResponse.json({ draft: text.trim() || draft });
}
