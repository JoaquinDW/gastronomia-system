ALTER TABLE "orders" ADD COLUMN "delivery_location" jsonb;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "delivery_config" jsonb DEFAULT '{"mode":"manual"}'::jsonb NOT NULL;