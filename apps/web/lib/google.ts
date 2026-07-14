import { eq } from 'drizzle-orm';
import { db, connections } from '@/lib/db';

// Google Calendar over plain fetch — the googleapis SDK is ~10MB for the four
// calls we need. Tokens live in the `connections` table (single-user app).

const SCOPES = 'https://www.googleapis.com/auth/calendar.events openid email';

function creds() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set');
  return { id, secret };
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function authUrl(redirectUri: string): string {
  const p = new URLSearchParams({
    client_id: creds().id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent', // always get a refresh token, even on re-connect
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<void> {
  const { id, secret } = creds();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const tok = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    id_token?: string;
  };
  if (!tok.refresh_token) throw new Error('Google returned no refresh token — disconnect and retry');

  // id_token came straight from Google over TLS; decoding without verifying is fine here.
  let email: string | null = null;
  if (tok.id_token) {
    try {
      email = JSON.parse(Buffer.from(tok.id_token.split('.')[1], 'base64url').toString()).email ?? null;
    } catch {
      email = null;
    }
  }

  const row = {
    provider: 'google',
    refreshToken: tok.refresh_token,
    accessToken: tok.access_token,
    accessTokenExpiresAt: new Date(Date.now() + (tok.expires_in - 60) * 1000),
    scope: tok.scope,
    accountEmail: email,
  };
  await db.insert(connections).values(row).onConflictDoUpdate({ target: connections.provider, set: row });
}

export async function googleConnection() {
  const rows = await db.select().from(connections).where(eq(connections.provider, 'google'));
  return rows[0] ?? null;
}

export async function disconnectGoogle(): Promise<void> {
  const conn = await googleConnection();
  if (!conn) return;
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(conn.refreshToken)}`, {
    method: 'POST',
  }).catch(() => {}); // best effort — we delete our copy regardless
  await db.delete(connections).where(eq(connections.provider, 'google'));
}

async function accessToken(): Promise<string> {
  const conn = await googleConnection();
  if (!conn) throw new Error('Google Calendar not connected');
  if (conn.accessToken && conn.accessTokenExpiresAt && conn.accessTokenExpiresAt > new Date()) {
    return conn.accessToken;
  }
  const { id, secret } = creds();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: conn.refreshToken,
      client_id: id,
      client_secret: secret,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`token refresh failed: ${res.status} ${await res.text()}`);
  const tok = (await res.json()) as { access_token: string; expires_in: number };
  await db
    .update(connections)
    .set({
      accessToken: tok.access_token,
      accessTokenExpiresAt: new Date(Date.now() + (tok.expires_in - 60) * 1000),
    })
    .where(eq(connections.provider, 'google'));
  return tok.access_token;
}

const CAL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export type CalEvent = { id: string; title: string; start: string; end: string; allDay: boolean };

// All events on one IST day (day = YYYY-MM-DD).
export async function listEvents(day: string): Promise<CalEvent[]> {
  const token = await accessToken();
  const p = new URLSearchParams({
    timeMin: `${day}T00:00:00+05:30`,
    timeMax: `${day}T23:59:59+05:30`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const res = await fetch(`${CAL}?${p}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`calendar list failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    items?: {
      id: string;
      summary?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
      status?: string;
    }[];
  };
  return (data.items ?? [])
    .filter((e) => e.status !== 'cancelled')
    .map((e) => ({
      id: e.id,
      title: e.summary ?? '(untitled)',
      start: e.start.dateTime ?? e.start.date ?? '',
      end: e.end.dateTime ?? e.end.date ?? '',
      allDay: !e.start.dateTime,
    }));
}

// Create the plan's blocks as real calendar events, titled "[vivy] …" so a
// replan can find and replace exactly what we created and nothing else.
export async function createBlocks(
  day: string,
  blocks: { start: string; end: string; title: string }[], // HH:MM local IST
): Promise<string[]> {
  const token = await accessToken();
  const ids: string[] = [];
  for (const b of blocks) {
    const res = await fetch(CAL, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        summary: `[vivy] ${b.title}`,
        start: { dateTime: `${day}T${b.start}:00+05:30`, timeZone: 'Asia/Kolkata' },
        end: { dateTime: `${day}T${b.end}:00+05:30`, timeZone: 'Asia/Kolkata' },
      }),
    });
    if (!res.ok) throw new Error(`calendar insert failed: ${res.status} ${await res.text()}`);
    ids.push(((await res.json()) as { id: string }).id);
  }
  return ids;
}

export async function deleteBlocks(ids: string[]): Promise<void> {
  const token = await accessToken();
  for (const id of ids) {
    await fetch(`${CAL}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    }).catch(() => {}); // already gone is fine
  }
}
