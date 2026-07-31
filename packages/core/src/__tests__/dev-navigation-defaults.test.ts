import { describe, expect, it } from "vitest";
import { DEFAULT_NAVIGATION_SEED_ITEMS } from "../../dev/scripts/dev-auth-db.mjs";
import {
  DEFAULT_NAVIGATION_PROFILE,
  SYSTEM_NAV_KEYS,
} from "../types/constants.js";

describe("dev navigation bootstrap", () => {
  it("derives the translated-label seed rows from the shared profile", () => {
    expect(DEFAULT_NAVIGATION_SEED_ITEMS).toEqual(
      DEFAULT_NAVIGATION_PROFILE.systemKeys.map((systemKey) => ({
        systemKey,
        label: "",
        url: SYSTEM_NAV_KEYS[systemKey].url,
        placement: SYSTEM_NAV_KEYS[systemKey].defaultPlacement,
      })),
    );
    expect(
      DEFAULT_NAVIGATION_SEED_ITEMS.map((item) => item.systemKey),
    ).not.toContain("latest");
  });
});
