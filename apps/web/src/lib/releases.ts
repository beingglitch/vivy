import 'server-only';

/**
 * The latest Android build, read from GitHub Releases.
 *
 * GitHub is already the build artifact store, so making the web app a second
 * one would mean a copy that can fall behind. The tagged release is the single
 * source of truth for what "latest" means, and this just reads it.
 */

export interface AndroidRelease {
  /** Human version, from the tag: `android-v0.2.0` becomes `0.2.0`. */
  versionName: string;
  /** Android's own counter. The phone compares this, never the name. */
  versionCode: number;
  /**
   * The GitHub *API* url for the asset, not the browser one.
   *
   * A private repo's `browser_download_url` returns 404 to anyone without a
   * session, which is every phone. The API url plus a token resolves to a
   * short-lived signed link that needs no auth of its own.
   */
  assetApiUrl: string;
  sizeBytes: number;
  publishedAt: string;
  notes: string;
}

interface GhAsset {
  id: number;
  name: string;
  url: string;
  browser_download_url: string;
  size: number;
}

interface GhRelease {
  tag_name: string;
  body: string | null;
  published_at: string;
  draft: boolean;
  prerelease: boolean;
  assets: GhAsset[];
}

/** `owner/repo`. Without it there is nothing to query, and the UI says so. */
function repo(): string | null {
  return process.env['VIVY_GITHUB_REPO'] ?? null;
}

/**
 * The APK is named `vivy-<versionName>-<versionCode>.apk` by the workflow.
 *
 * Encoding the version code in the filename rather than a side file keeps the
 * release to one artifact, and means a human downloading it by hand can still
 * tell which build they have.
 */
function parseAsset(assets: GhAsset[]): { asset: GhAsset; versionCode: number } | null {
  for (const asset of assets) {
    const match = /^vivy-.*-(\d+)\.apk$/.exec(asset.name);
    if (match?.[1]) return { asset, versionCode: Number(match[1]) };
  }
  return null;
}

export async function latestAndroidRelease(): Promise<AndroidRelease | null> {
  const slug = repo();
  if (!slug) return null;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'vivy',
  };
  // Optional. Unauthenticated is 60 requests an hour per IP, which the cache
  // below keeps us well inside; a token only matters for a private repo.
  const token = process.env['GITHUB_TOKEN'];
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(`https://api.github.com/repos/${slug}/releases/latest`, {
      headers,
      // Ten minutes. The phone polls this, and a release is not urgent enough
      // to spend the rate limit on freshness.
      next: { revalidate: 600 },
    });
    if (!response.ok) return null;

    const release = (await response.json()) as GhRelease;
    if (release.draft) return null;

    const found = parseAsset(release.assets);
    if (!found) return null;

    return {
      versionName: release.tag_name.replace(/^android-v?/, ''),
      versionCode: found.versionCode,
      assetApiUrl: found.asset.url,
      sizeBytes: found.asset.size,
      publishedAt: release.published_at,
      notes: release.body?.trim() ?? '',
    };
  } catch {
    // A release feed that is down must never take a page with it.
    return null;
  }
}

/**
 * Resolve an asset to a link the phone can actually fetch.
 *
 * GitHub answers an authenticated asset request with a redirect to signed
 * object storage. That signed url carries its own short-lived credential, so
 * handing it to the client is what keeps a 7 MB download out of a serverless
 * function while still working for a private repo.
 *
 * Returns null when there is no token, because a private repo without one
 * cannot be read at all and pretending otherwise produces a 404 with no clue
 * why.
 */
export async function resolveDownloadUrl(assetApiUrl: string): Promise<string | null> {
  const token = process.env['GITHUB_TOKEN'];
  if (!token) return null;

  try {
    const response = await fetch(assetApiUrl, {
      headers: {
        Accept: 'application/octet-stream',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'vivy',
      },
      redirect: 'manual',
      cache: 'no-store',
    });

    const location = response.headers.get('location');
    if (location) return location;

    // A public repo answers 200 here instead of redirecting. Nothing to hand
    // on, so the caller falls back to the browser url.
    return null;
  } catch {
    return null;
  }
}
