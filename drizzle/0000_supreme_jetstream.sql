CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'personal' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"key_field" text NOT NULL,
	"prefix" text NOT NULL,
	"user_id" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "api_keys_key_field_unique" UNIQUE("key_field")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"thinking" text,
	"thinking_signature" text,
	"is_error" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"title" text DEFAULT 'New Chat' NOT NULL,
	"model_id" integer,
	"template_id" integer,
	"project_id" text,
	"workspace_id" text,
	"user_model_id" integer,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "cli_authorization_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"code_challenge" text NOT NULL,
	"code_challenge_method" text DEFAULT 'S256' NOT NULL,
	"user_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "cli_authorization_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "cli_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'CLI Token' NOT NULL,
	"token" text NOT NULL,
	"prefix" text NOT NULL,
	"user_id" text NOT NULL,
	"last_used_at" text,
	"created_at" text NOT NULL,
	CONSTRAINT "cli_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "document_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"document_path" text NOT NULL,
	"document_title" text NOT NULL,
	"action" text NOT NULL,
	"old_title" text,
	"user_id" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"code" text,
	"expires_at" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "email_verifications_token_unique" UNIQUE("token"),
	CONSTRAINT "email_verifications_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "enterprises" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"account_id" text NOT NULL,
	"account_type" text DEFAULT 'personal' NOT NULL,
	"owner_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"gitnexus_status" text,
	"sandbox_status" text,
	"skills_status" text,
	"publish_status" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"member_id" text NOT NULL,
	"user_id" text,
	"account_name" text NOT NULL,
	"owner_id" text NOT NULL,
	"added_at" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_repositories" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"repo_type" text DEFAULT 'other' NOT NULL,
	"credentials" text DEFAULT '{}' NOT NULL,
	"sync_status" text,
	"last_sync_at" text,
	"last_checked_at" text,
	"local_commit_hash" text,
	"remote_commit_hash" text,
	"error_message" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"created_by_id" text,
	"used_by_id" text,
	"used_at" text,
	"created_at" text NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code"),
	CONSTRAINT "invite_codes_used_by_id_unique" UNIQUE("used_by_id")
);
--> statement-breakpoint
CREATE TABLE "mcp_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_json" text DEFAULT '{}' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"protocol" text DEFAULT 'openai' NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"api_key" text NOT NULL,
	"model_name" text NOT NULL,
	"extra_env_json" text DEFAULT '{}' NOT NULL,
	"backend" text DEFAULT 'sdk' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"order_id" text,
	"subscription_id" text,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"data" text DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduled_at" text NOT NULL,
	"sent_at" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"category" text NOT NULL,
	"action" text NOT NULL,
	"detail" text NOT NULL,
	"operator" text DEFAULT 'system' NOT NULL,
	"metadata" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" integer NOT NULL,
	"subscription_id" text,
	"next_renewal_reminder_sent" boolean DEFAULT false NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'CNY' NOT NULL,
	"original_amount" integer NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"billing_cycle" text NOT NULL,
	"payment_mode" text NOT NULL,
	"provider" text NOT NULL,
	"provider_payment_id" text,
	"provider_charge_id" text,
	"provider_invoice_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" text,
	"cancelled_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" serial PRIMARY KEY NOT NULL,
	"enterprise_id" integer NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"sign_count" integer DEFAULT 0 NOT NULL,
	"transports" text,
	"device_name" text,
	"aaguid" text,
	"created_at" text NOT NULL,
	"last_used_at" text,
	CONSTRAINT "passkeys_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"default_currency" text DEFAULT 'CNY' NOT NULL,
	"prices" text DEFAULT '[]' NOT NULL,
	"discount_type" text DEFAULT 'none' NOT NULL,
	"discount_value" integer DEFAULT 0 NOT NULL,
	"features" text DEFAULT '[]' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"provider_prices" text DEFAULT '{}' NOT NULL,
	"billing_mode" text DEFAULT 'subscription' NOT NULL,
	"token_limit_monthly" integer DEFAULT 0 NOT NULL,
	"token_limit_yearly" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" text,
	"review_note" text,
	"provider" text NOT NULL,
	"provider_refund_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sandbox_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"sandbox_url" text DEFAULT 'openapi.sandbox.rabbitai-lab.com' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" integer NOT NULL,
	"token" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "shared_chats_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "shared_html_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"html_path" text NOT NULL,
	"token" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "shared_html_files_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "storage_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"storage_path" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" text DEFAULT '' NOT NULL,
	"icon" text,
	"agent_prompt" text DEFAULT '',
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todos" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_usage_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"model_id" integer NOT NULL,
	"chat_id" integer,
	"backend" text DEFAULT 'sdk' NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_creation_input_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_input_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" integer DEFAULT 0 NOT NULL,
	"context_size" integer,
	"context_used" integer,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"num_turns" integer DEFAULT 1 NOT NULL,
	"project_id" text,
	"workspace_id" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_model_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"model_name" text NOT NULL,
	"extra_env_json" text DEFAULT '{}' NOT NULL,
	"backend" text DEFAULT 'sdk' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" integer NOT NULL,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" text NOT NULL,
	"expires_at" text NOT NULL,
	"cancelled_at" text,
	"provider" text,
	"provider_subscription_id" text,
	"provider_customer_id" text,
	"provider_session_id" text,
	"payment_mode" text DEFAULT 'subscription' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"account_type" text DEFAULT 'personal' NOT NULL,
	"enterprise_id" text,
	"positions" text,
	"satoken_login_id" text,
	"disabled" boolean DEFAULT false NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"provider_customer_ids" text DEFAULT '{}',
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_satoken_login_id_unique" UNIQUE("satoken_login_id")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cli_authorization_codes" ADD CONSTRAINT "cli_authorization_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cli_tokens" ADD CONSTRAINT "cli_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_used_by_id_users_id_fk" FOREIGN KEY ("used_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_enterprise_id_enterprises_id_fk" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_chats" ADD CONSTRAINT "shared_chats_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_model_configs" ADD CONSTRAINT "user_model_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;