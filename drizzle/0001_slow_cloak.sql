CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`invoiceNumber` varchar(64),
	`vendor` varchar(255),
	`clientName` varchar(255),
	`clientEmail` varchar(320),
	`description` text,
	`amount` decimal(12,2),
	`currency` varchar(8) DEFAULT 'USD',
	`status` enum('draft','sent','paid','overdue','cancelled') NOT NULL DEFAULT 'draft',
	`type` enum('income','expense','pending') NOT NULL DEFAULT 'pending',
	`issueDate` timestamp,
	`dueDate` timestamp,
	`paidDate` timestamp,
	`lineItems` json,
	`notes` text,
	`fileKey` varchar(512),
	`fileUrl` varchar(1024),
	`fileName` varchar(255),
	`source` enum('manual','gmail','upload','ai_generated') NOT NULL DEFAULT 'manual',
	`gmailThreadId` varchar(128),
	`gmailMessageId` varchar(128),
	`extractionConfidence` decimal(4,3),
	`rawExtractedText` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`syncType` enum('gmail','sheets','full') NOT NULL,
	`status` enum('running','success','error') NOT NULL,
	`message` text,
	`itemsProcessed` int DEFAULT 0,
	`itemsCreated` int DEFAULT 0,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `sync_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`invoiceId` int,
	`description` varchar(512) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(8) DEFAULT 'USD',
	`type` enum('income','expense','transfer') NOT NULL,
	`category` varchar(128),
	`tags` json,
	`date` timestamp NOT NULL,
	`sheetsRowId` varchar(64),
	`syncedToSheets` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`appsScriptUrl` varchar(1024),
	`sheetsId` varchar(256),
	`defaultCurrency` varchar(8) DEFAULT 'USD',
	`gmailLabelFilter` varchar(256),
	`notificationsEnabled` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_settings_userId_unique` UNIQUE(`userId`)
);
