import 'server-only';
import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { db, pushSubscriptions } from '@vivy/db';

/**
 * Web push.
 *
 * Configured lazily rather than at module load: the keys are optional, and an
 * app that refuses to boot because notifications are unconfigured is worse than
 * one that quietly does not notify.
 */

let configured: boolean | null = null;

function ready(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env['VAPID_PUBLIC_KEY'];
  const privateKey = process.env['VAPID_PRIVATE_KEY'];
  const subject = process.env['VAPID_SUBJECT'] ?? 'mailto:vivy@localhost';

  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send to every endpoint registered by one user.
 *
 * A 404 or 410 means the browser threw the subscription away, the user cleared
 * site data, or uninstalled the PWA. Those are deleted rather than retried, or
 * the table fills with endpoints that can never succeed.
 */
export async function sendPush(
  userId: string,
  message: PushMessage): Promise<{ sent: number; pruned: number }> {
  if (!ready()) return { sent: 0, pruned: 0 };

  // Scoped to one user: a push must never reach another account's browser.
  const subs = await db()
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  const payload = JSON.stringify(message);
  let sent = 0;
  let pruned = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload);
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db()
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint))
            .catch(() => undefined);
          pruned += 1;
        } else {
          // Never log the payload or the endpoint, one identifies the user's
          // browser, the other is the message itself.
          console.warn('[vivy] push failed with status', status ?? 'unknown');
        }
      }
    }));

  return { sent, pruned };
}

export function pushConfigured(): boolean {
  return ready();
}
