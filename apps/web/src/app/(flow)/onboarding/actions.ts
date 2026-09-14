'use server';

import { revalidatePath } from 'next/cache';
import { setStep } from '@/lib/onboarding';
import { requireUserId } from '@/lib/session';

/**
 * Every choice a source offers, and none of them is "you must".
 *
 * `later` is the interesting one: it records a time rather than a vague
 * intention, which is what lets a reminder fire and what stops the flow from
 * nagging in the meantime.
 */

export type LaterWhen = 'hour' | 'tonight' | 'tomorrow' | 'week';

function whenToDate(when: LaterWhen): Date {
  const now = new Date();
  switch (when) {
    case 'hour':
      return new Date(now.getTime() + 3_600_000);
    case 'tonight': {
      const d = new Date(now);
      d.setHours(20, 0, 0, 0);
      // Already past 8pm, push to tomorrow evening rather than firing instantly.
      if (d <= now) d.setDate(d.getDate() + 1);
      return d;
    }
    case 'tomorrow': {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
      return d;
    }
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      d.setHours(10, 0, 0, 0);
      return d;
    }
  }
}

export async function completeStep(sourceId: string): Promise<void> {
  await setStep(await requireUserId(), sourceId, 'done');
  revalidatePath('/onboarding');
  revalidatePath('/more/sources');
}

export async function skipStep(sourceId: string): Promise<void> {
  // Skipped is not deleted: More > Ingestors still lists it with the same
  // instructions, so this is "stop asking", not "never again".
  await setStep(await requireUserId(), sourceId, 'skipped');
  revalidatePath('/onboarding');
  revalidatePath('/more/sources');
}

export async function scheduleStep(sourceId: string, when: LaterWhen): Promise<void> {
  await setStep(await requireUserId(), sourceId, 'scheduled', whenToDate(when));
  revalidatePath('/onboarding');
  revalidatePath('/more/sources');
}

export async function resetStep(sourceId: string): Promise<void> {
  await setStep(await requireUserId(), sourceId, 'pending', null);
  revalidatePath('/more/sources');
}
