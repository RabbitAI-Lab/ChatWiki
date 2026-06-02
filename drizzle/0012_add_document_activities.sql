CREATE TABLE IF NOT EXISTS `document_activities` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `project_id` text NOT NULL,
  `document_path` text NOT NULL,
  `document_title` text NOT NULL,
  `action` text NOT NULL,
  `old_title` text,
  `created_at` text NOT NULL
);
CREATE INDEX IF NOT EXISTS `idx_document_activities_project_created` ON `document_activities` (`project_id`,`created_at`);
