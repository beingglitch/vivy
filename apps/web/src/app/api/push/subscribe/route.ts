import { z } from 'zod';
import { db, pushSubscriptions } from '@vivy/db';
import { currentUserId } from '@/lib/session';
import { fail, handleError, ok, parseBody } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Subscription = z.object({
  endpoint: z.string().min(1),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

/**
 * Register a browser for push.
 *
 * Keyed on the endpoint, which the browser regenerates whenever it invalidates a
 * subscription, so re-subscribing after a permission reset updates the row
 * rather than leaving a dead one behind.
 */
export async function POST(request: Request) {
  try {
    const userId = await currentUserId();
    if (!userId) return fail('Unauthorized', 401);

    const sub = await parseBody(request, Subscription);
    await db()
      .insert(pushSubscriptions)
      .values({ endpoint: sub.endpoint, userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      });

    return ok({ subscribed: true });
  } catch (error) {
    return handleError(error);
  }
}
