CREATE TYPE "public"."business_kind" AS ENUM('hamburgueseria', 'rotiseria', 'pastas', 'otro');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'manager', 'cashier', 'kitchen');--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(63) NOT NULL,
	"kind" "business_kind" NOT NULL,
	"whatsapp" varchar(16) NOT NULL,
	"currency" varchar(3) DEFAULT 'ARS' NOT NULL,
	"timezone" text DEFAULT 'America/Argentina/Cordoba' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"onboarding_key" uuid NOT NULL,
	"onboarding_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_slug_unique" UNIQUE("slug"),
	CONSTRAINT "businesses_creator_onboarding_key_unique" UNIQUE("created_by_user_id","onboarding_key"),
	CONSTRAINT "businesses_slug_format" CHECK ("businesses"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "businesses_whatsapp_format" CHECK ("businesses"."whatsapp" ~ '^[+][1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(100) DEFAULT 'Casa central' NOT NULL,
	"city" varchar(100) NOT NULL,
	"address" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"business_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "membership_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_business_id_user_id_pk" PRIMARY KEY("business_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "locations_business_id_idx" ON "locations" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");
