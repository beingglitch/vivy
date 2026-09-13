-- Made idempotent by hand. The access_grants table and the users/invites
-- columns were applied directly during development, before this migration
-- existed, so a plain CREATE would fail on that database while still being
-- needed on a fresh one.
CREATE TABLE IF NOT EXISTS "access_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"invite_id" uuid,
	"amount" integer NOT NULL,
	"unit" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_attempts" (
	"email" text PRIMARY KEY NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"first_failure_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "passphrase_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "auth_salt" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD COLUMN IF NOT EXISTS "purpose" text DEFAULT 'signup' NOT NULL;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "recipient_email" text;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "access_amount" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "access_unit" text DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "access_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferred_login" text DEFAULT 'passphrase' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_grants_user_idx" ON "access_grants" USING btree ("user_id","granted_at");