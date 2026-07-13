import { NextRequest, NextResponse } from 'next/server';
import { db, settings } from '@/lib/db';
import { getProfile } from '@/lib/settings';

export async function GET() {
  return NextResponse.json({ profile: await getProfile() });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const allowed = ['name', 'dob'] as const;
  for (const key of allowed) {
    if (body[key] === undefined) continue;
    const value = String(body[key]).trim();
    if (key === 'dob' && value && isNaN(new Date(value + 'T00:00:00').getTime())) {
      return NextResponse.json({ error: 'dob must be YYYY-MM-DD' }, { status: 400 });
    }
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  }
  return NextResponse.json({ profile: await getProfile() });
}
