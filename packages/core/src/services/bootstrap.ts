/**
 * Bootstrap Service
 *
 * Owns first-run site shell setup after account creation.
 */

import type { Database } from "../db/index.js";
import {
  sqliteSchemaBundle,
  type DatabaseSchema,
} from "../db/schema-bundle.js";
import {
  baseLocale,
  isValidContentLanguage,
  normalizeContentLanguage,
  resolveCatalogLocale,
} from "../i18n/locales.js";
import { createNavItemService } from "./navigation.js";
import { createSettingsService } from "./settings.js";
import { createSiteMemberService } from "./site-member.js";
import { createSiteService, type EnsureSingleSiteOptions } from "./site.js";

export interface CompleteInitialSetupData {
  ownerUserId: string;
  siteName: string;
  siteLanguage?: string | null;
  cjkSerifFont?: string | null;
  timeZone?: string | null;
}

export interface BootstrapService {
  /**
   * Complete first-run setup for a newly created account.
   * Ensures default system navigation exists and marks onboarding complete last.
   *
   * @param data - Initial site shell values captured during setup
   */
  completeInitialSetup(data: CompleteInitialSetupData): Promise<void>;
}

export function createBootstrapService(
  db: Database,
  options?: {
    schema?: DatabaseSchema;
    bootstrapSite?: EnsureSingleSiteOptions;
  },
): BootstrapService {
  const databaseSchema = options?.schema ?? sqliteSchemaBundle;

  return {
    async completeInitialSetup(data) {
      const siteService = createSiteService(db, databaseSchema);
      const { site } = await siteService.ensureSingleSite(
        options?.bootstrapSite,
      );
      const settings = createSettingsService(db, site.id, databaseSchema);
      const navItems = createNavItemService(db, site.id, databaseSchema);
      const siteMembers = createSiteMemberService(db, databaseSchema);

      await siteMembers.ensure(site.id, data.ownerUserId, "owner");
      await navItems.ensureSystemDefaults();
      await settings.set("SITE_NAME", data.siteName.trim());
      await settings.set("TIME_ZONE", data.timeZone ?? "UTC");
      const siteLanguage =
        data.siteLanguage && isValidContentLanguage(data.siteLanguage)
          ? normalizeContentLanguage(data.siteLanguage)
          : baseLocale;
      await settings.set("SITE_LANGUAGE", siteLanguage);
      // Pin the dashboard UI locale to the detected catalog language so it stays
      // stable if the operator later changes the public content language.
      await settings.set(
        "DASHBOARD_LANGUAGE",
        resolveCatalogLocale(siteLanguage),
      );
      if (data.cjkSerifFont && data.cjkSerifFont !== "off") {
        await settings.set("CJK_SERIF_FONT", data.cjkSerifFont);
      }

      await settings.completeOnboarding();
    },
  };
}
