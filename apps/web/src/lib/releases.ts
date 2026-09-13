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

/**
 * Why there is no build to offer.
 *
 * One 404 for four different causes is a bad afternoon: unset variable, wrong
 * token, no release, wrong filename all look identical from outside. Each one
 * has a different fix, so each gets its own name.
 */
export type ReleaseProblem =
  | 'no-repo'
  | 'no-token'
  | 'unauthorized'
  | 'no-access'
  | 'no-release'
  | 'no-asset'
  | 'unreachable';

export type ReleaseLookup =
  | { ok: true; release: AndroidRelease }
  | { ok: false; problem: ReleaseProblem };

/** What each problem means, in words meant for the person who has to fix it. */
export const RELEASE_PROBLEMS: Record<ReleaseProblem, string> = {
  'no-repo': 'Set VIVY_GITHUB_REPO to owner/repo, then redeploy.',
  'no-token':
    'The repo is private, so GITHUB_TOKEN is required. Use a fine-grained token with Contents: read.',
  unauthorized:
    'GitHub refused the token. Check it has Contents: read on this repo and has not expired.',
  'no-access':
    'The token cannot see this repo. Check VIVY_GITHUB_REPO is right, and that the token grants Contents: read on it.',
  'no-release': 'No release published yet. Tag one: git tag android-v0.1.0 && git push --follow-tags',
  'no-asset':
    'The release has no APK named vivy-<version>-<versionCode>.apk. Check the workflow finished.',
  unreachable: 'Could not reach GitHub. It may be a transient outage.',
};

export async function lookupAndroidRelease(): Promise<ReleaseLookup> {
  const slug = repo();
  if (!slug) return { ok: false, problem: 'no-repo' };

  const token = process.env['GITHUB_TOKEN'];
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'vivy',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(`https://api.github.com/repos/${slug}/releases/latest`, {
      headers,
      next: { revalidate: 600 },
    });

    if (!response.ok) {
      // A private repo answers 404 rather than 403 to anyone who cannot see
      // it, so a missing token and a wrong one are told apart by whether we
      // sent one at all.
      if (response.status === 404) {
        if (!token) return { ok: false, problem: 'no-token' };
        // GitHub returns 404, never 403, for a private repo the caller cannot
        // see. So "no release" and "wrong token" look identical here. Asking
        // for the repo itself separates them: visible means the releases list
        // really is empty.
        return { ok: false, problem: (await canSeeRepo(slug, token)) ? 'no-release' : 'no-access' };
      }
      if (response.status === 401 || response.status === 403) {
        return { ok: false, problem: 'unauthorized' };
      }
      return { ok: false, problem: 'unreachable' };
    }

    const release = (await response.json()) as GhRelease;
    if (release.draft) return { ok: false, problem: 'no-release' };

    const found = parseAsset(release.assets);
    if (!found) return { ok: false, problem: 'no-asset' };

    return {
      ok: true,
      release: {
        versionName: release.tag_name.replace(/^android-v?/, ''),
        versionCode: found.versionCode,
        assetApiUrl: found.asset.url,
        sizeBytes: found.asset.size,
        publishedAt: release.published_at,
        notes: release.body?.trim() ?? '',
      },
    };
  } catch {
    return { ok: false, problem: 'unreachable' };
  }
}

/** Can this token see the repository at all? Used only to sharpen a 404. */
async function canSeeRepo(slug: string, token: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.github.com/repos/${slug}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'vivy',
      },
      next: { revalidate: 600 },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** The common case, for callers that only care whether there is a build. */
export async function latestAndroidRelease(): Promise<AndroidRelease | null> {
  const result = await lookupAndroidRelease();
  return result.ok ? result.release : null;
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
