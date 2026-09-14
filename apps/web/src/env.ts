import { z } from 'zod';

/**
 * Environment validation, run once at module load.
 *
 * The point is to fail at boot with a readable message rather than at 03:00 in a
 * cron job with `undefined is not a string`. Optional keys are genuinely
 * optional - a collector you have not wired up yet should not stop the app from
 * starting.
 */
const Env = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required - see .env.example'),
  VIVY_PAIRING_SECRET: z
    .string()
    .min(
      32,
      'VIVY_PAIRING_SECRET must be at least 32 chars; generate with `openssl rand -base64 32`',
    ),

  ANTHROPIC_API_KEY: z.string().optional(),

  // Push is optional. Missing keys disable notifications rather than the app.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),

  /**
   * Development shortcut: when set, every signup code is this value and no email
   * is sent. Unset it and real six-digit codes are generated instead.
   */
  DEV_OTP_CODE: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  KITE_API_KEY: z.string().optional(),
  KITE_API_SECRET: z.string().optional(),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

function load() {
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${issues.join('\n')}`);
  }
  return parsed.data;
}

export const env = load();
