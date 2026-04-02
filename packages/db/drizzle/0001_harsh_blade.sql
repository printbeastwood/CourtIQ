CREATE TABLE "venue_operators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_operators_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "venue_operators" ADD CONSTRAINT "venue_operators_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_venue_operator_venue" ON "venue_operators" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "idx_venue_operator_email" ON "venue_operators" USING btree ("email");