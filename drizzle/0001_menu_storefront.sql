CREATE TABLE "menu_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"request_key" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'processing' NOT NULL,
	"draft" jsonb,
	"model" varchar(80) NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone,
	CONSTRAINT "menu_imports_request_unique" UNIQUE("business_id","request_key")
);
--> statement-breakpoint
CREATE TABLE "menu_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" varchar(80) NOT NULL,
	"kind" varchar(20) DEFAULT 'product' NOT NULL,
	"variants" jsonb NOT NULL,
	"add_ons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_url" text,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_products_variants_array" CHECK (jsonb_typeof("menu_products"."variants") = 'array' AND jsonb_array_length("menu_products"."variants") > 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"request_key" uuid NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"status" varchar(30) DEFAULT 'pending_confirmation' NOT NULL,
	"customer_name" varchar(100) NOT NULL,
	"customer_phone" varchar(16) NOT NULL,
	"fulfillment" varchar(20) NOT NULL,
	"address" varchar(250),
	"zone_name" varchar(100),
	"payment_method" varchar(20) NOT NULL,
	"note" varchar(500) DEFAULT '' NOT NULL,
	"items" jsonb NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"delivery_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_request_unique" UNIQUE("business_id","request_key"),
	CONSTRAINT "orders_number_unique" UNIQUE("business_id","number"),
	CONSTRAINT "orders_total_valid" CHECK ("orders"."total_cents" = "orders"."subtotal_cents" + "orders"."delivery_cents" AND "orders"."total_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"menu_note" text DEFAULT '' NOT NULL,
	"hours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pickup_enabled" boolean DEFAULT true NOT NULL,
	"pickup_instructions" text DEFAULT '' NOT NULL,
	"delivery_enabled" boolean DEFAULT false NOT NULL,
	"delivery_zones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payment_methods" jsonb DEFAULT '["cash"]'::jsonb NOT NULL,
	"transfer_alias" varchar(100) DEFAULT '' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"next_order_number" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_imports" ADD CONSTRAINT "menu_imports_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_products" ADD CONSTRAINT "menu_products_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "menu_imports_daily_idx" ON "menu_imports" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "menu_products_business_idx" ON "menu_products" USING btree ("business_id","sort_order");--> statement-breakpoint
CREATE INDEX "orders_business_date_idx" ON "orders" USING btree ("business_id","created_at");