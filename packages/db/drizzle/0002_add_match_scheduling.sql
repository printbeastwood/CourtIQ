CREATE TABLE "match_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'guest' NOT NULL,
	"rsvp_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_match_player" UNIQUE("match_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "booking_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "platform_booking_ref" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "status" text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_match_player_match" ON "match_players" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "idx_match_player_user" ON "match_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_match_player_rsvp" ON "match_players" USING btree ("rsvp_status");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_match_status" ON "matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_match_scheduled_at" ON "matches" USING btree ("scheduled_at");