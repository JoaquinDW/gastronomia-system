ALTER TABLE "orders" ADD COLUMN "stage" varchar(20);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stage_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_token" varchar(32) DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL;--> statement-breakpoint
-- Pedidos aceptados antes de esta migración: ya se atendieron, quedan como entregados.
UPDATE "orders" SET "stage" = 'delivered', "stage_changed_at" = "accepted_at" WHERE "status" = 'accepted';--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tracking_unique" UNIQUE("tracking_token");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_stage_valid" CHECK ("orders"."stage" IS NULL OR "orders"."stage" IN ('preparing', 'ready', 'on_the_way', 'delivered'));