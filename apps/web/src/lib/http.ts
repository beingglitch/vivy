import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { AuthError } from './auth';

/**
 * One place where every API route turns an outcome into a response.
 *
 * Centralised so that error shape stays consistent across routes, and - more
 * importantly - so no handler can accidentally serialise an exception
 * containing a payload into a response body. Bodies are captured data; they do
 * not belong in errors or logs.
 */

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status: number, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Parse a request body against a schema, surfacing field paths but never values. */
export async function parseBody<S extends ZodType>(
  request: Request,
  schema: S,
): Promise<S['_output']> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new ZodError([
      { code: 'custom', path: [], message: 'body is not valid JSON' },
    ]);
  }
  return schema.parse(json);
}

export function handleError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return fail(error.message, error.status);
  }
  if (error instanceof ZodError) {
    // Paths and messages only. Never `issue.input`, which would echo captured data.
    return fail('Invalid request', 422, {
      issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  console.error('[vivy] unhandled route error:', error instanceof Error ? error.message : 'unknown');
  return fail('Internal error', 500);
}
