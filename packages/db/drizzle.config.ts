import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env['DATABASE_URL'] ?? '' },
  // Migrations are checked into the repo and applied explicitly. `push` is
  // convenient and is exactly how schemas drift between environments.
  strict: true,
  verbose: true,
});
