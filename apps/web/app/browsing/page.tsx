import { browsingStats, fmtDuration } from '@/lib/browsing';

export const dynamic = 'force-dynamic';

export default async function BrowsingPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = Math.min(Math.max(Number(daysParam ?? 1), 1), 30);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const stats = await browsingStats(since);

  return (
    <main className="space-y-10">
      <section className="flex items-end justify-between">
        <div>
          <h1 className="font-voice text-2xl italic">Browsing</h1>
          <p className="mt-1 text-sm text-moth">
            Last {days === 1 ? '24 hours' : `${days} days`}
            <span className="mx-2 text-seam">·</span>
            <span className="font-mono text-xs">
              {fmtDuration(stats.totalVideoSeconds)} video · {fmtDuration(stats.totalBrowseSeconds)}{' '}
              total
            </span>
          </p>
        </div>
        <div className="flex gap-1.5 text-xs">
          {[1, 7, 30].map((d) => (
            <a
              key={d}
              href={`/browsing?days=${d}`}
              className={
                d === days
                  ? 'rounded-full bg-ember px-3 py-1 font-medium text-night'
                  : 'rounded-full border border-seam px-3 py-1 text-moth transition-colors hover:border-ember/60 hover:text-linen'
              }
            >
              {d === 1 ? '24h' : `${d}d`}
            </a>
          ))}
        </div>
      </section>

      {stats.videoTypes.length > 0 && stats.totalVideoSeconds > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-medium tracking-widest text-moth uppercase">
            Video time by type
          </h2>
          <div className="space-y-3 rounded-xl border border-seam bg-veil/50 p-4">
            <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
              {stats.videoTypes.map((t) => (
                <div
                  key={t.category}
                  title={`${t.category}: ${fmtDuration(t.seconds)}`}
                  className={t.category === 'education' || t.category === 'tech' ? 'bg-sage' : t.category === 'unsorted' ? 'bg-hush' : 'bg-ember'}
                  style={{ width: `${Math.max((t.seconds / stats.totalVideoSeconds) * 100, 2)}%` }}
                />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
              {stats.videoTypes.map((t) => (
                <li key={t.category} className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${t.category === 'education' || t.category === 'tech' ? 'bg-sage' : t.category === 'unsorted' ? 'bg-hush' : 'bg-ember'}`}
                    aria-hidden
                  />
                  <span className="text-moth">{t.category}</span>
                  <span className="font-mono text-linen/90">{fmtDuration(t.seconds)}</span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-moth/60">
              green = learning · ember = leisure · gray = not yet classified (classifier runs every few hours)
            </p>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-medium tracking-widest text-moth uppercase">
          Videos watched ({stats.videos.length})
        </h2>
        {stats.videos.length === 0 ? (
          <p className="text-sm text-moth">Nothing logged — is the extension on?</p>
        ) : (
          <ul className="divide-y divide-seam/60 rounded-xl border border-seam bg-veil/50">
            {stats.videos.map((v) => (
              <li key={v.url} className="flex items-center gap-3 px-4 py-3 text-sm">
                <a
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 truncate text-linen/90 transition-colors hover:text-ember"
                >
                  {v.title}
                </a>
                <span className="shrink-0 text-xs text-moth">{v.channel}</span>
                <span className="shrink-0 font-mono text-xs text-moth">{fmtDuration(v.seconds)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-medium tracking-widest text-moth uppercase">
          Searches ({stats.searches.length})
        </h2>
        {stats.searches.length === 0 ? (
          <p className="text-sm text-moth">No searches logged.</p>
        ) : (
          <ul className="divide-y divide-seam/60 rounded-xl border border-seam bg-veil/50">
            {stats.searches.map((s, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="flex-1 truncate text-linen/90">{s.query}</span>
                <span className="shrink-0 text-xs text-moth">{s.engine}</span>
                <span className="shrink-0 font-mono text-xs text-moth/70">
                  {new Date(s.ts).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-medium tracking-widest text-moth uppercase">
          Time by site
        </h2>
        {stats.domains.length === 0 ? (
          <p className="text-sm text-moth">No page-time logged.</p>
        ) : (
          <ul className="space-y-2.5 rounded-xl border border-seam bg-veil/50 p-4">
            {stats.domains.map((d) => {
              const pct = stats.totalBrowseSeconds ? (d.seconds / stats.totalBrowseSeconds) * 100 : 0;
              return (
                <li key={d.domain} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 truncate text-moth">{d.domain}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-seam/60">
                    <div
                      className="h-full rounded-r-full bg-ember/80"
                      style={{ width: `${Math.max(pct, 1.5)}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-xs text-linen/90">
                    {fmtDuration(d.seconds)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
