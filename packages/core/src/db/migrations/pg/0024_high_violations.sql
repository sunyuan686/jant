CREATE TABLE "storage_purge" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"provider" text NOT NULL,
	"storage_key" text NOT NULL,
	"original_key" text NOT NULL,
	"reason" text,
	"purge_after" integer NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "storage_purge" ADD CONSTRAINT "storage_purge_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_storage_purge_provider_key" ON "storage_purge" USING btree ("provider","storage_key");--> statement-breakpoint
CREATE INDEX "idx_storage_purge_site_provider_due" ON "storage_purge" USING btree ("site_id","provider","purge_after");