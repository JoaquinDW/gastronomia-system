ALTER TABLE "menu_images" ALTER COLUMN "large" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_images" ALTER COLUMN "small" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_images" ADD COLUMN "storage_key" text;