import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loadSteps, nextPending, progress } from '@/lib/onboarding';
import { hasPassphrase, requireUserId } from '@/lib/session';
import { currentAdmin } from '@/lib/admin';
import { accessFor } from '@/lib/access';
import { StepCard } from './step-card';

export const dynamic = 'force-dynamic';

/**
 * Onboarding.
 *
 * A queue, not a wizard: it offers the next undecided source and advances as
 * soon as one is decided, in any direction. There is no "back" because there is
 * nothing to undo, every state is editable afterwards from More > Sources.
 *
 * Order runs most-valuable-first, so someone who bails after one screen still
 * has the highest-signal collector running.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ intro?: string }>;
}) {
  const { intro } = await searchParams;
  const userId = await requireUserId();
  if (!(await hasPassphrase(userId))) redirect('/set-passphrase');
  // Onboarding connects collectors to a person's devices. An admin has none.
  if (await currentAdmin()) redirect('/admin');

  // Checked last: an admin has no access period, and someone without a
  // passphrase has not finished setting up, so neither should see this screen.
  if (!(await accessFor(userId)).allowed) redirect('/access-ended');

  const steps = await loadSteps(userId);
  const next = nextPending(steps);
  const { decided, total } = progress(steps);

  if (intro !== 'done' && decided === 0) return <Intro />;
  if (!next) return <Finished decided={decided} total={total} />;

  return (
    <>
      <div className="flow__bar">
        <div className="flow__progress" aria-hidden>
          <span style={{ width: `${(decided / total) * 100}%` }} />
        </div>
        <span className="flow__count">
          {decided} of {total} decided
        </span>
        <Link href="/" className="link">
          Finish later
        </Link>
      </div>
      <div className="flow__body">
        <StepCard source={next.source} />
      </div>
    </>
  );
}

function Intro() {
  return (
    <div className="flow__body">
      <div className="ob">
        <span className="ob__platform">Welcome</span>
        <h2 className="ob__title">Vivy watches so you don&apos;t have to remember</h2>
        <p className="ob__summary">
          One timeline of everything you do, charted across years, and an assistant that notices
          when something has gone quiet.
        </p>

        <div className="ob__section">
          <span className="eyebrow">What it can track</span>
          <ul className="ob__list">
            <li>
              <strong>Attention</strong>, screen time per app and per site, and every video you
              actually watched
            </li>
            <li>
              <strong>Money</strong>. UPI and card spending read from bank SMS in real time, with
              net worth from your holdings
            </li>
            <li>
              <strong>Work</strong>, tasks by focus area, planned on an importance-versus-effort
              map
            </li>
            <li>
              <strong>Everything else</strong>, sleep, meals, reading, whatever you tell it, by
              typing or speaking
            </li>
          </ul>
        </div>

        <div className="ob__section">
          <span className="eyebrow">How it works</span>
          <ul className="ob__list ob__list--muted">
            <li>Each device runs a small collector. You choose which, one at a time.</li>
            <li>Your phone and laptop keep their own copy, so the app works with no signal.</li>
            <li>The most sensitive streams are encrypted before they leave the device.</li>
          </ul>
        </div>

        <p className="ob__note">
          <strong>Every step is optional.</strong> Skip anything, schedule it for later, or set it
          all up now. Nothing breaks either way, you just see fewer charts.
        </p>

        <div className="ob__actions">
          <Link className="btn btn--primary" href="/onboarding?intro=done">
            Choose what to connect
          </Link>
          <div className="ob__minor">
            <Link className="btn btn--quiet" href="/">
              Skip all for now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Finished({ decided, total }: { decided: number; total: number }) {
  return (
    <div className="flow__body">
      <div className="ob">
        <span className="ob__platform">Done</span>
        <h2 className="ob__title">That&apos;s everything</h2>
        <p className="ob__summary">
          You decided on all {total} sources. Anything you skipped or scheduled is in More →
          Sources, with the same instructions, whenever you want it.
        </p>
        <div className="ob__actions">
          <Link className="btn btn--primary" href="/">
            Open Vivy
          </Link>
          <div className="ob__minor">
            <Link className="btn btn--quiet" href="/more/sources">
              Review sources ({decided})
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
