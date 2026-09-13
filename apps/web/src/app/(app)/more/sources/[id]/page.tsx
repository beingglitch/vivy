import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sourceById } from '@vivy/core';
import { Dock } from '@/components/shell';
import { loadSteps } from '@/lib/onboarding';
import { listDevices } from '@/lib/devices';
import { requireUserId } from '@/lib/session';
import { SourceControls } from './controls';
import { Pairing } from './pairing';

export const dynamic = 'force-dynamic';

/**
 * One source, in full.
 *
 * Same content the onboarding card shows, minus the queue: what it unlocks, what
 * it needs, what it can see, and every setup step with the thing to download and
 * the command to run. Reachable forever, so skipping during first run costs
 * nothing but a tap later.
 */
export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = sourceById(id);
  if (!source) notFound();

  const userId = await requireUserId();
  const steps = await loadSteps(userId);
  const state = steps.find((s) => s.source.id === id);
  const planned = source.availability === 'planned';

  // The Android collector is the only source that needs a credential from here.
  // The rest are either browser extensions or read-only API keys the user holds.
  const paired = id === 'android' && !planned ? await listDevices(userId, 'android') : null;

  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <Link href="/more/sources" className="src__back">
              ← Sources
            </Link>
            <h1 className="title">{source.name}</h1>
            <span className="subtitle">{source.summary}</span>
          </div>
        </div>
      </div>

      <div className="screen">
        <section className="src__section">
          <span className="eyebrow">What this turns on</span>
          <ul className="ob__list">
            {source.gives.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>

        {source.requires.length > 0 ? (
          <section className="src__section">
            <span className="eyebrow">What it needs from you</span>
            <ul className="ob__list ob__list--muted">
              {source.requires.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {source.seesNote ? (
          <section className="src__section">
            <p className="ob__note">
              <strong>What it can see.</strong> {source.seesNote}
            </p>
          </section>
        ) : null}

        <section className="src__section">
          <span className="eyebrow">
            {planned ? 'Setup, once it ships' : `Setup · about ${source.minutes} minutes`}
          </span>
          <ol className="ob__steps">
            {source.steps.map((s, i) => (
              <li key={s.title}>
                <span className="ob__stepTitle">
                  {i + 1}. {s.title}
                </span>
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
        </section>

        {source.withoutIt ? (
          <section className="src__section">
            <p className="ob__cost">
              <strong>Without it:</strong> {source.withoutIt}
            </p>
          </section>
        ) : null}

        {paired ? <Pairing devices={paired} /> : null}

        <SourceControls
          sourceId={source.id}
          status={state?.status ?? 'pending'}
          planned={planned}
        />
      </div>

      <Dock />
    </>
  );
}
