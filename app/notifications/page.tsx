import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db, notifications } from '@/lib/db';
import { MarkRead } from './mark-read';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  morning: 'morning',
  spend: 'spending',
  evening: 'evening',
  system: 'system',
};

export default async function NotificationsPage() {
  const rows = await db.select().from(notifications).orderBy(desc(notifications.ts)).limit(50);

  return (
    <main className="space-y-8">
      <div>
        <h1 className="font-voice text-2xl italic">Notifications</h1>
        <p className="mt-1 text-sm text-moth">Everything I&apos;ve nudged you about.</p>
      </div>
      <MarkRead />
      {rows.length === 0 ? (
        <p className="text-sm text-moth">
          Nothing yet. Enable push in{' '}
          <Link href="/settings" className="text-ember hover:brightness-110">
            settings
          </Link>{' '}
          and I&apos;ll start reaching out.
        </p>
      ) : (
        <ul className="divide-y divide-seam/60 rounded-xl border border-seam bg-veil/50">
          {rows.map((n) => (
            <li key={n.id} className="px-4 py-3">
              <Link href={n.url ?? '/'} className="block space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className={`text-sm ${n.readAt ? 'text-moth' : 'font-medium text-linen'}`}>
                    {n.title}
                  </span>
                  <span className="rounded-full bg-seam/80 px-2 py-0.5 text-[10px] text-moth">
                    {KIND_LABEL[n.kind] ?? n.kind}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-moth/70">
                    {new Intl.DateTimeFormat('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(n.ts)}
                  </span>
                </div>
                <p className={`text-sm ${n.readAt ? 'text-moth/80' : 'text-linen/90'}`}>{n.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
