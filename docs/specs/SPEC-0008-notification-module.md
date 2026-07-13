---
id: SPEC-0008
title: Notification module — proactive nudges via web push
status: building
created: 2026-07-13
---

# SPEC-0008: Notification module — proactive nudges via web push

## What & why

Vivy has the data (spend pace, task counts, learning staleness, routines) but only talks
when opened. Suraj wants her to reach out: "you're spending too much", "you did N tasks
today — line up tomorrow", "you haven't touched your book in 6 days", due reminders.
Rules decide WHEN (cron-driven, deduped per day), Haiku writes the words in Vivy's voice
with the real numbers, delivery is **web push** to the installed PWA (user decision
2026-07-13: web push; on Android it rides FCM anyway, and if the Epic 6 native app comes,
only the delivery adapter changes — engine/table/bell carry over).

## Acceptance criteria

- [x] `notifications` table (kind, title, body, url, dedupeKey unique, readAt) and
      `push_subscriptions` table (endpoint unique, p256dh, auth); pushed to Neon.
- [x] `notify()` helper: dedupe-or-insert + web-push to every subscription; dead
      subscriptions (404/410) are deleted automatically.
- [ ] Settings page has an "enable notifications" toggle: registers the service worker,
      asks permission, subscribes with the VAPID public key, saves the subscription.
      (Built; needs the user's real tap on a device — includes a "send a test" button.)
- [ ] Service worker shows pushes (title/body/icon) and clicking one opens the right page.
      (Built + served publicly; real delivery needs a subscribed device.)
- [x] Morning (piggybacks daily-brief cron 09:15 IST): brief-ready nudge with the top task.
- [x] Midday cron (14:00 IST): overspend check — today's daily (non-bill) spend vs 30-day
      average; nudges only when > 2× average and > ₹500. (Verified: correctly skipped at
      ₹167 vs ₹22/day.)
- [x] Evening cron (21:30 IST): review — tasks done today, today-lane leftovers, routines
      still owed, stalled learning (5+ days), tasks due tomorrow → one Haiku-worded nudge
      prompting to plan tomorrow. (Verified live — see Notes.)
- [x] Bell in the header with unread dot; /notifications lists them and marks read.
- [x] Nudges never repeat: dedupe key = kind + IST day. (Verified: rerun returned
      "already sent today".)

## Out of scope

- Telegram/email channels (adapter slot exists; not built).
- Per-nudge preference toggles / quiet hours (v2 if the nudges annoy).
- Real-time triggers (all cron-batch for now).
- Native FCM (Epic 6).

## Tasks

- [x] Schema + drizzle push.
- [x] `lib/notify.ts`: sendPushToAll + notify(dedupe) + rules (morning/spend/evening).
- [x] APIs: /api/push/subscribe (POST/DELETE), /api/push/test, /api/notifications
      (GET ?unread=1 for the bell, PATCH read-all).
- [x] public/sw.js + settings toggle component; proxy matcher lets /sw.js through.
- [x] Crons: notify-midday (08:30 UTC), notify-evening (16:00 UTC) in vercel.json;
      morning hook in daily-brief cron.
- [x] Bell + /notifications page (opening marks all read).
- [x] VAPID keys → .env.local (user adds to Vercel).
- [x] Verify locally; docs + journal.

## Notes

- Verified 2026-07-13 local dev: evening cron → notification row + Haiku body in Vivy's
  voice ("You skipped everything today—football, learning, didn't even log it. Pick one
  tiny thing for tomorrow (2 min) and queue it now before bed."); rerun deduped; unread
  count 1 → page rendered it; midday correctly skipped below thresholds; sw.js serves 200
  without a session. Test rows deleted after so tonight's real 21:30 IST run fires fresh.
- Bug found & fixed during verify: Haiku returned multi-line markdown and the first-line
  extraction produced "**The pattern I'm seeing:**" — vivyWords now flattens/strips
  markdown into one plain line.
- Push bodies capped at 180 chars; model fallback string used if the gateway is down.
- USER STEPS to go live: add `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT` (values in .env.local) to Vercel production env, deploy, then
  Settings → "Enable on this device" on the phone PWA → "send a test".
- IST is UTC+5:30 (no DST) so cron UTC times are stable: 08:30→14:00, 16:00→21:30.
