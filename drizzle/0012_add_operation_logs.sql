CREATE TABLE `operation_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `project_id` text NOT NULL,
  `category` text NOT NULL,
  `action` text NOT NULL,
  `detail` text NOT NULL,
  `operator` text NOT NULL DEFAULT 'system',
  `metadata` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_operation_logs_project_id` ON `operation_logs` (`project_id`);
--> statement-breakpoint
CREATE INDEX `idx_operation_logs_project_category` ON `operation_logs` (`project_id`, `category`);
--> statement-breakpoint
CREATE INDEX `idx_operation_logs_project_created` ON `operation_logs` (`project_id`, `created_at` DESC);
