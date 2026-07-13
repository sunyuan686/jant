CREATE TABLE `storage_purge` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`provider` text NOT NULL,
	`storage_key` text NOT NULL,
	`original_key` text NOT NULL,
	`reason` text,
	`purge_after` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `site`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_storage_purge_provider_key` ON `storage_purge` (`provider`,`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_storage_purge_site_provider_due` ON `storage_purge` (`site_id`,`provider`,`purge_after`);