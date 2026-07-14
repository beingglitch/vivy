import { NextRequest, NextResponse } from 'next/server';
import { authUrl, googleConfigured } from '@/lib/google';

// Kicks off the consent flow. The redirect URI is derived from this request's
// origin, so the same code works on localhost and prod (register both in the
// Google Cloud console).
export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.json(
      { error: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing — see SPEC-0010 user step' },
      { status: 501 },
    );
  }
  const redirectUri = `${req.nextUrl.origin}/api/google/callback`;
  return NextResponse.redirect(authUrl(redirectUri));
}
