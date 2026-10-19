ALTER TABLE "orders" ADD COLUMN "estimated_ready_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "rating" smallint;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_rating_valid" CHECK ("orders"."rating" BETWEEN 1 AND 5);