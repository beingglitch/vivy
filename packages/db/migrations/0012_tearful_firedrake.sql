CREATE TABLE "intense_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"session_type" text NOT NULL,
	"phase" text DEFAULT 'focus' NOT NULL,
	"focus_minutes" integer NOT NULL,
	"short_break_minutes" integer NOT NULL,
	"long_break_minutes" integer NOT NULL,
	"rounds_before_long_break" integer NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"phase_started_at" timestamp with time zone NOT NULL,
	"phase_ends_at" timestamp with time zone NOT NULL,
	"remaining_seconds" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intense_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"session_type" text DEFAULT 'pomodoro' NOT NULL,
	"focus_minutes" integer DEFAULT 25 NOT NULL,
	"short_break_minutes" integer DEFAULT 5 NOT NULL,
	"long_break_minutes" integer DEFAULT 20 NOT NULL,
	"rounds_before_long_break" integer DEFAULT 4 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "intense_sessions_user_status_idx" ON "intense_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "intense_sessions_task_idx" ON "intense_sessions" USING btree ("user_id","task_id");