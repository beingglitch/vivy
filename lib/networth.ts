import { db, positions, networthSnapshots } from '@/lib/db';

// Upsert today's (IST) net-worth snapshot from current positions. Called after
// every position mutation and by the daily cron, so the trend line always has
// at most one row per day and never misses a day the app was touched.
export async function snapshotNetWorth() {
  const rows = await db.select().from(positions);
  const considered = rows.filter((p) => p.consider);
  const assets = considered
    .filter((p) => p.kind === 'asset')
    .reduce((s, p) => s + Number(p.value), 0);
  const liabilities = considered
    .filter((p) => p.kind === 'liability')
    .reduce((s, p) => s + Number(p.value), 0);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const values = {
    assets: assets.toFixed(2),
    liabilities: liabilities.toFixed(2),
    net: (assets - liabilities).toFixed(2),
  };
  await db
    .insert(networthSnapshots)
    .values({ day, ...values })
    .onConflictDoUpdate({ target: networthSnapshots.day, set: values });
}
