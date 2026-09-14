# Vivy

A personal life tracker: one timeline where everything is an event, charts over
all of it, and an assistant that notices things.

Full system design covering architecture, capture matrix, money rails, security model,
cost and glossary: **https://claude.ai/code/artifact/86718ce3-5464-4727-b380-0f29ab9f7867**

## The shape in one paragraph

Collectors on each device write **raw observations** into a local database and
never talk to the network directly. A background sync pushes an outbox to the
cloud and pulls back a window of recent data plus **every daily rollup, forever**.
The UI only ever reads the local database, so the app works with the network off.
Meaning is derived downstream, which means a better parser retroactively fixes
history rather than starting a new stream from zero.

## Layout

```
vivy/
├── packages/
│   ├── core/            THE contract. Event schemas, sync protocol, streams.
│   │                    Change a shape here and four builds break at once.
│   └── db/              Drizzle schema + checked-in migrations (cloud Postgres).
├── apps/
│   ├── web/             Next.js. Sync endpoints, cron jobs, and the PWA.
│   ├── extension/       MV3. Tab/idle accounting + YouTube watch capture.
│   └── daemon/          Linux collector (ActivityWatch bridge).  [P5]
├── android/             Kotlin. Usage stats and bank SMS, synced through an outbox.
└── docs/
    ├── adr/             Why things are the way they are. Read these first.
    ├── deploy.md        Running the web app locally, and deploying it.
    └── android.md       Building, installing and shipping the phone collector.
```

`@vivy/core` has two entry points on purpose:

```ts
import { dedupeKey } from '@vivy/core/runtime'; // zero-dependency helpers
import type { VivyEvent } from '@vivy/core'; // types, erased at compile time
```

Collectors use both and ship no validator. The server imports the barrel, because
it is the one place that must validate untrusted input. This keeps the whole
extension bundle at ~7 kB instead of ~100 kB.

## Getting started

The database is Neon, provisioned through the Vercel Marketplace, so credentials
come from the linked project rather than being typed by hand.

```bash
pnpm install

vercel link --yes --project vivy-tracker    # already done; recreates .vercel if lost
vercel env pull .env.local --yes            # writes DATABASE_URL and friends

pnpm db:migrate                             # apply migrations
pnpm dev                                    # http://localhost:3000
```

Two things that will bite you otherwise:

- **`apps/web/.env.local` is a symlink to the repo root.** Next only auto-loads
  `.env.local` from the app directory, but `vercel env pull` writes it beside
  `.vercel/` at the root. The symlink keeps one canonical file. If the page says
  "No database yet" while `DATABASE_URL` is clearly set, that link is missing.
- **`drizzle-kit` does not read `.env.local` at all.** `pnpm db:migrate` needs the
  vars exported first: `set -a; . .env.local; set +a`.

Dev runs on Turbopack (`next dev --turbopack`). Webpack takes minutes to compile
this workspace because the shared packages ship TypeScript source; Turbopack is
ready in about a second.

> This repo is `vivy-tracker` on Vercel. There is a separate, older `vivy` project
> with its own Neon database holding live data (tasks, transactions, net worth), > that one backs the existing Vivy assistant and is deliberately untouched here.

### Pairing the extension

```bash
pnpm --filter @vivy/extension build     # → apps/extension/dist

curl -sX POST http://localhost:3000/api/devices/pair \
  -H 'content-type: application/json' \
  -d '{"pairingSecret":"<VIVY_PAIRING_SECRET>","deviceId":"chrome-laptop",
       "label":"Laptop Chrome","platform":"chrome"}'
```

The response contains the device token **once**, only its hash is stored, and no
endpoint can read it back. Load `apps/extension/dist` at `chrome://extensions`
(developer mode → Load unpacked), open its options page, and paste the endpoint,
device id and token.

Browse for a minute, then reload `localhost:3000`. If the counters move, the whole
pipe from browser to Postgres works.

## Checks

```bash
pnpm typecheck    # strict: noUncheckedIndexedAccess, exactOptionalPropertyTypes
pnpm test
pnpm build
```

## Conventions worth knowing

- **Money is integer minor units** (paise). Floating-point rupees drift, and a
  ledger that disagrees with itself by a rounding error is worse than none.
- **`dedupeKey` must be deterministic.** Build it from the observation, never from
  `Date.now()` at send time, that silently disables replay safety.
- **Never log a payload.** Identifiers only, in errors and logs alike. This is the
  leak that catches people who did everything else right.
- **Collectors classify nothing.** Write `category: null` and let the on-device
  model fill it in later, over the whole archive.

## Screens

Every screen in `apps/web/src/app/(app)/` is drawn from the canvas
(`~/Downloads/Life Tracker Mobile.dc.html`), tokens, type scale and spacing
lifted from it rather than approximated.

| Route         | Screen        | Notes                                              |
| ------------- | ------------- | -------------------------------------------------- |
| `/`           | Home          | Four densities: year grid, 30-day, curve, bars     |
| `/today`      | Today         | Carried-over work, then grouped by focus area      |
| `/quadrant`   | Quadrant      | Importance × time-to-finish, with an unplaced tray |
| `/money`      | Money         | Net worth, spend & income, review prompt           |
| `/more/areas` | Focus areas   | 30-day strip per area                              |
| `/vivy`       | Vivy          | Chat with undoable write cards                     |
| `/status`     | Ingest status | Dev instrument, not a designed screen              |

Two rules the design is strict about, easy to undo by accident:

- **Overdue is stated, never alarmed.** "waiting since Tuesday", not a red badge.
- **Balances that reduce net worth take a minus sign and stay black.** Red means
  error, not owing money.

The canvas frames are 390×844. On a phone the app fills the viewport; from 768px
up the same markup becomes a device preview on the board colour.

Screens read from `src/lib/sample.ts` while the database is empty, the values
the canvas specifies, generated from a seeded PRNG so server and client render
identical cells. Swap for real rollups once collectors have pushed.

## Status

P1 (log, sync, extension) and the designed screens are built and green. P2 now
includes the Android SMS receiver, 30-day inbox backfill, sealed raw capture,
on-device transaction parsing, ledger materialisation and spend rollups. Parser
templates still need expansion against real bank wording as new unmatched
messages are observed.

# vivy
