import { describe, it, expect } from "vitest";
import { RESERVED_PATHS, isReservedPath } from "../constants.js";

describe("RESERVED_PATHS", () => {
  it("contains expected critical paths", () => {
    expect(RESERVED_PATHS).toContain("dash");
    expect(RESERVED_PATHS).toContain("api");
    expect(RESERVED_PATHS).toContain("feed");
    expect(RESERVED_PATHS).toContain("signin");
    expect(RESERVED_PATHS).toContain("search");
    expect(RESERVED_PATHS).toContain("collections");
    expect(RESERVED_PATHS).toContain("preview");
    expect(RESERVED_PATHS).toContain("_assets");
    expect(RESERVED_PATHS).toContain("skill.md");
  });
});

describe("isReservedPath", () => {
  it("returns true for reserved paths", () => {
    expect(isReservedPath("dash")).toBe(true);
    expect(isReservedPath("api")).toBe(true);
    expect(isReservedPath("feed")).toBe(true);
    expect(isReservedPath("signin")).toBe(true);
    expect(isReservedPath("skill.md")).toBe(true);
  });

  it("checks only the first segment", () => {
    expect(isReservedPath("dash/settings")).toBe(true);
    expect(isReservedPath("api/posts")).toBe(true);
    expect(isReservedPath("preview/draft-slug")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isReservedPath("DASH")).toBe(true);
    expect(isReservedPath("Api")).toBe(true);
    expect(isReservedPath("FEED")).toBe(true);
    expect(isReservedPath("PREVIEW/DRAFT-SLUG")).toBe(true);
  });

  it("returns false for non-reserved paths", () => {
    expect(isReservedPath("about")).toBe(false);
    expect(isReservedPath("contact")).toBe(false);
    expect(isReservedPath("my-custom-page")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isReservedPath("")).toBe(false);
  });
});
