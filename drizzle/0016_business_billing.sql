-- Los negocios que ya existen quedan exentos y sin prueba: se agregan las
-- columnas con esos valores y recién después se ponen los defaults de los nuevos.
ALTER TABLE "businesses" ADD COLUMN "billing_exempt" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ALTER COLUMN "billing_exempt" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "businesses" ALTER COLUMN "trial_ends_at" SET DEFAULT now() + interval '14 days';--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "paid_until" timestamp with time zone;
