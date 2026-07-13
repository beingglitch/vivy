'use client';

import { useEffect, useState } from 'react';

// The update surface: latest tagged release with per-app downloads.
// The APK is the one that matters — download on the phone, sideload, done.
type Release = {
  tag: string;
  name: string;
  publishedAt: string;
  notes: string;
  url: string;
  assets: { name: string; url: string; size: number }[];
};

const fmtSize = (b: number) => (b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);

function assetLabel(name: string): string {
  if (name.endsWith('.apk')) return 'Android — screen time app';
  if (name.includes('extension')) return 'Chrome extension';
  if (name.includes('linux-agent')) return 'Linux — desktop agent';
  return name;
}

export function AppsCard() {
  const [release, setRelease] = useState<Release | null>(null);
  const [state, setState] = useState<'loading' | 'none' | 'ok'>('loading');

  useEffect(() => {
    fetch('/api/releases')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.release) {
          setRelease(j.release);
          setState('ok');
        } else setState('none');
      })
      .catch(() => setState('none'));
  }, []);

  return (
    <section className="space-y-3 rounded-xl border border-seam bg-veil/50 p-4">
      <div>
        <h2 className="text-sm font-medium text-linen">Apps & updates</h2>
        <p className="mt-1 text-xs text-moth">
          Companion apps, built from every version tag. Install once, then this card is where
          updates appear.
        </p>
      </div>
      {state === 'loading' && <p className="text-xs text-moth">checking latest release…</p>}
      {state === 'none' && <p className="text-xs text-moth">No release published yet.</p>}
      {state === 'ok' && release && (
        <div className="space-y-2">
          <p className="text-xs text-moth">
            latest: <span className="font-mono text-ember">{release.tag}</span> ·{' '}
            {new Date(release.publishedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              timeZone: 'Asia/Kolkata',
            })}{' '}
            ·{' '}
            <a href={release.url} target="_blank" rel="noreferrer" className="underline decoration-hush hover:text-linen">
              notes
            </a>
          </p>
          <ul className="divide-y divide-seam/60 rounded-lg border border-seam">
            {release.assets.map((a) => (
              <li key={a.name} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-linen/90">{assetLabel(a.name)}</span>
                <span className="shrink-0 font-mono text-[10px] text-moth/70">{fmtSize(a.size)}</span>
                <a
                  href={a.url}
                  className="shrink-0 rounded-lg bg-ember px-2.5 py-1 text-xs font-medium text-night transition hover:brightness-110"
                >
                  download
                </a>
              </li>
            ))}
            {release.assets.length === 0 && (
              <li className="px-3 py-2 text-xs text-moth">Release has no files attached.</li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
