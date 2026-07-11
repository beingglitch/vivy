# SPEC-0003 — Full finance picture, richer charts, learning units, PWA

## Goal

Finance stops being "a list of daily spends" and becomes the whole money picture:
category split you can see at a glance (donut), net worth (assets − liabilities),
monthly income vs expense, recurring commitments, and a next-month forecast.
Learning items get a proper unit picker (chapter/page/lesson/hour/…). The app
installs to the phone home screen as a PWA behind the existing passcode.

## Acceptance criteria

- [x] Finance page shows a **donut chart** of this month's expenses by category
      (validated dark-mode palette, direct legend with amounts + %, ≤6 segments +
      "everything else" fold).
- [x] **Net worth** section: assets and liabilities as editable line items,
      net = assets − liabilities shown as the headline number.
- [x] **Monthly flow**: income vs expense this month, net saved/overspent.
- [x] **Recurring** rules (rent, salary, subscriptions): add/edit/deactivate/delete;
      monthly recurring totals shown.
- [x] **Next-month forecast** = recurring commitments + variable spend at the
      current daily pace, labeled honestly as an estimate.
- [x] Learning add/edit forms let me pick the **unit** (chapter, page, section,
      lesson, module, hour, video, episode); progress logging works in any unit.
- [x] **PWA**: manifest + icons served without auth; installable on Android Chrome;
      passcode login unchanged (`VIVY_PASSCODE` env — change it there to rotate).

## Decisions

- Assets/liabilities live in a `positions` table (current value, edited in place).
  History-of-net-worth can come later from snapshot events; not needed day one.
- Recurring rules are their own table (`recurring`), NOT flags on transactions —
  the forecast reads rules; actual payments still land in `transactions` when they
  happen.
- Manual position/recurring entry is the same *interim fallback* as manual
  transactions (automation rule) — bank ingestion replaces the entry, not the tables.
- Donut palette is a deeper-chroma variant of the site palette, run through the
  dataviz validator against the dark surface (all checks pass); category → color
  mapping is fixed (identity-stable), extra categories fold into "everything else".

## Tasks

- [x] Schema: `positions`, `recurring` + push to Neon
- [x] APIs: /api/positions(+/[id]), /api/recurring(+/[id])
- [x] Finance page redesign (donut, net worth, flow, forecast, recurring)
- [x] TxEntry income/expense toggle
- [x] Learning unit select (add + edit forms)
- [x] PWA: manifest.ts, icons, proxy exclusions, apple meta
- [x] Build + verify locally, restart :3005, screenshots

## Addendum (2026-07-11, evening) — Notion import, hero net worth, trend, voice

- **Notion "Finance Tracker" imported** (one-time, idempotent script): 2 assets
  (SBI savings ₹5,266, One Card FD ₹2,451), 8 liabilities (SBI Card ₹23,671,
  Amrit ₹15k, Himanshu ₹10k, Manish ₹5k, Gagan ₹5k, Amazon Pay Later ₹3,957,
  One Card ₹0, College Fee ₹2.57L), 7 recurring rules (NirmaanOS +₹20k income;
  Food 6k, Rent 5k, Travel 4k, Electricity 3k, Claude Code 2,250, YT 149).
- Schema additions: `positions.consider` (College Fee shows but doesn't count —
  mirrors Notion's Consider checkbox), `positions.next_outflow` (planned payment
  next month, shown as an ember chip), `networth_snapshots` (one row/day; upsert
  on every position mutation + piggy-backed on the daily-summary cron).
- **Hero**: net worth is the page's single huge centered number (−₹54,911 at
  import; −₹3.1L with college fee) with own/owe subline and a one-series trend
  chart (dashed ₹0 baseline, per-point tooltips). Small net-worth header stat
  removed (redundancy rule). Everything else kept as it was, per user.
- Forecast now adds planned debt payments: recurring ₹20,399 + payments ₹42,000
  + logged pace.
- **Voice input**: `app/voice-button.tsx` (Web Speech API, en-IN, hidden where
  unsupported) wired into chat composer + finance note field.
- /learning rows switched from flex to fixed grid tracks so columns are straight.
