CREATE TABLE `plans` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `default_currency` text DEFAULT 'CNY' NOT NULL,
  `prices` text DEFAULT '[]' NOT NULL,
  `discount_type` text DEFAULT 'none' NOT NULL,
  `discount_value` integer DEFAULT 0 NOT NULL,
  `features` text DEFAULT '[]' NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
