import { lookupAndroidRelease, RELEASE_PROBLEMS } from '@/lib/releases';
import { fail, handleError, ok } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/android/latest - what the newest build is.
 *
 * Unauthenticated on purpose: it returns a version number, which is not worth
 * protecting, and requiring a device token would mean a phone that is not
 * signed in could never discover an update.
 *
 * The 404 carries a `problem` naming which of the several causes it is. They
 * are indistinguishable from outside otherwise, and each has a different fix.
 */
export async function GET() {
  try {
    const result = await lookupAndroidRelease();
    if (!result.ok) {
      return fail(RELEASE_PROBLEMS[result.problem], 404, { problem: result.problem });
    }

    // The asset's API url is deliberately withheld. The phone downloads through
    // /api/android/download, so all it needs from here is the version.
    const { assetApiUrl: _assetApiUrl, assetName: _assetName, ...publicFields } = result.release;
    return ok(publicFields);
  } catch (error) {
    return handleError(error);
  }
}
