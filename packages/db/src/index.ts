import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export * from './schema';
export { schema };

let cached: ReturnType<typeof drizzle<typeof schema>> | undefined;

/**
 * One pooled connection per process.
 *
 * Fluid Compute reuses function instances across concurrent requests, so a
 * module-level pool is correct here - creating a client per request would open
 * a connection per invocation and exhaust Postgres under any real sync load.
 */
export function db() {
  if (cached) return cached;

  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set');

  const client = postgres(url, {
    max: 5,
    idle_timeout: 20,
    // Statement-level timeout: a runaway rollup should fail, not hold the pool.
    connect_timeout: 10,
  });

  cached = drizzle(client, { schema });
  return cached;
}
