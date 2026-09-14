ALTER TABLE "users" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "accent_colour" text DEFAULT '#4F46E5' NOT NULL;