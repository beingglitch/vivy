CREATE TABLE "stream_pipelines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"colour" text NOT NULL,
	"graph_style" text DEFAULT 'Curve' NOT NULL,
	"unit" text NOT NULL,
	"definition" jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "stream_pipelines_user_key_idx" ON "stream_pipelines" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "stream_pipelines_user_idx" ON "stream_pipelines" USING btree ("user_id","created_at");