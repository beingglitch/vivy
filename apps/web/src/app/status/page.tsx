import { count, desc, eq } from 'drizzle-orm';
import { db, devices, events, rawRecords } from '@vivy/db';
import { STREAMS } from '@vivy/core';
import { currentUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Ingest status.
 *
 * Not the product - the product is the canvas UI, which arrives in P3. This is
 * the smoke test for P1: if these counters move when a collector runs, the whole
 * pipe from device to Postgres is working, and everything after it is drawing.
 */
export default async function Home() {
  const stats = await loadStats();

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 96px' }}>
      <p
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
          margin: 0,
        }}
      >
        Vivy · ingest status
      </p>
      <h1 style={{ fontSize: 40, letterSpacing: '-0.03em', margin: '10px 0 8px', lineHeight: 1.05 }}>
        {stats ? 'Pipe is up' : 'No database yet'}
      </h1>
      <p style={{ color: 'var(--ink-2)', margin: '0 0 32px', maxWidth: '58ch' }}>
        {stats
          ? 'Counters move when a collector pushes. Once they do, every screen after this one is only drawing.'
          : 'Set DATABASE_URL in .env.local and run pnpm db:migrate, then reload.'}
      </p>

      {stats ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 1,
              background: 'var(--line)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            <Stat label="Raw records" value={stats.raw} />
            <Stat label="Events" value={stats.events} />
            <Stat label="Devices" value={stats.devices} />
            <Stat label="Streams defined" value={STREAMS.length} />
          </div>

          <h2 style={{ fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', margin: '40px 0 12px' }}>
            Paired devices
          </h2>
          {stats.deviceList.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              None yet. Pair one against <code>POST /api/devices/pair</code>.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
              {stats.deviceList.map((d) => (
                <li
                  key={d.id}
                  style={{
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {d.label}{' '}
                    <span className="mono" style={{ color: 'var(--muted)', fontWeight: 400 }}>
                      {d.platform}
                    </span>
                  </span>
                  <span className="mono" style={{ color: d.revokedAt ? 'var(--warn)' : 'var(--muted)', fontSize: 12 }}>
                    {d.revokedAt
                      ? 'revoked'
                      : d.lastSeenAt
                        ? `seen ${d.lastSeenAt.toISOString().slice(0, 16).replace('T', ' ')}`
                        : 'never synced'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: 'var(--surface)', padding: '16px 18px' }}>
      <div
        className="mono"
        style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}
      >
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {value.toLocaleString('en-IN')}
      </div>
    </div>
  );
}

async function loadStats() {
  const userId = await currentUserId();
  if (!userId) return null;
  // The status page must render before the database exists - it is the first
  // thing you open on a fresh clone, and a stack trace is a bad welcome.
  try {
    const conn = db();
    const [raw, evt, dev, list] = await Promise.all([
      conn.select({ n: count() }).from(rawRecords).where(eq(rawRecords.userId, userId)),
      conn.select({ n: count() }).from(events).where(eq(events.userId, userId)),
      conn.select({ n: count() }).from(devices).where(eq(devices.userId, userId)),
      conn
        .select()
        .from(devices)
        .where(eq(devices.userId, userId))
        .orderBy(desc(devices.createdAt))
        .limit(10),
    ]);
    return {
      raw: raw[0]?.n ?? 0,
      events: evt[0]?.n ?? 0,
      devices: dev[0]?.n ?? 0,
      deviceList: list,
    };
  } catch {
    return null;
  }
}
