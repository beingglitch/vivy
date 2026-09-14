import 'server-only';

import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { areas, db, intenseSessions, intenseSettings, tasks } from '@vivy/db';
import {
  POMODORO_SETTINGS,
  type IntensePhase,
  type IntenseSession,
  type IntenseSessionType,
  type IntenseSettings,
  type IntenseState,
  type IntenseStatus,
} from './intense-shared';

export async function intenseStateOf(userId: string): Promise<IntenseState> {
  const [settingRows, taskRows, sessionRows] = await Promise.all([
    db().select().from(intenseSettings).where(eq(intenseSettings.userId, userId)).limit(1),
    db()
      .select({
        id: tasks.id,
        title: tasks.title,
        areaName: areas.name,
        areaColour: areas.colour,
      })
      .from(tasks)
      .leftJoin(areas, eq(tasks.areaId, areas.id))
      .where(and(eq(tasks.userId, userId), eq(tasks.status, 'open')))
      .orderBy(asc(tasks.createdAt)),
    db()
      .select({
        id: intenseSessions.id,
        taskId: intenseSessions.taskId,
        taskTitle: tasks.title,
        areaName: areas.name,
        areaColour: areas.colour,
        sessionType: intenseSessions.sessionType,
        phase: intenseSessions.phase,
        focusMinutes: intenseSessions.focusMinutes,
        shortBreakMinutes: intenseSessions.shortBreakMinutes,
        longBreakMinutes: intenseSessions.longBreakMinutes,
        roundsBeforeLongBreak: intenseSessions.roundsBeforeLongBreak,
        round: intenseSessions.round,
        status: intenseSessions.status,
        phaseEndsAt: intenseSessions.phaseEndsAt,
        remainingSeconds: intenseSessions.remainingSeconds,
      })
      .from(intenseSessions)
      .innerJoin(tasks, eq(intenseSessions.taskId, tasks.id))
      .leftJoin(areas, eq(tasks.areaId, areas.id))
      .where(
        and(
          eq(intenseSessions.userId, userId),
          inArray(intenseSessions.status, ['active', 'paused']),
        ),
      )
      .orderBy(desc(intenseSessions.startedAt))
      .limit(1),
  ]);

  const row = settingRows[0];
  const settings = row
    ? normaliseSettings({
        sessionType: row.sessionType,
        focusMinutes: row.focusMinutes,
        shortBreakMinutes: row.shortBreakMinutes,
        longBreakMinutes: row.longBreakMinutes,
        roundsBeforeLongBreak: row.roundsBeforeLongBreak,
      })
    : { ...POMODORO_SETTINGS };
  const sessionRow = sessionRows[0];
  const session: IntenseSession | null = sessionRow
    ? {
        id: sessionRow.id,
        taskId: sessionRow.taskId,
        taskTitle: sessionRow.taskTitle,
        areaName: sessionRow.areaName,
        areaColour: sessionRow.areaColour,
        sessionType: sessionRow.sessionType as IntenseSessionType,
        phase: sessionRow.phase as IntensePhase,
        focusMinutes: sessionRow.focusMinutes,
        shortBreakMinutes: sessionRow.shortBreakMinutes,
        longBreakMinutes: sessionRow.longBreakMinutes,
        roundsBeforeLongBreak: sessionRow.roundsBeforeLongBreak,
        round: sessionRow.round,
        status: sessionRow.status as IntenseStatus,
        phaseEndsAt: sessionRow.phaseEndsAt.toISOString(),
        remainingSeconds: sessionRow.remainingSeconds,
      }
    : null;

  return { settings, tasks: taskRows, session };
}

export async function saveIntenseSettings(
  userId: string,
  input: IntenseSettings,
): Promise<IntenseSettings> {
  const settings = normaliseSettings(input);
  await db()
    .insert(intenseSettings)
    .values({ userId, ...settings })
    .onConflictDoUpdate({
      target: intenseSettings.userId,
      set: { ...settings, updatedAt: new Date() },
    });
  return settings;
}

export async function startIntenseSession(
  userId: string,
  taskId: string,
  input: IntenseSettings,
): Promise<IntenseState> {
  const settings = await saveIntenseSettings(userId, input);
  const task = await db()
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), eq(tasks.status, 'open')))
    .limit(1);
  if (!task[0]) throw new Error('Choose one open task.');

  const now = new Date();
  await db()
    .update(intenseSessions)
    .set({ status: 'cancelled', completedAt: now, updatedAt: now })
    .where(
      and(
        eq(intenseSessions.userId, userId),
        inArray(intenseSessions.status, ['active', 'paused']),
      ),
    );
  await db()
    .insert(intenseSessions)
    .values({
      id: randomUUID(),
      userId,
      taskId,
      ...settings,
      phase: 'focus',
      round: 1,
      status: 'active',
      phaseStartedAt: now,
      phaseEndsAt: addMinutes(now, settings.focusMinutes),
    });
  return intenseStateOf(userId);
}

