'use client';

import { useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  advanceIntenseMode,
  beginIntenseMode,
  endIntenseMode,
  loadIntenseMode,
  pauseIntenseMode,
  resumeIntenseMode,
  saveIntenseModeSettings,
} from '@/app/(app)/more/intense/actions';
import {
  POMODORO_SETTINGS,
  type IntenseSession,
  type IntenseSettings,
  type IntenseState,
  type IntenseTask,
} from '@/lib/intense-shared';

export interface IntenseOrigin {
  x: number;
  y: number;
}

export const INTENSE_MODE_EVENT = 'vivy:intense-mode';

export function openIntenseModeForTask(taskId: string, origin: IntenseOrigin) {
  window.dispatchEvent(
    new CustomEvent(INTENSE_MODE_EVENT, {
      detail: { taskId, origin },
    }),
  );
}

export function IntenseMode({
  open,
  origin,
  initialTaskId,
  onClose,
}: {
  open: boolean;
  origin: IntenseOrigin;
  initialTaskId: string | null;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<Element | null>(null);
  const [state, setState] = useState<IntenseState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setTarget(document.querySelector('.phone'));
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    start(async () => {
      const result = await loadIntenseMode();
      if (result.ok) setState(result.state);
      else setError(result.error);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose, open]);

  if (!open || !target) return null;
  const style = {
    '--intense-origin-x': `${origin.x}px`,
    '--intense-origin-y': `${origin.y}px`,
  } as CSSProperties;

  return createPortal(
    <div className="intense-mode" style={style} role="dialog" aria-modal="true">
      <div className="intense-mode__launch" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="intense-mode__surface">
        <header className="intense-mode__header">
          <div>
            <span className="eyebrow">Intense Mode</span>
            <strong>{state?.session ? phaseTitle(state.session) : 'Choose one thing'}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Intense Mode">
            Close
          </button>
        </header>

        {state?.session ? (
          <IntenseTimer
            session={state.session}
            pending={pending}
            onChange={(work) => {
              setError(null);
              start(async () => {
                const result = await work();
                if (result.ok) setState(result.state);
                else setError(result.error);
              });
            }}
          />
        ) : state ? (
          <IntenseSetup
            key={initialTaskId ?? 'choose-task'}
            settings={state.settings}
            tasks={state.tasks}
            initialTaskId={initialTaskId}
            pending={pending}
            onStart={(taskId, settings) => {
              setError(null);
              start(async () => {
                const result = await beginIntenseMode(taskId, settings);
                if (result.ok) setState(result.state);
                else setError(result.error);
              });
            }}
          />
        ) : (
          <div className="intense-mode__loading">
            <span />
            <p>Preparing your focus space…</p>
          </div>
        )}
        {error ? <p className="intense-mode__error">{error}</p> : null}
      </div>
    </div>,
    target,
  );
}

function IntenseSetup({
  settings,
  tasks,
  initialTaskId,
  pending,
  onStart,
}: {
  settings: IntenseSettings;
  tasks: IntenseTask[];
  initialTaskId: string | null;
  pending: boolean;
  onStart: (taskId: string, settings: IntenseSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [taskId, setTaskId] = useState(
    tasks.some((task) => task.id === initialTaskId) ? initialTaskId! : (tasks[0]?.id ?? ''),
  );

  return (
    <div className="intense-setup">
      <SessionType value={draft} onChange={setDraft} />

      <section className="intense-setup__section">
        <div className="intense-setup__section-title">
          <span>1</span>
          <div>
            <strong>Pick a task</strong>
            <small>Choose one single item. Everything else can wait.</small>
          </div>
        </div>
        <div className="intense-task-list">
          {tasks.map((task) => (
            <button
              type="button"
              key={task.id}
              className={taskId === task.id ? 'intense-task-list__task--on' : ''}
              onClick={() => setTaskId(task.id)}
            >
              <i style={{ background: task.areaColour ?? 'var(--grey-3)' }} />
              <span>
                <strong>{task.title}</strong>
                <small>{task.areaName ?? 'Unfiled'}</small>
              </span>
              <b aria-hidden>{taskId === task.id ? '✓' : ''}</b>
            </button>
          ))}
          {tasks.length === 0 ? (
            <p className="intense-task-list__empty">
              Add an open task before starting Intense Mode.
            </p>
          ) : null}
        </div>
      </section>

      <button
        type="button"
        className="btn btn--primary intense-setup__start"
        disabled={pending || !taskId}
        onClick={() => onStart(taskId, draft)}
      >
        {pending ? 'Starting…' : `Begin ${draft.focusMinutes} minutes`}
      </button>
    </div>
  );
}

export function IntenseSettingsEditor({ initial }: { initial: IntenseSettings }) {
  const [draft, setDraft] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="intense-settings">
      <p className="intense-settings__intro">
        Set the default rhythm. Long-press Today from any screen to choose a task and start.
      </p>
      <SessionType value={draft} onChange={setDraft} />
      <button
        type="button"
        className="btn btn--primary"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          start(async () => {
            const result = await saveIntenseModeSettings(draft);
            if (result.ok) {
              setDraft(result.settings);
              setMessage('Saved across your devices.');
            } else {
              setMessage(result.error);
            }
          });
        }}
      >
        {pending ? 'Saving…' : 'Save Intense Mode'}
      </button>
      {message ? <p className="intense-settings__message">{message}</p> : null}
    </div>
  );
}

