import Link from 'next/link';
import { headers } from 'next/headers';
import { ChevronIcon } from '@/components/icons';
import { Dock } from '@/components/shell';
import { PushToggle } from '@/components/push-toggle';
import { loadSteps, type StepState } from '@/lib/onboarding';
import { requirePageUserId } from '@/lib/page-session';
import { lookupAndroidRelease } from '@/lib/releases';
import { listDevices } from '@/lib/devices';
import { AndroidApp } from '../settings/android-app';

export const dynamic = 'force-dynamic';

/**
 * Ingestors.
 *
 * The permanent home of everything onboarding offers. Skipping in the flow puts
 * a source here rather than losing it, which is what makes "skip" safe to press:
 * the instructions are identical and nothing has to be remembered.
 *
 * Status is stated plainly and never scolds. A skipped source reads "skipped",
 * not "incomplete".
 */
export default async function IngestorsPage() {
  const userId = await requirePageUserId();
  const [steps, lookup, phones, head] = await Promise.all([
    loadSteps(userId),
    lookupAndroidRelease(),
    listDevices(userId, 'android'),
    headers(),
  ]);
  const connected = steps.filter((s) => s.status === 'done').length;
  const host = head.get('host') ?? 'localhost:3000';
  const proto = head.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');

  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Ingestors</h1>
            <span className="subtitle">
              {connected} of {steps.length} connected
            </span>
          </div>
        </div>
      </div>

      <div className="screen">
        {steps.map((step) => (
          <Link key={step.source.id} href={`/more/sources/${step.source.id}`} className="src">
            <span className="src__top">
              <span className="src__name">{step.source.name}</span>
              <StatusPill step={step} />
              <span style={{ flex: 1 }} />
              <ChevronIcon />
            </span>
            <span className="src__summary">{step.source.summary}</span>
          </Link>
        ))}

        <AndroidApp
          release={lookup.ok ? lookup.release : null}
          origin={`${proto}://${host}`}
          phones={phones}
          problem={lookup.ok ? undefined : lookup.problem}
        />

        <section className="src__section">
          <span className="eyebrow">Reminders</span>
          <PushToggle publicKey={process.env['NEXT_PUBLIC_VAPID_PUBLIC_KEY']} />
        </section>

        <p className="src__foot">
          Every source is optional. Connecting one only adds charts, nothing here is required for
          the rest of Vivy to work.
        </p>
      </div>

      <Dock />
    </>
  );
}

function StatusPill({ step }: { step: StepState }) {
  if (step.source.availability === 'planned' && step.status !== 'done') {
    return <span className="srcpill srcpill--soon">coming soon</span>;
  }

  switch (step.status) {
    case 'done':
      return <span className="srcpill srcpill--on">connected</span>;
    case 'skipped':
      return <span className="srcpill">skipped</span>;
    case 'scheduled':
      return (
        <span className="srcpill srcpill--later">
          {step.scheduledFor
            ? `reminder ${step.scheduledFor.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
              })}`
            : 'scheduled'}
        </span>
      );
    default:
      return <span className="srcpill">not set up</span>;
  }
}
