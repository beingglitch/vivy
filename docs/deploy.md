# Running and deploying the web app

## Locally

Requires Node 24 (`.nvmrc`) and pnpm 10.

```bash
pnpm install
cp .env.example .env.local     # then fill it in, see below
pnpm db:migrate                # applies committed migrations to DATABASE_URL
pnpm dev                       # http://localhost:3000
```

`pnpm dev` runs Next with Turbopack and is ready in about a second. Webpack on
this repo takes ten minutes, so do not reach for `next dev` without the flag.

Env vars are read at boot. Restart the dev server after editing `.env.local`.
`.env.example` is a committed template that the app never reads; editing it
changes nothing.

### The minimum to boot

| Variable            | Why                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | Neon Postgres. Everything else is optional.                                                                                             |
| `VIVY_ADMIN_EMAILS` | Comma-separated. An empty value means nobody can sign up, because only an admin can mint invite codes. Put your own address here first. |
| `DEV_OTP_CODE`      | Fixes the email code to this value and skips sending mail. Unset it in production or codes become guessable.                            |

Web push needs the VAPID trio; without it the toggle simply does nothing. There
is no email provider wired up yet, which is why `DEV_OTP_CODE` exists: in
production today, nobody would receive a code.

### First run

There are no users in a fresh database, so `/login` cannot work. Admin emails
skip signup entirely: go to `/login`, enter an address from
`VIVY_ADMIN_EMAILS`, choose Email code, enter `987306`, and you are in. The app
then asks you to set a passphrase. Everyone else needs an invite code, which
you mint from `/admin`.

## Deploying to Vercel

The repo is a pnpm workspace, so the project must be pointed at the app rather
than the root.

```bash
pnpm dlx vercel link          # attach this directory to a Vercel project
pnpm dlx vercel --prod        # first deploy
```

In the project's settings:

- **Root directory**: `apps/web`
- **Framework preset**: Next.js
- **Install command**: leave default, Vercel detects pnpm from the lockfile
- **Node version**: 24

After the first deploy, pushes to `main` deploy to production and every other
branch gets a preview URL automatically. That is the whole CI/CD story for the
frontend: there is nothing to configure beyond connecting the repo.

`.github/workflows/ci.yml` runs typecheck and tests on every push and pull
request, and fails if migrations are not committed. It deliberately does not
build: Vercel already builds `apps/web` and a failure there blocks the deploy.
What CI adds is the part Vercel never does, which is the vitest suites in
`core`, `crypto` and `money`, the migration check, and typechecking
`packages/extension`, which Vercel never compiles.

### Environment variables on Vercel

Set the same variables in Project Settings, Environment Variables, for
Production and Preview. Two differences from local:

- **Unset `DEV_OTP_CODE`** in production. Leaving it set means anyone who knows
  the value can sign in as anyone.
- **Set `CRON_SECRET`**. `vercel.json` schedules `/api/push/run` every fifteen
  minutes, and the route rejects calls without a matching Bearer token so it
  cannot be triggered by anyone who finds the URL.
- **Set `GITHUB_TOKEN`** to a fine-grained personal access token with
  `Contents: read` on `beingglitch/vivy`. Set `VIVY_GITHUB_REPO` only when a
  fork should provide the APK. Without the token GitHub returns 404 for the
  private release and the download button explains the problem. The token is
  read server side only and never reaches the browser or the phone.

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` must match `VAPID_PUBLIC_KEY`. It is the same
value, exposed to the browser, which is why it carries the prefix.

### The database

Neon, via the Vercel Marketplace. Attaching it sets `DATABASE_URL` on the
project automatically.

Migrations are committed under `packages/db/migrations` and applied by
`pnpm db:migrate`. Run it against production once after the first deploy, and
again after any schema change:

```bash
DATABASE_URL="<production url>" pnpm db:migrate
```

It is deliberately not part of the deploy: a migration that runs automatically
on every deploy is a migration that can take the site down at the worst moment.

Do not use `drizzle-kit push` against anything you care about. It prompts
interactively and will happily rewrite tables.

## Installing it as an app

It is a PWA, so there is no store.

- **Android/Chrome**: open the site, menu, Add to home screen. It then runs
  fullscreen and can receive push notifications.
- **iOS/Safari**: Share, Add to Home Screen. Push works only once added this
  way.
- **Desktop Chrome**: the install icon at the right of the address bar.

The service worker at `public/sw.js` handles push and is registered on first
load. If notifications stop working after a deploy, unregister it in DevTools,
Application, Service Workers and reload: a cached worker is the usual cause.
