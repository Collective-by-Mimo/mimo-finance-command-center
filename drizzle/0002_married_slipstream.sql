ALTER TABLE `invoices` MODIFY COLUMN `type` enum('income','expense','pending') NOT NULL DEFAULT 'income';--> statement-breakpoint
ALTER TABLE `invoices` MODIFY COLUMN `fileUrl` text;--> statement-breakpoint
ALTER TABLE `invoices` MODIFY COLUMN `source` enum('manual','gmail','upload','ai_generated','sheets') NOT NULL DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `user_settings` MODIFY COLUMN `appsScriptUrl` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `rawEmailId` varchar(256);--> statement-breakpoint
ALTER TABLE `transactions` ADD `source` varchar(64) DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `invoices` DROP COLUMN `paidDate`;--> statement-breakpoint
ALTER TABLE `invoices` DROP COLUMN `fileName`;--> statement-breakpoint
ALTER TABLE `invoices` DROP COLUMN `gmailThreadId`;--> statement-breakpoint
ALTER TABLE `invoices` DROP COLUMN `gmailMessageId`;--> statement-breakpoint
ALTER TABLE `invoices` DROP COLUMN `extractionConfidence`;--> statement-breakpoint
ALTER TABLE `invoices` DROP COLUMN `rawExtractedText`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `currency`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `tags`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `sheetsRowId`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `syncedToSheets`;--> statement-breakpoint
ALTER TABLE `user_settings` DROP COLUMN `gmailLabelFilter`;--> statement-breakpoint
ALTER TABLE `user_settings` DROP COLUMN `notificationsEnabled`;