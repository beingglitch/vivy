import { latestAndroidRelease } from '@/lib/releases';
import { fail, handleError, ok } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/android/latest - what the newest build is.
 *
 * Deliberately unauthenticated. It returns a version number and a public
 * GitHub link, which is not information worth protecting, and requiring a
 * device token would mean an unpaired phone could never discover an update.
 */
export async function GET() {
  try {
    const release = await latestAndroidRelease();
    if (!release) return fail('No published build yet.', 404);

    // The asset's API url is deliberately not sent. The phone downloads through
    // /api/android/download, so the only thing it needs to know is the version.
    const { assetApiUrl: _assetApiUrl, ...publicFields } = release;
    return ok(publicFields);
  } catch (error) {
    return handleError(error);
  }
}
