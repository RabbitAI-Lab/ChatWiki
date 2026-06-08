ALTER TABLE `model_configs` ADD `extra_env_json` text NOT NULL DEFAULT '{}';
--> statement-breakpoint
UPDATE `model_configs` SET `extra_env_json` = '{}' WHERE `extra_env_json` IS NULL OR `extra_env_json` = '';
