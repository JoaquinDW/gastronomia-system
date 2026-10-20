CREATE TABLE "cash_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"kind" varchar(20) NOT NULL,
	"method" varchar(20) NOT NULL,
	"order_id" uuid,
	"amount_cents" integer NOT NULL,
	"tendered_cents" integer,
	"note" varchar(200) DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" text,
	"void_reason" varchar(200),
	CONSTRAINT "cash_movement_request" UNIQUE("business_id","request_key"),
	CONSTRAINT "cash_movement_valid" CHECK ("cash_movements"."kind" IN ('payment','deposit','withdrawal') AND "cash_movements"."method" IN ('cash','transfer','qr','card') AND "cash_movements"."amount_cents" > 0 AND ("cash_movements"."kind" = 'payment') = ("cash_movements"."order_id" IS NOT NULL) AND ("cash_movements"."kind" = 'payment' OR "cash_movements"."method" = 'cash') AND ("cash_movements"."tendered_cents" IS NULL OR ("cash_movements"."method" = 'cash' AND "cash_movements"."tendered_cents" >= "cash_movements"."amount_cents")) AND ("cash_movements"."voided_at" IS NULL) = ("cash_movements"."void_reason" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "cash_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"open_request_key" uuid NOT NULL,
	"opening_cents" integer NOT NULL,
	"opened_by" text NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"close_request_key" uuid,
	"declared_cents" integer,
	"expected_cents" integer,
	"note" varchar(300) DEFAULT '' NOT NULL,
	"closed_by" text,
	"closed_at" timestamp with time zone,
	CONSTRAINT "cash_session_tenant" UNIQUE("business_id","id"),
	CONSTRAINT "cash_session_number" UNIQUE("business_id","number"),
	CONSTRAINT "cash_session_open_request" UNIQUE("business_id","open_request_key"),
	CONSTRAINT "cash_session_valid" CHECK ("cash_sessions"."opening_cents" >= 0 AND ("cash_sessions"."closed_at" IS NULL) = ("cash_sessions"."declared_cents" IS NULL) AND ("cash_sessions"."closed_at" IS NULL) = ("cash_sessions"."expected_cents" IS NULL) AND ("cash_sessions"."closed_at" IS NULL) = ("cash_sessions"."close_request_key" IS NULL) AND ("cash_sessions"."declared_cents" IS NULL OR "cash_sessions"."declared_cents" >= 0))
);
--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_business_id_session_id_cash_sessions_business_id_id_fk" FOREIGN KEY ("business_id","session_id") REFERENCES "public"."cash_sessions"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_business_id_order_id_orders_business_id_id_fk" FOREIGN KEY ("business_id","order_id") REFERENCES "public"."orders"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_movement_session" ON "cash_movements" USING btree ("business_id","session_id");--> statement-breakpoint
CREATE INDEX "cash_movement_order" ON "cash_movements" USING btree ("business_id","order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_session_one_open" ON "cash_sessions" USING btree ("business_id") WHERE "cash_sessions"."closed_at" IS NULL;