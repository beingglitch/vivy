import { lookupAndroidRelease, RELEASE_PROBLEMS, resolveDownloadUrl } from '@/lib/releases';
import { fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/android/download - redirect to the newest APK.
 *
 * A stable url that always points at the current build, so the QR code, the
 * settings button and the phone's updater never change when a release is cut.
 *
 * The repo is private, so this cannot redirect to GitHub's public download
 * link, which returns 404 to anyone without a session. It exchanges the asset
 * for a short-lived signed url and redirects there, keeping a 7 MB transfer
 * out of this function.
 */
export async function GET() {
  try {
    const result = await lookupAndroidRelease();
    if (!result.ok) {
      return fail(RELEASE_PROBLEMS[result.problem], 404, { problem: result.problem });
    }

    const signed = await resolveDownloadUrl(result.release.assetApiUrl);
    if (!signed) return fail(RELEASE_PROBLEMS['no-token'], 503, { problem: 'no-token' });

    return Response.redirect(signed, 302);
  } catch (error) {
    return handleError(error);
  }
}
