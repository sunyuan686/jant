PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_nav_item` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`type` text DEFAULT 'link' NOT NULL,
	`system_key` text,
	`collection_id` text,
	`post_id` text,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`placement` text DEFAULT 'header' NOT NULL,
	`position` text DEFAULT 'a0' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `site`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_id`) REFERENCES `collection`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_nav_item_type" CHECK("__new_nav_item"."type" IN ('link', 'system', 'collection', 'page')),
	CONSTRAINT "chk_nav_item_placement" CHECK("__new_nav_item"."placement" IN ('header', 'more')),
	CONSTRAINT "chk_nav_item_shape" CHECK((
        "__new_nav_item"."type" = 'link'
        AND "__new_nav_item"."system_key" IS NULL
        AND "__new_nav_item"."collection_id" IS NULL
        AND "__new_nav_item"."post_id" IS NULL
      ) OR (
        "__new_nav_item"."type" = 'system'
        AND "__new_nav_item"."system_key" IS NOT NULL
        AND "__new_nav_item"."collection_id" IS NULL
        AND "__new_nav_item"."post_id" IS NULL
      ) OR (
        "__new_nav_item"."type" = 'collection'
        AND "__new_nav_item"."system_key" IS NULL
        AND "__new_nav_item"."collection_id" IS NOT NULL
        AND "__new_nav_item"."post_id" IS NULL
      ) OR (
        "__new_nav_item"."type" = 'page'
        AND "__new_nav_item"."system_key" IS NULL
        AND "__new_nav_item"."collection_id" IS NULL
        AND "__new_nav_item"."post_id" IS NOT NULL
      ))
);
--> statement-breakpoint
INSERT INTO `__new_nav_item`("id", "site_id", "type", "system_key", "collection_id", "post_id", "label", "url", "placement", "position", "created_at", "updated_at") SELECT "id", "site_id", "type", "system_key", "collection_id", NULL, "label", "url", "placement", "position", "created_at", "updated_at" FROM `nav_item`;--> statement-breakpoint
DROP TABLE `nav_item`;--> statement-breakpoint
ALTER TABLE `__new_nav_item` RENAME TO `nav_item`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_nav_item_site_position` ON `nav_item` (`site_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_nav_item_site_system_key` ON `nav_item` (`site_id`,`system_key`) WHERE "nav_item"."system_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_nav_item_site_collection_id` ON `nav_item` (`site_id`,`collection_id`) WHERE "nav_item"."collection_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_nav_item_site_post_id` ON `nav_item` (`site_id`,`post_id`) WHERE "nav_item"."post_id" IS NOT NULL;
