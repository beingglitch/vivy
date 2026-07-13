import { NextResponse } from 'next/server';

// Latest GitHub Release for the update card on /settings. The repo is public,
// so no token — just cache politely (GitHub rate-limits anonymous calls).
const REPO = 'beingglitch/vivy';

export async function GET() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
    next: { revalidate: 300 },
  }).catch(() => null);

  if (!res || res.status === 404) return NextResponse.json({ release: null });
  if (!res.ok) return NextResponse.json({ error: `github ${res.status}` }, { status: 502 });

  const r = await res.json();
  return NextResponse.json({
    release: {
      tag: r.tag_name,
      name: r.name || r.tag_name,
      publishedAt: r.published_at,
      notes: (r.body ?? '').slice(0, 2000),
      url: r.html_url,
      assets: (r.assets ?? []).map((a: { name: string; browser_download_url: string; size: number }) => ({
        name: a.name,
        url: a.browser_download_url,
        size: a.size,
      })),
    },
  });
}
