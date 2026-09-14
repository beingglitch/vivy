import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

try {
  loadEnvFile(fileURLToPath(new URL('../../.env.local', import.meta.url)));
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
}

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
