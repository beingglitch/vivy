# Repository Guidelines

## Project Structure & Module Organization

Vivy is a pnpm and Turborepo monorepo. `apps/web` contains the Next.js PWA, API routes, server actions, and UI. `apps/extension` is the Chrome MV3 collector. `android` contains the Kotlin collector and its Room outbox. Shared TypeScript packages live under `packages`: `core` defines event and sync contracts, `db` owns the Drizzle schema and migrations, `crypto` handles sealed streams, and `money` contains SMS parsing and reconciliation. Tests sit beside source as `*.test.ts`. Static web assets are in `apps/web/public`; Android resources are in `android/app/src/main/res`.

## Build, Test, and Development Commands

- `pnpm install`: install all workspace dependencies. Requires Node 22 or newer.
- `pnpm dev`: run workspace development tasks, including Next.js with Turbopack.
- `pnpm typecheck`: run strict TypeScript checks across packages.
- `pnpm test`: run all Vitest suites.
- `pnpm build`: build every workspace through Turborepo.
- `pnpm format`: format TypeScript, TSX, JSON, and Markdown with Prettier.
- `pnpm db:generate`: create a checked-in Drizzle migration after schema changes.
- `pnpm db:migrate`: apply database migrations using exported `DATABASE_URL` settings.
- `cd android && ./gradlew assembleDebug`: build the debug APK.

## Coding Style & Naming Conventions

Use UTF-8, LF endings, and final newlines. TypeScript uses two-space indentation, semicolons, single quotes, trailing commas, and a 100-column target. Follow existing Kotlin formatting. Use descriptive camelCase names, PascalCase for React components and types, and kebab-case route directories. Do not use em dashes in prose. Keep changes focused and avoid editing generated `dist`, `.next`, or Android build output.

## Testing Guidelines

Vitest covers `packages/core`, `packages/crypto`, and `packages/money`. Name new tests `*.test.ts` beside the implementation. Add focused tests for protocol changes, cryptography, parsers, and ledger logic. Run the narrow package test first, for example `pnpm --filter @vivy/money test`, then `pnpm test` and `pnpm typecheck`.

## Commit & Pull Request Guidelines

History uses short imperative subjects such as `Build focus areas and the quadrant`. Keep commits scoped to one coherent change. Pull requests should explain behavior, list validation commands, link relevant issues, include screenshots for UI changes, and call out migrations, environment changes, or security implications.

## Security & Data Rules

Never log captured payloads or commit `.env.local`. Store credentials only as hashes. Every user-owned query must filter by `userId`. Build deterministic `dedupeKey` values from observations. Store money as integer minor units. Collectors preserve raw observations and leave classification downstream; sensitive streams must be sealed before upload.