function SessionType({
  value,
  onChange,
}: {
  value: IntenseSettings;
  onChange: (settings: IntenseSettings) => void;
}) {
  return (
    <section className="intense-setup__section">
      <div className="intense-setup__section-title">
        <span>◎</span>
        <div>
          <strong>Session type</strong>
          <small>Use the classic rhythm or make one that fits you.</small>
        </div>
      </div>
      <div className="intense-type">
        <button
          type="button"
          className={value.sessionType === 'pomodoro' ? 'intense-type__on' : ''}
          onClick={() => onChange({ ...POMODORO_SETTINGS })}
        >
          <strong>Pomodoro</strong>
          <small>25 focus · 5 rest · 4 rounds</small>
        </button>
        <button
          type="button"
          className={value.sessionType === 'custom' ? 'intense-type__on' : ''}
          onClick={() => onChange({ ...value, sessionType: 'custom' })}
        >
          <strong>Custom</strong>
          <small>Your own working rhythm</small>
        </button>
      </div>

      {value.sessionType === 'pomodoro' ? (
        <div className="intense-recipe">
          <span>
            <b>25</b> minutes of uninterrupted focus
          </span>
          <span>
            <b>5</b> minutes away from the work
          </span>
          <span>
            <b>4</b> focused rounds
          </span>
          <span>
            <b>20</b> minute long break to finish
          </span>
        </div>
      ) : (
        <div className="intense-custom">
          <DurationField
            label="Working time"
            value={value.focusMinutes}
            min={1}
            max={180}
            onChange={(focusMinutes) => onChange({ ...value, focusMinutes })}
          />
          <DurationField
            label="Short break"
            value={value.shortBreakMinutes}
            min={1}
            max={60}
            onChange={(shortBreakMinutes) => onChange({ ...value, shortBreakMinutes })}
          />
          <DurationField
            label="Long break"
            value={value.longBreakMinutes}
            min={1}
            max={90}
            onChange={(longBreakMinutes) => onChange({ ...value, longBreakMinutes })}
          />
          <DurationField
            label="Rounds"
            suffix="before long break"
            value={value.roundsBeforeLongBreak}
            min={1}
            max={12}
            onChange={(roundsBeforeLongBreak) => onChange({ ...value, roundsBeforeLongBreak })}
          />
        </div>
      )}
    </section>
  );
}

