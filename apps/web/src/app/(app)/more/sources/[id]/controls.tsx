'use client';

import { useTransition } from 'react';
import { completeStep, resetStep, skipStep } from '@/app/(flow)/onboarding/actions';
import type { StepStatus } from '@/lib/onboarding';

/**
 * Mark a source connected, or put it back.
 *
 * Reuses the onboarding actions rather than duplicating them, so the two places
 * a source can be decided cannot drift into different behaviour.
 */
export function SourceControls({
  sourceId,
  status,
  planned,
}: {
  sourceId: string;
  status: StepStatus;
  planned: boolean;
}) {
  const [pending, start] = useTransition();

  if (planned) {
    return (
      <div className="src__controls">
        <p className="src__controlNote">
          Coming soon, this collector is not built yet, so there is nothing to connect. The steps above are what it will ask for.
        </p>
      </div>
    );
  }

  return (
    <div className="src__controls">
      {status === 'done' ? (
        <>
          <p className="src__controlNote">Marked as connected.</p>
          <button
            className="btn btn--quiet"
            disabled={pending}
            onClick={() => start(() => void resetStep(sourceId))}
          >
            Mark as not set up
          </button>
        </>
      ) : (
        <>
          <button
            className="btn btn--primary"
            disabled={pending}
            onClick={() => start(() => void completeStep(sourceId))}
          >
            I&apos;ve set this up
          </button>
          {status !== 'skipped' ? (
            <button
              className="btn btn--quiet"
              disabled={pending}
              onClick={() => start(() => void skipStep(sourceId))}
            >
              Don&apos;t ask again
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
