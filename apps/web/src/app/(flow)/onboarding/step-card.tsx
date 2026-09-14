'use client';

import { useState, useTransition } from 'react';
import type { IngestSource } from '@vivy/core';
import { completeStep, scheduleStep, skipStep, type LaterWhen } from './actions';

/**
 * One source, offered.
 *
 * The three actions are deliberately equal in weight. "Set up" is the accent
 * button because it is the common case, but skipping is a plain, reachable
 * control rather than a greyed-out afterthought, the whole flow is optional and
 * the interface should not pretend otherwise.
 */

const LATER_OPTIONS: readonly { id: LaterWhen; label: string }[] = [
  { id: 'hour', label: 'In an hour' },
  { id: 'tonight', label: 'Tonight' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'week', label: 'Next week' },
];

export function StepCard({ source }: { source: IngestSource }) {
  const [pending, start] = useTransition();
  const [showLater, setShowLater] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const planned = source.availability === 'planned';

  return (
    <div className="ob">
      <div className="ob__head">
        <span className="ob__platform">{source.platform}</span>
        {planned ? <span className="ob__soon">Coming soon</span> : null}
      </div>

      <h2 className="ob__title">{source.name}</h2>
      <p className="ob__summary">{source.summary}</p>

      {planned ? (
        <p className="ob__soonNote">
          <strong>Coming soon.</strong> This collector is not built yet, so there is nothing to
          connect today. Here is what it will do and what it will ask for, so you know what is
          coming, it will appear in More &rarr; Ingestors with working steps when it ships.
        </p>
      ) : null}

      <div className="ob__section">
        <span className="eyebrow">{planned ? 'What it will turn on' : 'What this turns on'}</span>
        <ul className="ob__list">
          {source.gives.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </div>

      {source.requires.length > 0 ? (
        <div className="ob__section">
          <span className="eyebrow">
            {planned ? 'What it will need from you' : 'What it needs from you'}
          </span>
          <ul className="ob__list ob__list--muted">
            {source.requires.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {source.seesNote ? (
        <p className="ob__note">
          <strong>What it can see.</strong> {source.seesNote}
        </p>
      ) : null}

      {source.withoutIt ? (
        <p className="ob__cost">
          <strong>If you skip:</strong> {source.withoutIt}
        </p>
      ) : null}

      {showSteps ? (
        <ol className="ob__steps">
          {source.steps.map((s) => (
            <li key={s.title}>
              <span className="ob__stepTitle">{s.title}</span>
              <span className="ob__stepDetail">{s.detail}</span>
              {s.command ? <code className="ob__cmd">{s.command}</code> : null}
              {s.link ? (
                <a className="link" href={s.link.href} target="_blank" rel="noreferrer">
                  {s.link.label} ↗
                </a>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      <div className="ob__actions">
        {planned ? (
          <button
            className="btn btn--primary"
            disabled={pending}
            onClick={() => start(() => void skipStep(source.id))}
          >
            Got it, continue
          </button>
        ) : (
          <>
            <button className="btn btn--primary" onClick={() => setShowSteps((v) => !v)}>
              {showSteps ? 'Hide steps' : `Set up now · ${source.minutes} min`}
            </button>
            {showSteps ? (
              <button
                className="btn"
                disabled={pending}
                onClick={() => start(() => void completeStep(source.id))}
              >
                Done, it&apos;s connected
              </button>
            ) : null}
          </>
        )}

        <div className="ob__minor">
          <button className="btn btn--quiet" onClick={() => setShowLater((v) => !v)}>
            Remind me later
          </button>
          <button
            className="btn btn--quiet"
            disabled={pending}
            onClick={() => start(() => void skipStep(source.id))}
          >
            Skip
          </button>
        </div>

        {showLater ? (
          <div className="ob__later">
            {LATER_OPTIONS.map((o) => (
              <button
                key={o.id}
                className="chip"
                disabled={pending}
                onClick={() => start(() => void scheduleStep(source.id, o.id))}
              >
                {o.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <p className="ob__escape">
        Nothing here is required. Everything you skip stays in <strong>More → Ingestors</strong>{' '}
        with the same instructions.
      </p>
    </div>
  );
}
