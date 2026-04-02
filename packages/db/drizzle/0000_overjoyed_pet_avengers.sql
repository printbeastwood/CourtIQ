CREATE TABLE "adapter_health_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"healthy" boolean NOT NULL,
	"error_message" text,
	"venues_fetched" integer DEFAULT 0,
	"slots_fetched" integer DEFAULT 0,
	"duration_ms" integer,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"court_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"price_cents" integer,
	"currency" text DEFAULT 'THB' NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"source_booking_url" text,
	"fetched_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_slot_court_time" UNIQUE("court_id","starts_at")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"booking_method" text,
	"source_confirmation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_coach_student" UNIQUE("coach_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "coaches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"email" text,
	"phone" text,
	"bio" text,
	"avatar_url" text,
	"certifications" jsonb DEFAULT '[]'::jsonb,
	"languages" jsonb DEFAULT '[]'::jsonb,
	"specialities" jsonb DEFAULT '[]'::jsonb,
	"lesson_types" jsonb DEFAULT '[]'::jsonb,
	"venue_ids" jsonb DEFAULT '[]'::jsonb,
	"source_platform" text,
	"source_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coaches_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "coaches_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "coaching_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"venue_id" uuid,
	"court_id" uuid,
	"booking_id" uuid,
	"lesson_type" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'THB' NOT NULL,
	"max_students" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"student_ids" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"friend_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_connection_pair" UNIQUE("user_id","friend_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "courts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"name" text NOT NULL,
	"surface" text NOT NULL,
	"indoor" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_device_token" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platforms" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"total_steps" integer DEFAULT 0 NOT NULL,
	"current_step" text,
	"result" jsonb,
	"credentials" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imported_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_job_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"platform_booking_id" text NOT NULL,
	"venue_name" text NOT NULL,
	"court_name" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"price_cents" integer,
	"currency" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_imported_booking_platform" UNIQUE("user_id","platform","platform_booking_id")
);
--> statement-breakpoint
CREATE TABLE "imported_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_job_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"platform_match_id" text NOT NULL,
	"opponent_name" text,
	"opponent_platform_id" text,
	"format" text,
	"player_score" integer,
	"opponent_score" integer,
	"result" text,
	"played_at" timestamp with time zone NOT NULL,
	"venue_name" text,
	"court_name" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_imported_match_platform" UNIQUE("user_id","platform","platform_match_id")
);
--> statement-breakpoint
CREATE TABLE "match_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid,
	"booking_id" uuid,
	"player_id" uuid NOT NULL,
	"satisfaction" text NOT NULL,
	"free_text" text,
	"issue_categories" jsonb DEFAULT '[]'::jsonb,
	"opponent_skill_rating" text,
	"opponent_id" uuid,
	"preference_extracted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"import_job_id" uuid,
	"platform" text NOT NULL,
	"platform_match_id" text,
	"played_at" timestamp with time zone NOT NULL,
	"venue_name" text,
	"court_name" text,
	"format" text,
	"result" text,
	"score" text,
	"partner_names" jsonb DEFAULT '[]'::jsonb,
	"opponent_names" jsonb DEFAULT '[]'::jsonb,
	"duration_minutes" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"court_id" uuid,
	"booking_id" uuid,
	"platform_booking_ref" text,
	"format" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"player1_id" uuid NOT NULL,
	"player2_id" uuid NOT NULL,
	"player1_score" integer,
	"player2_score" integer,
	"winner_id" uuid,
	"scheduled_at" timestamp with time zone,
	"played_at" timestamp with time zone NOT NULL,
	"reported_by_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"confirmed" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"tool_calls" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"matches_imported" integer DEFAULT 0 NOT NULL,
	"bookings_imported" integer DEFAULT 0 NOT NULL,
	"connections_imported" integer DEFAULT 0 NOT NULL,
	"preferences_seeded" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"platform_credentials" jsonb,
	"summary" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"venue_id" uuid NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"amount_cents" integer NOT NULL,
	"commission_cents" integer NOT NULL,
	"venue_payout_cents" integer NOT NULL,
	"commission_rate" real NOT NULL,
	"currency" text DEFAULT 'THB' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_transfer_id" text,
	"refunded_amount_cents" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "player_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"bio" text,
	"preferred_locations" jsonb DEFAULT '[]'::jsonb,
	"play_frequency" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "player_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"format" text NOT NULL,
	"rating" real DEFAULT 1500 NOT NULL,
	"rd" real DEFAULT 350 NOT NULL,
	"volatility" real DEFAULT 0.06 NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"last_match_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_player_format_rating" UNIQUE("player_id","format")
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"text" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    ALTER TABLE "preferences" ADD COLUMN IF NOT EXISTS "embedding" vector(1024);
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE "rating_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"format" text NOT NULL,
	"rating_before" real NOT NULL,
	"rating_after" real NOT NULL,
	"rd_before" real NOT NULL,
	"rd_after" real NOT NULL,
	"opponent_id" uuid NOT NULL,
	"opponent_rating" real NOT NULL,
	"result" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_id" uuid NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referee_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"clicked_at" timestamp with time zone,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "uq_referral_claim_referee" UNIQUE("referee_id")
);
--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"code" text NOT NULL,
	"owner_type" text DEFAULT 'player' NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"claim_count" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "referral_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"reflink_id" uuid NOT NULL,
	"referral_id" uuid,
	"booking_id" uuid,
	"type" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'THB' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"description" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reflink_id" uuid NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referred_user_id" uuid NOT NULL,
	"status" text DEFAULT 'signed_up' NOT NULL,
	"attributed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"qualified_at" timestamp with time zone,
	"booking_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_referral_user" UNIQUE("reflink_id","referred_user_id")
);
--> statement-breakpoint
CREATE TABLE "reflinks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"tier" text NOT NULL,
	"commission_rate" real NOT NULL,
	"reward_type" text NOT NULL,
	"reward_config" jsonb DEFAULT '{}'::jsonb,
	"attribution_window_days" integer DEFAULT 30 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reflinks_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"import_job_id" uuid,
	"platform" text NOT NULL,
	"platform_user_id" text,
	"display_name" text NOT NULL,
	"skill_level" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"firebase_uid" text,
	"display_name" text,
	"skill_level" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"address" text,
	"amenities" jsonb DEFAULT '[]'::jsonb,
	"source_platform" text NOT NULL,
	"source_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venues_slug_unique" UNIQUE("slug"),
	CONSTRAINT "uq_venue_source" UNIQUE("source_platform","source_id")
);
--> statement-breakpoint
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_availability_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."availability_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_students" ADD CONSTRAINT "coach_students_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_students" ADD CONSTRAINT "coach_students_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courts" ADD CONSTRAINT "courts_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_bookings" ADD CONSTRAINT "imported_bookings_import_job_id_import_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_bookings" ADD CONSTRAINT "imported_bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_matches" ADD CONSTRAINT "imported_matches_import_job_id_import_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_matches" ADD CONSTRAINT "imported_matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_feedback" ADD CONSTRAINT "match_feedback_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_feedback" ADD CONSTRAINT "match_feedback_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_feedback" ADD CONSTRAINT "match_feedback_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_feedback" ADD CONSTRAINT "match_feedback_opponent_id_users_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_history" ADD CONSTRAINT "match_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_history" ADD CONSTRAINT "match_history_import_job_id_migration_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."migration_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player1_id_users_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player2_id_users_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_users_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_jobs" ADD CONSTRAINT "migration_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_ratings" ADD CONSTRAINT "player_ratings_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_opponent_id_users_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_claims" ADD CONSTRAINT "referral_claims_code_id_referral_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."referral_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_claims" ADD CONSTRAINT "referral_claims_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_claims" ADD CONSTRAINT "referral_claims_referee_id_users_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_payouts" ADD CONSTRAINT "referral_payouts_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_payouts" ADD CONSTRAINT "referral_payouts_reflink_id_reflinks_id_fk" FOREIGN KEY ("reflink_id") REFERENCES "public"."reflinks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_payouts" ADD CONSTRAINT "referral_payouts_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_payouts" ADD CONSTRAINT "referral_payouts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_reflink_id_reflinks_id_fk" FOREIGN KEY ("reflink_id") REFERENCES "public"."reflinks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reflinks" ADD CONSTRAINT "reflinks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections_import_job_id_migration_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."migration_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_slot_starts" ON "availability_slots" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "idx_slot_status" ON "availability_slots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_coach_student_coach" ON "coach_students" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "idx_coach_student_student" ON "coach_students" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_coach_status" ON "coaches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_coach_user" ON "coaches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_coaching_session_coach" ON "coaching_sessions" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "idx_coaching_session_starts" ON "coaching_sessions" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "idx_coaching_session_status" ON "coaching_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_coaching_session_venue" ON "coaching_sessions" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "idx_connection_user" ON "connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_connection_friend" ON "connections" USING btree ("friend_id");--> statement-breakpoint
CREATE INDEX "idx_connection_status" ON "connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_device_token_user" ON "device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_import_job_user" ON "import_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_import_job_status" ON "import_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_imported_booking_user" ON "imported_bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_imported_booking_job" ON "imported_bookings" USING btree ("import_job_id");--> statement-breakpoint
CREATE INDEX "idx_imported_match_user" ON "imported_matches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_imported_match_job" ON "imported_matches" USING btree ("import_job_id");--> statement-breakpoint
CREATE INDEX "idx_feedback_player" ON "match_feedback" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "idx_feedback_match" ON "match_feedback" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "idx_feedback_booking" ON "match_feedback" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_feedback_created" ON "match_feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_match_user" ON "match_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_match_played" ON "match_history" USING btree ("played_at");--> statement-breakpoint
CREATE INDEX "idx_match_platform" ON "match_history" USING btree ("platform","platform_match_id");--> statement-breakpoint
CREATE INDEX "idx_match_player_match" ON "match_players" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "idx_match_player_user" ON "match_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_match_player_rsvp" ON "match_players" USING btree ("rsvp_status");--> statement-breakpoint
CREATE INDEX "idx_match_player1" ON "matches" USING btree ("player1_id");--> statement-breakpoint
CREATE INDEX "idx_match_player2" ON "matches" USING btree ("player2_id");--> statement-breakpoint
CREATE INDEX "idx_match_played_at" ON "matches" USING btree ("played_at");--> statement-breakpoint
CREATE INDEX "idx_match_status" ON "matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_match_scheduled_at" ON "matches" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_message_conversation" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_message_created" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_migration_job_user" ON "migration_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_migration_job_status" ON "migration_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_notification_user" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notification_status" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_notification_scheduled" ON "notifications" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_notification_type" ON "notifications" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "idx_payment_booking" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_payment_user" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_payment_venue" ON "payments" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "idx_payment_status" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payment_stripe_pi" ON "payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "idx_rating_player" ON "player_ratings" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "idx_preference_user" ON "preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_preference_category" ON "preferences" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "idx_rating_history_player" ON "rating_history" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "idx_rating_history_match" ON "rating_history" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "idx_referral_claim_referrer" ON "referral_claims" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "idx_referral_claim_code" ON "referral_claims" USING btree ("code_id");--> statement-breakpoint
CREATE INDEX "idx_referral_claim_status" ON "referral_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_referral_code_owner" ON "referral_codes" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_referral_code_active" ON "referral_codes" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_payout_referrer" ON "referral_payouts" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "idx_payout_status" ON "referral_payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payout_reflink" ON "referral_payouts" USING btree ("reflink_id");--> statement-breakpoint
CREATE INDEX "idx_referral_reflink" ON "referrals" USING btree ("reflink_id");--> statement-breakpoint
CREATE INDEX "idx_referral_referrer" ON "referrals" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "idx_referral_referred" ON "referrals" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "idx_reflink_user" ON "reflinks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_reflink_code" ON "reflinks" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_reflink_tier" ON "reflinks" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "idx_user_connection_user" ON "user_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_connection_platform" ON "user_connections" USING btree ("platform","platform_user_id");--> statement-breakpoint
CREATE INDEX "idx_venue_location" ON "venues" USING btree ("lat","lng");