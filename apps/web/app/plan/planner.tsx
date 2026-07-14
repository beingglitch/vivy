'use client';

import { useEffect, useState } from 'react';
import { BriefContent } from '@/app/brief-content';

type CalEvent = { id: string; title: string; start: string; end: string; allDay: boolean };
type Plan = {
  day: string;
  intent: string | null;
  content: string;
  blocks: { start: string; end: string; title: string }[] | null;
  calendarEventIds: string[] | null;
};
type Ctx = { day: string; calendar: CalEvent[] | null; fixed: string; existing: Plan | null };

export function Planner() {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [intent, setIntent] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState<'' | 'plan' | 'calendar'>('');
  const [calMsg, setCalMsg] = useState('');

  useEffect(() => {
    fetch('/api/plan')
      .then((r) => r.json())
      .then((c: Ctx) => {
        setCtx(c);
        if (c.existing) {
          setPlan(c.existing);
          setIntent(c.existing.intent ?? '');
        }
      })
      .catch(() => setCtx(null));
  }, []);

  async function generate() {
    setBusy('plan');
    setCalMsg('');
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intent }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      setPlan(j.plan);
    } catch (e) {
      alert(`Planning failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy('');
    }
  }

  async function toCalendar() {
    setBusy('calendar');
    try {
      const res = await fetch('/api/plan/calendar', { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      setCalMsg(`${j.created} block(s) on your calendar ✓`);
    } catch (e) {
      setCalMsg(`Failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy('');
    }
  }

  if (!ctx) return <p className="text-sm text-moth">Loading tomorrow…</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-seam bg-veil p-5">
        <p className="text-xs font-medium tracking-widest text-moth uppercase">Already fixed · {ctx.day}</p>
        {ctx.calendar === null && (
          <p className="mt-2 text-sm text-moth">
            Google Calendar isn&apos;t connected — planning from tasks, routines and goals only.{' '}
            <a href="/settings" className="text-ember underline-offset-2 hover:underline">
              Connect it in settings
            </a>
            .
          </p>
        )}
        {ctx.calendar !== null && ctx.calendar.length === 0 && (
          <p className="mt-2 text-sm text-moth">Calendar is empty tomorrow — the day is yours.</p>
        )}
        {ctx.calendar !== null && ctx.calendar.length > 0 && (
          <ul className="mt-2 space-y-1.5 text-sm">
            {ctx.calendar.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="w-24 shrink-0 font-mono text-xs text-moth">
                  {e.allDay ? 'all day' : `${e.start.slice(11, 16)}–${e.end.slice(11, 16)}`}
                </span>
                <span className="text-linen/90">{e.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <textarea
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          rows={3}
          placeholder="e.g. finish the whisper release, 2h for IoT lab, gym in the evening…"
          className="w-full rounded-xl border border-seam bg-veil p-4 text-[15px] text-linen placeholder:text-hush focus:border-ember focus:outline-none"
        />
        <button
          onClick={generate}
          disabled={busy !== ''}
          className="rounded-lg bg-ember px-4 py-2 text-sm font-medium text-night disabled:opacity-50"
        >
          {busy === 'plan' ? 'Vivy is planning…' : plan ? 'Re-plan tomorrow' : 'Plan tomorrow'}
        </button>
      </section>

      {plan && (
        <section className="rounded-xl border border-seam bg-veil p-5">
          <p className="text-xs font-medium tracking-widest text-ember uppercase">Tomorrow&apos;s plan</p>
          <div className="mt-3">
            <BriefContent content={plan.content} />
          </div>
          {ctx.calendar !== null && (plan.blocks?.length ?? 0) > 0 && (
            <div className="mt-4 flex items-center gap-3 border-t border-seam pt-4">
              <button
                onClick={toCalendar}
                disabled={busy !== ''}
                className="rounded-lg border border-ember px-4 py-2 text-sm text-ember disabled:opacity-50"
              >
                {busy === 'calendar' ? 'Creating…' : 'Put blocks on my calendar'}
              </button>
              {calMsg && <span className="text-sm text-moth">{calMsg}</span>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