function DurationField({
  label,
  suffix = 'minutes',
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  suffix?: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="intense-duration">
      <span>{label}</span>
      <span>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
        />
        <small>{suffix}</small>
      </span>
    </label>
  );
}

function IntenseTimer({
  session,
  pending,
  onChange,
}: {
  session: IntenseSession;
  pending: boolean;
  onChange: (
    work: () => ReturnType<
      | typeof pauseIntenseMode
      | typeof resumeIntenseMode
      | typeof advanceIntenseMode
      | typeof endIntenseMode
    >,
  ) => void;
}) {
  const [remaining, setRemaining] = useState(() => remainingFor(session));
  const advanced = useRef(false);
  const duration = phaseMinutes(session) * 60;
  const progress = Math.max(0, Math.min(1, remaining / duration));

  useEffect(() => {
    setRemaining(remainingFor(session));
    advanced.current = false;
    if (session.status !== 'active') return;
    const update = () => setRemaining(remainingFor(session));
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (remaining > 0 || session.status !== 'active' || advanced.current) return;
    advanced.current = true;
    navigator.vibrate?.([80, 60, 120]);
    onChange(() => advanceIntenseMode(session.id));
  }, [onChange, remaining, session.id, session.status]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const phase = phaseTitle(session);

  return (
    <div className="intense-timer">
      <div
        className="intense-clock"
        style={{ '--intense-progress': `${progress * 360}deg` } as CSSProperties}
      >
        <div className="intense-clock__orbit" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <div className="intense-clock__face">
          <span>{phase}</span>
          <strong>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </strong>
          <small>
            {session.status === 'paused'
              ? 'Paused'
              : `Round ${session.round} of ${session.roundsBeforeLongBreak}`}
          </small>
        </div>
      </div>

      <div className="intense-timer__task">
        <i style={{ background: session.areaColour ?? 'var(--grey-3)' }} />
        <span>
          <small>{session.phase === 'focus' ? 'Working on' : 'Return to after your break'}</small>
          <strong>{session.taskTitle}</strong>
        </span>
      </div>

      <div className="intense-timer__actions">
        <button
          type="button"
          className="intense-timer__secondary"
          disabled={pending}
          onClick={() => onChange(() => endIntenseMode(session.id))}
        >
          End
        </button>
        <button
          type="button"
          className="intense-timer__primary"
          disabled={pending}
          onClick={() =>
            onChange(() =>
              session.status === 'paused'
                ? resumeIntenseMode(session.id)
                : pauseIntenseMode(session.id),
            )
          }
        >
          {session.status === 'paused' ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          className="intense-timer__secondary"
          disabled={pending}
          onClick={() => onChange(() => advanceIntenseMode(session.id))}
        >
          {session.phase === 'focus' ? 'Finish' : 'Skip'}
        </button>
      </div>

      <p className="intense-timer__guidance">{phaseGuidance(session.phase)}</p>
    </div>
  );
}

function remainingFor(session: IntenseSession) {
  if (session.status === 'paused') return Math.max(0, session.remainingSeconds ?? 0);
  return Math.max(0, Math.ceil((new Date(session.phaseEndsAt).getTime() - Date.now()) / 1_000));
}

function phaseMinutes(session: IntenseSession) {
  if (session.phase === 'short_break') return session.shortBreakMinutes;
  if (session.phase === 'long_break') return session.longBreakMinutes;
  return session.focusMinutes;
}

function phaseTitle(session: IntenseSession) {
  if (session.phase === 'short_break') return 'Short break';
  if (session.phase === 'long_break') return 'Long break';
  return 'Deep focus';
}

function phaseGuidance(phase: IntenseSession['phase']) {
  if (phase === 'focus') return 'One task. No messages, email, or extra tabs until time ends.';
  if (phase === 'long_break') return 'Step away for a real reset. Walk, eat, or rest your eyes.';
  return 'Leave the screen, stretch, and get water. This is recovery time.';
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
