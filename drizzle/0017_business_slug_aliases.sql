CREATE TABLE "business_slug_aliases" (
	"slug" varchar(63) PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business_slug_aliases" ADD CONSTRAINT "business_slug_aliases_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_slug_aliases_business_idx" ON "business_slug_aliases" USING btree ("business_id");