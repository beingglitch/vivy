CREATE TABLE "txn_corrections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"txn_id" uuid NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "source" text DEFAULT 'sms' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "balance_snapshots" ADD COLUMN "as_of_ts" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "txns" ADD COLUMN "review_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "txns" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "txns" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "txn_corrections_txn_idx" ON "txn_corrections" USING btree ("user_id","txn_id","created_at");