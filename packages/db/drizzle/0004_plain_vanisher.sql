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
ALTER TABLE "coach_students" ADD CONSTRAINT "coach_students_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_students" ADD CONSTRAINT "coach_students_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_coach_student_coach" ON "coach_students" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "idx_coach_student_student" ON "coach_students" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_coach_status" ON "coaches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_coach_user" ON "coaches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_coaching_session_coach" ON "coaching_sessions" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "idx_coaching_session_starts" ON "coaching_sessions" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "idx_coaching_session_status" ON "coaching_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_coaching_session_venue" ON "coaching_sessions" USING btree ("venue_id");