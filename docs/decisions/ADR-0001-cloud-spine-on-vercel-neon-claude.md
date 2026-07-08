---
id: ADR-0001
title: Cloud spine on Vercel + Neon Postgres + Claude via AI SDK
status: accepted         # proposed | accepted | superseded
created: 2026-07-08
supersedes:
related: [SPEC-0001]
---

# ADR-0001: Cloud spine on Vercel + Neon Postgres + Claude via AI SDK

## Context
Vivy is a lifelong personal-assistant ecosystem: one core that many devices (laptop agent,
browser extension, phone, future custom recorder hardware) must reach from anywhere.
Choice needed: cloud-hosted vs local-first, and which stack.

## Decision
Cloud-hosted spine: **Next.js (App Router, TypeScript) on Vercel**, **Neon Postgres** with
Drizzle ORM, **Claude via the AI SDK through Vercel AI Gateway**, Vercel Cron for
proactive jobs. All ingestors are thin clients that POST JSON events over HTTPS with an
API key. Single-user auth; sensitive data lives only in my own database.

## Alternatives considered
- **Local-first (laptop server + SQLite)**: maximum privacy, but unreachable from phone
  and future hardware without building sync/tunnels first; kills the "always-on assistant"
  property. Revisit as an *addition* (local capture agents already fit the model).
- **Self-hosted VPS (Docker + Postgres)**: more control, but I'd own uptime, TLS, backups,
  deploys — friction that slows a solo project. Vercel/Neon free tiers cover this scale.
- **Separate backend (FastAPI/Express) + separate frontend**: two deploys and duplicated
  types for no benefit at single-user scale; Next.js route handlers are the API.

## Consequences
Easy: deploy-on-push, HTTPS endpoint for any device day one, cron jobs, streaming AI, one
codebase/one repo. Hard/accepted: my life data lives in managed cloud services (mitigate:
single-user auth, API keys, option to export; raw audio can go to private Blob storage);
vendor coupling to Vercel/Neon (mitigate: standard Postgres + portable Next.js).
