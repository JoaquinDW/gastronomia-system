CREATE TABLE "management_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"supplier_id" uuid,
	"date" varchar(10) NOT NULL,
	"category" varchar(40) NOT NULL,
	"concept" varchar(120) NOT NULL,
	"amount_cents" numeric(30, 0) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"reversed_at" timestamp with time zone,
	"reversal_id" uuid,
	CONSTRAINT "management_expense_positive" CHECK ("management_expenses"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"kind" varchar(20) NOT NULL,
	"unit" varchar(10) NOT NULL,
	"minimum" numeric(20, 6) DEFAULT '0' NOT NULL,
	"quantity" numeric(20, 6) DEFAULT '0' NOT NULL,
	"unit_cost" numeric(30, 6),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "inventory_item_tenant" UNIQUE("business_id","id"),
	CONSTRAINT "inventory_item_name" UNIQUE("business_id","location_id","name"),
	CONSTRAINT "inventory_item_valid" CHECK ("inventory_items"."kind" IN ('ingredient','finished') AND "inventory_items"."unit" IN ('g','ml','unit') AND "inventory_items"."minimum" >= 0 AND ("inventory_items"."unit_cost" IS NULL OR "inventory_items"."unit_cost" >= 0))
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"kind" varchar(30) NOT NULL,
	"quantity" numeric(20, 6) NOT NULL,
	"cost_cents" numeric(30, 0),
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "management_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"type" varchar(30) NOT NULL,
	"operational_date" varchar(10) NOT NULL,
	"actor_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "management_operation_request" UNIQUE("business_id","request_key"),
	CONSTRAINT "management_operation_tenant" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "management_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"order_id" uuid,
	"channel" varchar(20) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"total_cents" numeric(30, 0) NOT NULL,
	"delivery_cents" numeric(30, 0) DEFAULT '0' NOT NULL,
	"cost_cents" numeric(30, 0),
	"known_cost_cents" numeric(30, 0) NOT NULL,
	"cost_complete" boolean NOT NULL,
	"lines" jsonb NOT NULL,
	"operational_date" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancellation_id" uuid,
	CONSTRAINT "management_sale_tenant" UNIQUE("business_id","id"),
	CONSTRAINT "management_sale_order" UNIQUE("business_id","order_id"),
	CONSTRAINT "management_sale_operation" UNIQUE("business_id","operation_id"),
	CONSTRAINT "management_sale_valid" CHECK ("management_sales"."channel" IN ('store','counter','whatsapp','other') AND "management_sales"."total_cents" >= 0 AND "management_sales"."delivery_cents" >= 0 AND "management_sales"."total_cents" >= "management_sales"."delivery_cents")
);
--> statement-breakpoint
CREATE TABLE "management_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"cutoff_hour" integer DEFAULT 4 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "management_cutoff_valid" CHECK ("management_settings"."cutoff_hour" BETWEEN 0 AND 23)
);
--> statement-breakpoint
CREATE TABLE "management_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"option_kind" varchar(10) NOT NULL,
	"version" integer NOT NULL,
	"lines" jsonb NOT NULL,
	"no_consumption" boolean DEFAULT false NOT NULL,
	"operation_id" uuid NOT NULL,
	CONSTRAINT "recipe_revision" UNIQUE("business_id","product_id","option_id","option_kind","version"),
	CONSTRAINT "recipe_kind_valid" CHECK ("management_recipes"."option_kind" IN ('variant','addon'))
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"contact" varchar(200) DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "supplier_tenant" UNIQUE("business_id","id"),
	CONSTRAINT "supplier_name" UNIQUE("business_id","name")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenant_unique" UNIQUE("business_id","id");--> statement-breakpoint
ALTER TABLE "menu_products" ADD CONSTRAINT "menu_products_tenant_unique" UNIQUE("business_id","id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_unique" UNIQUE("business_id","id");--> statement-breakpoint
ALTER TABLE "management_expenses" ADD CONSTRAINT "management_expenses_business_id_operation_id_management_operations_business_id_id_fk" FOREIGN KEY ("business_id","operation_id") REFERENCES "public"."management_operations"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_expenses" ADD CONSTRAINT "management_expenses_business_id_supplier_id_suppliers_business_id_id_fk" FOREIGN KEY ("business_id","supplier_id") REFERENCES "public"."suppliers"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_expenses" ADD CONSTRAINT "management_expenses_business_id_reversal_id_management_operations_business_id_id_fk" FOREIGN KEY ("business_id","reversal_id") REFERENCES "public"."management_operations"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_business_id_location_id_locations_business_id_id_fk" FOREIGN KEY ("business_id","location_id") REFERENCES "public"."locations"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_business_id_item_id_inventory_items_business_id_id_fk" FOREIGN KEY ("business_id","item_id") REFERENCES "public"."inventory_items"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_business_id_operation_id_management_operations_business_id_id_fk" FOREIGN KEY ("business_id","operation_id") REFERENCES "public"."management_operations"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_business_id_location_id_locations_business_id_id_fk" FOREIGN KEY ("business_id","location_id") REFERENCES "public"."locations"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_operations" ADD CONSTRAINT "management_operations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_sales" ADD CONSTRAINT "management_sales_business_id_location_id_locations_business_id_id_fk" FOREIGN KEY ("business_id","location_id") REFERENCES "public"."locations"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_sales" ADD CONSTRAINT "management_sales_business_id_operation_id_management_operations_business_id_id_fk" FOREIGN KEY ("business_id","operation_id") REFERENCES "public"."management_operations"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_sales" ADD CONSTRAINT "management_sales_business_id_order_id_orders_business_id_id_fk" FOREIGN KEY ("business_id","order_id") REFERENCES "public"."orders"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_sales" ADD CONSTRAINT "management_sales_business_id_cancellation_id_management_operations_business_id_id_fk" FOREIGN KEY ("business_id","cancellation_id") REFERENCES "public"."management_operations"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_settings" ADD CONSTRAINT "management_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_recipes" ADD CONSTRAINT "management_recipes_business_id_product_id_menu_products_business_id_id_fk" FOREIGN KEY ("business_id","product_id") REFERENCES "public"."menu_products"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_recipes" ADD CONSTRAINT "management_recipes_business_id_operation_id_management_operations_business_id_id_fk" FOREIGN KEY ("business_id","operation_id") REFERENCES "public"."management_operations"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "management_expense_date" ON "management_expenses" USING btree ("business_id","date");--> statement-breakpoint
CREATE INDEX "inventory_movement_date" ON "inventory_movements" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "management_operation_date" ON "management_operations" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "management_sale_date" ON "management_sales" USING btree ("business_id","operational_date");