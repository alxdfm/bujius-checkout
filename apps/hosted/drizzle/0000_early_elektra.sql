CREATE TABLE "charges" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"reference" text NOT NULL,
	"amount" numeric(20, 0) NOT NULL,
	"order_id" text NOT NULL,
	"webhook_url" text,
	"success_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"payer" text,
	"signature" text,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charges_reference_unique" UNIQUE("reference"),
	CONSTRAINT "charges_signature_unique" UNIQUE("signature"),
	CONSTRAINT "charges_merchant_order_unique" UNIQUE("merchant_id","order_id")
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"split_config" text NOT NULL,
	"api_key_hash" text NOT NULL,
	"webhook_secret" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_api_key_hash_unique" UNIQUE("api_key_hash")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"charge_id" text NOT NULL,
	"event_type" text NOT NULL,
	"status_code" integer,
	"error" text,
	"attempt" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_charge_idx" ON "webhook_deliveries" USING btree ("charge_id");