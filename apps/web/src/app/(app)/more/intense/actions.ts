'use server';

import { revalidatePath } from 'next/cache';
import {
  advanceIntenseSession,
  cancelIntenseSession,
  intenseStateOf,
  pauseIntenseSession,
  resumeIntenseSession,
  saveIntenseSettings,
  startIntenseSession,
} from '@/lib/intense';
import type { IntenseSettings, IntenseState } from '@/lib/intense-shared';
import { requireUserId } from '@/lib/session';

type Result = { ok: true; state: IntenseState } | { ok: false; error: string };

export async function loadIntenseMode(): Promise<Result> {
  return run((userId) => intenseStateOf(userId));
}

export async function saveIntenseModeSettings(
  settings: IntenseSettings,
): Promise<{ ok: true; settings: IntenseSettings } | { ok: false; error: string }> {
  try {
    const saved = await saveIntenseSettings(await requireUserId(), settings);
    revalidatePath('/more/intense');
    return { ok: true, settings: saved };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}

export async function beginIntenseMode(taskId: string, settings: IntenseSettings): Promise<Result> {
  return run((userId) => startIntenseSession(userId, taskId, settings));
}

export async function pauseIntenseMode(sessionId: string): Promise<Result> {
  return run((userId) => pauseIntenseSession(userId, sessionId));
}

export async function resumeIntenseMode(sessionId: string): Promise<Result> {
  return run((userId) => resumeIntenseSession(userId, sessionId));
}

export async function advanceIntenseMode(sessionId: string): Promise<Result> {
  return run((userId) => advanceIntenseSession(userId, sessionId));
}

export async function endIntenseMode(sessionId: string): Promise<Result> {
  return run((userId) => cancelIntenseSession(userId, sessionId));
}

async function run(work: (userId: string) => Promise<IntenseState>): Promise<Result> {
  try {
    return { ok: true, state: await work(await requireUserId()) };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Intense Mode could not update.';
}
