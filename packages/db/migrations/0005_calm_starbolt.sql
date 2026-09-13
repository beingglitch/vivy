ALTER TABLE "tasks" ADD COLUMN "deadline_kind" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "due_amount" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "due_unit" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "place_label" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "lat" double precision;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "lng" double precision;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "radius_m" integer;