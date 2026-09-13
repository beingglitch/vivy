CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"ref" text,
	"currency" text DEFAULT 'INR' NOT NULL,
	"is_liability" boolean DEFAULT false NOT NULL,
	"include_in_networth" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "balance_snapshots" (
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"as_of" date NOT NULL,
	"balance_minor" integer NOT NULL,
	"authority" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balance_snapshots_user_id_account_id_as_of_authority_pk" PRIMARY KEY("user_id","account_id","as_of","authority")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"platform" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_verifications" (
	"email" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"seq" bigserial NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	"tz" text NOT NULL,
	"type" text NOT NULL,
	"source" text NOT NULL,
	"device_id" text NOT NULL,
	"duration_s" integer,
	"payload" jsonb NOT NULL,
	"raw_id" uuid,
	"derived_by" text NOT NULL,
	"dedupe_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"as_of" date NOT NULL,
	"symbol" text NOT NULL,
	"instrument" text NOT NULL,
	"quantity" numeric(20, 6) NOT NULL,
	"avg_cost_minor" integer,
	CONSTRAINT "holdings_user_id_account_id_as_of_symbol_pk" PRIMARY KEY("user_id","account_id","as_of","symbol")
);
--> statement-breakpoint
CREATE TABLE "metrics_daily" (
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"stream" text NOT NULL,
	"value" real NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metrics_daily_user_id_local_date_stream_pk" PRIMARY KEY("user_id","local_date","stream")
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"kind" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"surfaced_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "onboarding_steps" (
	"user_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"reminded_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_steps_user_id_source_id_pk" PRIMARY KEY("user_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"symbol" text NOT NULL,
	"on_date" date NOT NULL,
	"close_minor" integer NOT NULL,
	"source_name" text NOT NULL,
	CONSTRAINT "prices_symbol_on_date_pk" PRIMARY KEY("symbol","on_date")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"seq" bigserial NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"device_id" text NOT NULL,
	"body" jsonb NOT NULL,
	"sealed" boolean DEFAULT false NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "txns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"direction" text NOT NULL,
	"method" text NOT NULL,
	"counterparty" text,
	"category" text,
	"balance_after_minor" integer,
	"confidence" real DEFAULT 1 NOT NULL,
	"event_id" uuid,
	"dedupe_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"passphrase_hash" text NOT NULL,
	"auth_salt" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_token_hash_idx" ON "devices" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "devices_user_idx" ON "devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_verifications_expiry_idx" ON "email_verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "events_dedupe_idx" ON "events" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "events_seq_idx" ON "events" USING btree ("user_id","seq");--> statement-breakpoint
CREATE INDEX "events_type_date_idx" ON "events" USING btree ("user_id","type","local_date");--> statement-breakpoint
CREATE INDEX "events_raw_idx" ON "events" USING btree ("raw_id");--> statement-breakpoint
CREATE INDEX "metrics_stream_idx" ON "metrics_daily" USING btree ("user_id","stream");--> statement-breakpoint
CREATE INDEX "observations_subject_idx" ON "observations" USING btree ("user_id","subject","local_date");--> statement-breakpoint
CREATE INDEX "onboarding_scheduled_idx" ON "onboarding_steps" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "push_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_dedupe_idx" ON "raw_records" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "raw_seq_idx" ON "raw_records" USING btree ("user_id","seq");--> statement-breakpoint
CREATE INDEX "raw_source_ts_idx" ON "raw_records" USING btree ("user_id","source","ts");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "txns_dedupe_idx" ON "txns" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "txns_account_date_idx" ON "txns" USING btree ("user_id","account_id","local_date");--> statement-breakpoint
CREATE INDEX "txns_confidence_idx" ON "txns" USING btree ("user_id","confidence");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");