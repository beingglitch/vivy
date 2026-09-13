import { and, eq } from 'drizzle-orm';
import { sourceById } from '@vivy/core';
import { db, onboardingSteps } from '@vivy/db';
import { allDueReminders } from '@/lib/onboarding';
import { sendPush } from '@/lib/push';
import { fail, handleError, ok } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Fire any reminder whose time has come, across every account. Called by cron.
 *
 * `remindedAt` is stamped before the send rather than after, so a push provider
 * that is slow or flaky cannot cause the same reminder to go out twice. A missed
 * notification is recoverable, the in-app bar still shows it, where a
 * notification loop is not.
 */
export async function GET(request: Request) {
  try {
    // Vercel signs cron requests with this header. In development there is no
    // secret, so the route stays open locally and closed in production.
    const secret = process.env['CRON_SECRET'];
    if (secret) {
      const auth = request.headers.get('authorization');
      if (auth !== `Bearer ${secret}`) return fail('Unauthorized', 401);
    }

    const due = await allDueReminders();
    if (due.length === 0) return ok({ users: 0, sent: 0 });

    // Group by user: one person with three pending sources gets one
    // notification, not three.
    const byUser = new Map<string, string[]>();
    for (const row of due) {
      byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row.sourceId]);
    }

    const now = new Date();
    let sent = 0;

    for (const [userId, sourceIds] of byUser) {
      for (const sourceId of sourceIds) {
        await db()
          .update(onboardingSteps)
          .set({ remindedAt: now })
          .where(
            and(eq(onboardingSteps.userId, userId), eq(onboardingSteps.sourceId, sourceId)));
      }

      const first = sourceById(sourceIds[0] ?? '');
      const result = await sendPush(userId, {
        title:
          sourceIds.length === 1 && first
            ? `Set up ${first.name}?`
            : `${sourceIds.length} things to set up`,
        body:
          sourceIds.length === 1 && first
            ? `${first.summary} About ${first.minutes} minutes.`
            : sourceIds.map((id) => sourceById(id)?.name ?? id).join(', '),
        // Deep-links straight to the setup page, which is what makes tapping the
        // notification useful rather than just an app launch.
        url: sourceIds.length === 1 ? `/more/sources/${sourceIds[0]}` : '/more/sources',
        tag: 'vivy-reminder',
      });
      sent += result.sent;
    }

    return ok({ users: byUser.size, sent });
  } catch (error) {
    return handleError(error);
  }
}
