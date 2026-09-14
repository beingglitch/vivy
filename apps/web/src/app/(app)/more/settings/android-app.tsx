import type { PairedDevice } from '@/lib/devices';
import { RELEASE_PROBLEMS, type AndroidRelease, type ReleaseProblem } from '@/lib/releases';

/**
 * Get the app onto the phone.
 *
 * Two paths, because the useful one depends on which screen you are reading
 * this on. On the phone, tap and install. On a laptop, the QR is the shortest
 * route to the phone's browser, and typing a Vercel URL by hand is not.
 */
export function AndroidApp({
  release,
  origin,
  phones,
  problem,
}: {
  release: AndroidRelease | null;
  origin: string;
  phones: PairedDevice[];
  problem?: ReleaseProblem | undefined;
}) {
  // A phone that has never reported a version is not out of date, it is
  // unknown. Treating the two the same would nag about a build that is fine.
  const behind = release
    ? phones.filter((p) => p.appVersionCode !== null && p.appVersionCode < release.versionCode)
    : [];
  if (!release) {
    return (
      <section className="src__section">
        <span className="eyebrow">Android app</span>
        <p className="src__controlNote">
          {problem ? RELEASE_PROBLEMS[problem] : 'No build available yet.'}
        </p>
        {problem === 'no-release' ? (
          <code className="ob__cmd">git tag android-v0.2.0 &amp;&amp; git push --follow-tags</code>
        ) : null}
      </section>
    );
  }

  const url = `${origin}/api/android/download`;

  return (
    <section className="src__section">
      <span className="eyebrow">Android app</span>

      {behind.length > 0 ? (
        <div className="apk__alert">
          <strong>Update available.</strong>{' '}
          {behind.length === 1
            ? `${behind[0]?.label ?? 'Your phone'} is on ${behind[0]?.appVersionName ?? 'an older build'}.`
            : `${behind.length} phones are on an older build.`}{' '}
          Download it here, open the file on the phone, and install over the old one.
        </div>
      ) : null}

      <div className="apk">
        <div className="apk__meta">
          <span className="apk__version">
            {release.versionName}
            <span className="apk__code"> build {release.versionCode}</span>
          </span>
          <span className="apk__sub">
            {(release.sizeBytes / 1_048_576).toFixed(1)} MB · published{' '}
            {new Date(release.publishedAt).toLocaleDateString()}
          </span>
        </div>
        <a className="btn btn--primary" href="/api/android/download">
          Download APK
        </a>
      </div>

      <div className="apk__qr">
        {/* Rendered by the QR service at request time rather than bundling a
            library: this is one image on one screen. */}
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=0&data=${encodeURIComponent(url)}`}
          alt={`QR code linking to ${url}`}
          width={160}
          height={160}
        />
        <p className="src__controlNote">
          Scan this with the phone to download it there. Android will ask whether to allow your
          browser to install apps: that permission is per-app, not global.
        </p>
      </div>

      <p className="src__controlNote">
        Sideloaded, not from the Play Store. Play forbids reading bank messages for anything that is
        not your default messaging app, which is the whole reason the app exists.
      </p>

      {phones.length > 0 ? (
        <ul className="apk__phones">
          {phones.map((p) => {
            const stale = p.appVersionCode !== null && p.appVersionCode < release.versionCode;
            return (
              <li key={p.id} className="apk__phone">
                <span className="apk__phoneName">{p.label}</span>
                <span className={stale ? 'apk__stale' : 'apk__current'}>
                  {p.appVersionName ?? 'version not reported yet'}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {release.notes ? (
        <details className="apk__notes">
          <summary>What changed</summary>
          <pre>{release.notes}</pre>
        </details>
      ) : null}
    </section>
  );
}
