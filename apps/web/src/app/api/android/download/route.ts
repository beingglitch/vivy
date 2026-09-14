import { fetchReleaseAsset, lookupAndroidRelease, RELEASE_PROBLEMS } from '@/lib/releases';
import { fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/android/download - redirect to the newest APK.
 *
 * A stable url that always points at the current build, so the QR code, the
 * settings button and the phone's updater never change when a release is cut.
 *
 * The repo is private, so this cannot use GitHub's public download link. It
 * redirects to GitHub's short-lived signed URL when available, and streams the
 * authenticated response only when GitHub returns the APK directly.
 */
export async function GET() {
  try {
    const result = await lookupAndroidRelease();
    if (!result.ok) {
      return fail(RELEASE_PROBLEMS[result.problem], 404, { problem: result.problem });
    }

    const asset = await fetchReleaseAsset(result.release.assetApiUrl);
    if (!asset) return fail(RELEASE_PROBLEMS['no-token'], 503, { problem: 'no-token' });

    const signed = asset.headers.get('location');
    if (signed) return Response.redirect(signed, 302);
    if (!asset.ok || !asset.body) {
      return fail('GitHub did not return the APK.', 502, { problem: 'unreachable' });
    }

    return new Response(asset.body, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${result.release.assetName}"`,
        'Content-Length': String(result.release.sizeBytes),
        'Content-Type': 'application/vnd.android.package-archive',
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
