ALTER TABLE `plans` ADD `default_currency` text DEFAULT 'CNY' NOT NULL;
--> statement-breakpoint
ALTER TABLE `plans` ADD `prices` text DEFAULT '[]' NOT NULL;
