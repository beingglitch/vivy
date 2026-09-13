import { latestAndroidRelease, resolveDownloadUrl } from '@/lib/releases';
import { fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/android/download - redirect to the newest APK.
 *
 * A stable url that always points at the current build, so the QR code, the
 * button in settings and the phone's updater never need changing when a release
 * is cut.
 *
 * The repo is private, so this cannot redirect to GitHub's public download
 * link: that returns 404 to anyone without a session. It exchanges the asset
 * for a short-lived signed url instead, and redirects there, which keeps a 7 MB
 * transfer out of this function.
 */
export async function GET() {
  try {
    const release = await latestAndroidRelease();
    if (!release) return fail('No published build yet.', 404);

    const signed = await resolveDownloadUrl(release.assetApiUrl);
    if (!signed) {
      return fail(
        'Cannot reach the build. Set GITHUB_TOKEN to a token with read access to the repo.',
        503,
      );
    }

    return Response.redirect(signed, 302);
  } catch (error) {
    return handleError(error);
  }
}
