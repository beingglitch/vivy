# The Android collector

The phone is the only device that can see two things nothing else can: per-app
screen time, and bank SMS. That is the entire reason this app exists. It has one
screen, no account, and no login: it is paired to your Vivy account with a token
and then it is quiet.

## What it captures

| What | Permission | Notes |
| --- | --- | --- |
| Per-app foreground sessions | Usage access | Granted in system Settings, not a popup. Read on a cursor so a window is never counted twice. |
| Bank transaction messages | RECEIVE_SMS, READ_SMS | Only messages carrying an amount and a transaction word. One-time codes are dropped before storage. |

Nothing else is read. There is no accessibility service in this build, so
in-app content (which reel, which video) is not captured yet.

## How it works

Every collector writes to a Room table called the outbox and nothing talks to
the network directly. A WorkManager job runs every fifteen minutes, collects,
then POSTs the batch to `/api/sync/push`. No signal, server down, battery saver
killing the job: the only consequence is a longer queue.

Sends are idempotent on `dedupeKey`, so a timeout mid-flight is resent rather
than dropped. Synced rows older than thirty days are evicted; the server is the
archive, the phone is not.

## Build it

Requires JDK 17 and an Android SDK with platform 34.

```bash
cd android
echo "sdk.dir=$HOME/Android/Sdk" > local.properties
./gradlew assembleRelease
```

The APK lands at `app/build/outputs/apk/release/app-release.apk`, about 7 MB.

Release builds are signed with the **debug key** so that a plain
`assembleRelease` produces something installable. That is fine for a sideloaded
personal app and wrong for anything distributed. Before this app ever goes to
anyone else, generate a real key and point `signingConfigs` at it.

## Install it

Sideloading, because this app cannot be on the Play Store: Play forbids SMS
reading for anything that is not the default messaging app.

### From the web app (the normal way)

1. Open Vivy, go to More, Settings, Android app.
2. On the phone, tap **Download APK**. On a laptop, scan the QR code shown
   there, which opens the same download on the phone.
3. Open the downloaded file.
4. Android asks whether to allow this app to install unknown apps. Allow it for
   the browser you used. This is per-app, not global.
5. Install, then open.

That download always points at the newest published release, so the QR code and
the button never need updating when you cut a build.

### Over adb

```bash
adb devices          # phone must show "device", not "unauthorized"
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

`-r` reinstalls over an existing copy and keeps its data. Requires USB debugging
on: Settings, About phone, tap Build number seven times, then Developer options,
USB debugging.

If `adb install` fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, the installed
copy was signed with a different key. Uninstall first, which erases the local
outbox but loses nothing already synced.

## Sign in

Open the app and sign in with the same email as the web app. Two ways, the same
two the web offers:

- **Email code**, the default here. Six digits, and they arrive on this phone.
- **Passphrase**, if you would rather not wait for mail.

What happens underneath is the part worth knowing: the app sends your
credentials once to `/api/devices/login`, gets back a device token, and stores
only that. **The passphrase is never written to the phone.** The token can do
exactly one thing, append to your ingest. It cannot read your data, change
settings, or sign in on the web, so a lost phone leaks write access to one
account rather than the account itself.

The phone names itself from its model, so there is nothing to type. It appears
in More, Sources, Android app, where you can unpair it.

The server address is baked into the build. To point a build somewhere else:

```bash
./gradlew assembleRelease -PvivyEndpoint=https://your-instance.example.com
```

There is also a "Change" link under the sign-in button for running against a
local dev server.

### Pairing by token instead

More, Sources, Android app on the web still mints a token by hand. That is the
fallback for when you cannot sign in on the phone. The token is shown once, and
only its SHA-256 hash is stored, so losing it means generating another.

## Controls

Everything the app sends has a switch on the main screen:

| Control | What it does |
| --- | --- |
| App screen time | Off means usage is not collected at all, not merely not sent. |
| Bank messages | Off means an incoming message is never written down. The receiver returns before storing. |
| Pause sending | Keeps capturing, stops uploading. The queue holds until you turn it off. |
| Wifi only | Waits for unmetered network instead of using mobile data. |
| Sign out | Stops sending and forgets the token. Captured rows stay on the phone. |

Turning a collector off stops collection at the source. It does not remove
anything already sent: delete that from Vivy on the web.

## Check it is working

The app's own counters are the answer:

- **Captured** is everything the phone has ever collected. Zero after granting
  usage access means collection is not running.
- **Queued** is what has not reached the server. Steadily rising means sync is
  failing.
- **Sent** should be climbing within fifteen minutes, or immediately after
  Send now.

Beyond that:

```bash
adb logcat -s VivyApi   # push rejections, without payloads
```

A `push rejected with 401` means the token is wrong or was revoked. `403` means
the device name does not match what the server issued.

## CI/CD

`.github/workflows/android.yml` builds the APK on every push to `main` that
touches `android/`, on pull requests, and on demand from the Actions tab.

**To get an APK from CI:** open the Actions tab, pick a run, download the `apk`
artifact from the bottom of the run page. Artifacts are kept 90 days. That
download is the install path: open it on the phone.

**To cut a release:** bump `versionCode` and `versionName`, then tag. See
Bumping the version below for the exact steps.

The workflow attaches the APK to a GitHub release, and that release is what the
web app reads. On Vercel set:

- `VIVY_GITHUB_REPO` to `owner/repo`
- `GITHUB_TOKEN` to a fine-grained PAT with `Contents: read` on that repo

Both are needed because the repo is private. A private release asset's public
download link returns 404 to anyone without a session, so the web app exchanges
it for a short-lived signed link instead, which the phone can fetch and which
keeps the 7 MB transfer out of the serverless function. The token stays server
side; it is never sent to the browser or the phone.

Then `/api/android/download` serves the newest build and `/api/android/latest`
answers update checks. Without the variables the settings page just tells you to
tag a build.

The build caches the Gradle distribution and dependency cache via
`gradle/actions/setup-gradle`, which is most of the wall clock on a cold run. A
warm run is around two minutes.

There is no signing secret in CI because the debug key is checked into the
Android SDK by design. When you move to a real key, the keystore goes in as a
base64 repository secret and the workflow writes it to disk before the build
step. Do not commit a keystore.

## Updating

Two places tell you, and they use the same release feed.

**In the PWA.** Every sync reports the app's `versionCode`, so Settings knows
what each phone is running. When one is behind the newest release it shows
"Update available" with the phone's current version, and the Download APK button
fetches the new build. Install it over the old one; Android keeps the app's
data, so you stay signed in and the queue survives.

A phone that has never reported a version shows "version not reported yet"
rather than being called out of date, because unknown is not the same as stale.

**In the app.** Version, then Check. If there is a newer build, Update
downloads it and hands it to Android, which shows its own confirmation screen.
The app cannot install silently, which is the point: an app that can replace itself without asking is
an app that can quietly become something else.

The check compares `versionCode`, never the version name, because that is the
only value Android itself orders.

## Bumping the version

`versionCode` in `app/build.gradle.kts` must increase for Android to treat a
build as an update. It is `1` today. Increment it with every APK you install
over another, or the install is rejected.

It is also what makes the whole update path work. The CI workflow reads it and
names the artifact `vivy-<versionName>-<versionCode>.apk`; the web app parses
that filename to answer `/api/android/latest`; the phone compares it against its
own. Forget to bump it and a new release is invisible to every installed copy.

So a release is two edits and a tag:

```bash
# in android/app/build.gradle.kts
#   versionCode = 2
#   versionName = "0.2.0"
git commit -am "android 0.2.0"
git tag android-v0.2.0
git push --follow-tags
```
