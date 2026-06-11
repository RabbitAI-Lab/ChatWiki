CREATE TABLE IF NOT EXISTS "token_top_ups" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tokens" integer NOT NULL,
	"reason" text DEFAULT 'manual' NOT NULL,
	"note" text,
	"expires_at" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "token_top_ups" ADD CONSTRAINT "token_top_ups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;