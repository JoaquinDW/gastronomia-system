ALTER TABLE "store_settings" ADD COLUMN "cover_image_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "cover_focus_x" smallint DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "cover_focus_y" smallint DEFAULT 50 NOT NULL;