import 'server-only';
import { and, eq, isNotNull, lte } from 'drizzle-orm';
import { ONBOARDING_ORDER, SOURCES, type IngestSource } from '@vivy/core';
import { db, onboardingSteps } from '@vivy/db';

/**
 * Onboarding state, per user.
 *
 * Every step is optional. The states that matter are the ones that are not
 * "done": `skipped` means stop asking, `scheduled` means ask again at a time the
 * user picked. Neither is a dead end. More > Sources lists all of them with the
 * same instructions, so nothing is ever lost by dismissing a prompt.
 */

export type StepStatus = 'pending' | 'done' | 'skipped' | 'scheduled';

export interface StepState {
  readonly source: IngestSource;
  readonly status: StepStatus;
  readonly scheduledFor: Date | null;
}

export async function loadSteps(userId: string): Promise<StepState[]> {
  let rows: { sourceId: string; status: string; scheduledFor: Date | null }[] = [];
  try {
    rows = await db()
      .select({
        sourceId: onboardingSteps.sourceId,
        status: onboardingSteps.status,
        scheduledFor: onboardingSteps.scheduledFor,
      })
      .from(onboardingSteps)
      .where(eq(onboardingSteps.userId, userId));
  } catch {
    // No table yet, everything reads as pending, which is correct for a fresh
    // install and lets the screens render instead of erroring.
  }

  const byId = new Map(rows.map((r) => [r.sourceId, r]));

  return SOURCES.map((source) => {
    const row = byId.get(source.id);
    return {
      source,
      status: (row?.status as StepStatus) ?? 'pending',
      scheduledFor: row?.scheduledFor ?? null,
    };
  });
}

export async function setStep(
  userId: string,
  sourceId: string,
  status: StepStatus,
  scheduledFor?: Date | null): Promise<void> {
  const now = new Date();
  await db()
    .insert(onboardingSteps)
    .values({
      userId,
      sourceId,
      status,
      scheduledFor: scheduledFor ?? null,
      completedAt: status === 'done' ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [onboardingSteps.userId, onboardingSteps.sourceId],
      set: {
        status,
        scheduledFor: scheduledFor ?? null,
        completedAt: status === 'done' ? now : null,
        updatedAt: now,
      },
    });
}

/** Steps whose reminder time has arrived, for one user. */
export async function dueReminders(userId: string): Promise<StepState[]> {
  try {
    const rows = await db()
      .select()
      .from(onboardingSteps)
      .where(
        and(
          eq(onboardingSteps.userId, userId),
          eq(onboardingSteps.status, 'scheduled'),
          isNotNull(onboardingSteps.scheduledFor),
          lte(onboardingSteps.scheduledFor, new Date())));

    return rows.flatMap((r) => {
      const source = SOURCES.find((s) => s.id === r.sourceId);
      return source ? [{ source, status: 'scheduled' as const, scheduledFor: r.scheduledFor }] : [];
    });
  } catch {
    return [];
  }
}

/** Every user with a reminder now due. Used by the cron, which has no session. */
export async function allDueReminders(): Promise<{ userId: string; sourceId: string }[]> {
  try {
    return await db()
      .select({ userId: onboardingSteps.userId, sourceId: onboardingSteps.sourceId })
      .from(onboardingSteps)
      .where(
        and(
          eq(onboardingSteps.status, 'scheduled'),
          isNotNull(onboardingSteps.scheduledFor),
          lte(onboardingSteps.scheduledFor, new Date())));
  } catch {
    return [];
  }
}

/** The next source to offer during first run, or null when the list is exhausted. */
export function nextPending(steps: readonly StepState[]): StepState | null {
  for (const id of ONBOARDING_ORDER) {
    const step = steps.find((s) => s.source.id === id);
    if (step && step.status === 'pending') return step;
  }
  return null;
}

export function progress(steps: readonly StepState[]): { decided: number; total: number } {
  const inFlow = steps.filter((s) => (ONBOARDING_ORDER as readonly string[]).includes(s.source.id));
  return {
    decided: inFlow.filter((s) => s.status !== 'pending').length,
    total: inFlow.length,
  };
}