export async function pauseIntenseSession(
  userId: string,
  sessionId: string,
): Promise<IntenseState> {
  const session = await ownedSession(userId, sessionId);
  if (session.status !== 'active') return intenseStateOf(userId);
  const now = new Date();
  const remainingSeconds = Math.max(
    0,
    Math.ceil((session.phaseEndsAt.getTime() - now.getTime()) / 1_000),
  );
  await db()
    .update(intenseSessions)
    .set({ status: 'paused', remainingSeconds, updatedAt: now })
    .where(and(eq(intenseSessions.id, sessionId), eq(intenseSessions.userId, userId)));
  return intenseStateOf(userId);
}

export async function resumeIntenseSession(
  userId: string,
  sessionId: string,
): Promise<IntenseState> {
  const session = await ownedSession(userId, sessionId);
  if (session.status !== 'paused') return intenseStateOf(userId);
  const now = new Date();
  await db()
    .update(intenseSessions)
    .set({
      status: 'active',
      phaseStartedAt: now,
      phaseEndsAt: new Date(now.getTime() + (session.remainingSeconds ?? 0) * 1_000),
      remainingSeconds: null,
      updatedAt: now,
    })
    .where(and(eq(intenseSessions.id, sessionId), eq(intenseSessions.userId, userId)));
  return intenseStateOf(userId);
}

export async function advanceIntenseSession(
  userId: string,
  sessionId: string,
): Promise<IntenseState> {
  const session = await ownedSession(userId, sessionId);
  const now = new Date();
  if (session.phase === 'long_break') {
    await db()
      .update(intenseSessions)
      .set({ status: 'completed', completedAt: now, remainingSeconds: null, updatedAt: now })
      .where(and(eq(intenseSessions.id, sessionId), eq(intenseSessions.userId, userId)));
    return intenseStateOf(userId);
  }

  const completedFocus = session.phase === 'focus';
  const nextPhase: IntensePhase = completedFocus
    ? session.round >= session.roundsBeforeLongBreak
      ? 'long_break'
      : 'short_break'
    : 'focus';
  const nextRound = completedFocus ? session.round : session.round + 1;
  const minutes =
    nextPhase === 'focus'
      ? session.focusMinutes
      : nextPhase === 'long_break'
        ? session.longBreakMinutes
        : session.shortBreakMinutes;
  await db()
    .update(intenseSessions)
    .set({
      phase: nextPhase,
      round: nextRound,
      status: 'active',
      phaseStartedAt: now,
      phaseEndsAt: addMinutes(now, minutes),
      remainingSeconds: null,
      updatedAt: now,
    })
    .where(and(eq(intenseSessions.id, sessionId), eq(intenseSessions.userId, userId)));
  return intenseStateOf(userId);
}

export async function cancelIntenseSession(
  userId: string,
  sessionId: string,
): Promise<IntenseState> {
  await db()
    .update(intenseSessions)
    .set({ status: 'cancelled', completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(intenseSessions.id, sessionId), eq(intenseSessions.userId, userId)));
  return intenseStateOf(userId);
}

function normaliseSettings(input: {
  sessionType: string;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  roundsBeforeLongBreak: number;
}): IntenseSettings {
  const sessionType: IntenseSessionType = input.sessionType === 'custom' ? 'custom' : 'pomodoro';
  if (sessionType === 'pomodoro') return { ...POMODORO_SETTINGS };
  return {
    sessionType,
    focusMinutes: clamp(input.focusMinutes, 1, 180),
    shortBreakMinutes: clamp(input.shortBreakMinutes, 1, 60),
    longBreakMinutes: clamp(input.longBreakMinutes, 1, 90),
    roundsBeforeLongBreak: clamp(input.roundsBeforeLongBreak, 1, 12),
  };
}

async function ownedSession(userId: string, sessionId: string) {
  const rows = await db()
    .select()
    .from(intenseSessions)
    .where(and(eq(intenseSessions.id, sessionId), eq(intenseSessions.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new Error('Intense session not found.');
  return rows[0];
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
