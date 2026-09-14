export const POMODORO_SETTINGS = {
  sessionType: 'pomodoro',
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 20,
  roundsBeforeLongBreak: 4,
} as const;

export type IntenseSessionType = 'pomodoro' | 'custom';
export type IntensePhase = 'focus' | 'short_break' | 'long_break';
export type IntenseStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface IntenseSettings {
  sessionType: IntenseSessionType;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  roundsBeforeLongBreak: number;
}

export interface IntenseTask {
  id: string;
  title: string;
  areaName: string | null;
  areaColour: string | null;
}

export interface IntenseSession extends IntenseSettings {
  id: string;
  taskId: string;
  taskTitle: string;
  areaName: string | null;
  areaColour: string | null;
  phase: IntensePhase;
  round: number;
  status: IntenseStatus;
  phaseEndsAt: string;
  remainingSeconds: number | null;
}

export interface IntenseState {
  settings: IntenseSettings;
  tasks: IntenseTask[];
  session: IntenseSession | null;
}
