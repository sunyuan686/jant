import { describe, it, expect } from "vitest";
import {
  TIMEZONES,
  getTimeZoneOptions,
  isSupportedTimeZone,
  mapIanaToTimezone,
  normalizeTimeZone,
} from "../timezones.js";

describe("TIMEZONES", () => {
  it("contains expected timezone entries", () => {
    expect(TIMEZONES.length).toBeGreaterThan(30);
    const shanghai = TIMEZONES.find((tz) => tz.value === "Asia/Shanghai");
    expect(shanghai).toBeDefined();
    expect(shanghai?.label).toBe("(UTC+08:00) Beijing");
  });

  it("each entry has required fields", () => {
    for (const tz of TIMEZONES) {
      expect(tz.value).toBeTruthy();
      expect(tz.label).toBeTruthy();
      expect(tz.offset).toBeTruthy();
      expect(tz.iana.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate values", () => {
    const values = TIMEZONES.map((tz) => tz.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("mapIanaToTimezone", () => {
  it("maps Asia/Shanghai to the canonical stored value", () => {
    expect(mapIanaToTimezone("Asia/Shanghai")).toBe("Asia/Shanghai");
  });

  it("maps America/New_York to the canonical stored value", () => {
    expect(mapIanaToTimezone("America/New_York")).toBe("America/New_York");
  });

  it("maps Europe/London to the canonical stored value", () => {
    expect(mapIanaToTimezone("Europe/London")).toBe("Europe/London");
  });

  it("maps Asia/Tokyo to the canonical stored value", () => {
    expect(mapIanaToTimezone("Asia/Tokyo")).toBe("Asia/Tokyo");
  });

  it("returns UTC for unknown timezone", () => {
    expect(mapIanaToTimezone("Unknown/Zone")).toBe("UTC");
  });

  it("returns UTC for empty string", () => {
    expect(mapIanaToTimezone("")).toBe("UTC");
  });

  it("maps Pacific/Honolulu to the canonical stored value", () => {
    expect(mapIanaToTimezone("Pacific/Honolulu")).toBe("Pacific/Honolulu");
  });

  it("maps Australia/Sydney to the canonical stored value", () => {
    expect(mapIanaToTimezone("Australia/Sydney")).toBe("Australia/Sydney");
  });
});

describe("normalizeTimeZone", () => {
  it("normalizes legacy display values to canonical IANA identifiers", () => {
    expect(normalizeTimeZone("Beijing")).toBe("Asia/Shanghai");
    expect(normalizeTimeZone("London")).toBe("Europe/London");
  });

  it("preserves runtime-supported zones instead of collapsing their rules", () => {
    expect(normalizeTimeZone("America/Phoenix")).toBe("America/Phoenix");
    expect(normalizeTimeZone("Australia/Darwin")).toBe("Australia/Darwin");
    expect(normalizeTimeZone("Etc/GMT-8")).toBe("Etc/GMT-8");
  });

  it("normalizes fixed offsets and UTC aliases through Intl", () => {
    expect(normalizeTimeZone("+08")).toBe("+08:00");
    expect(normalizeTimeZone("+08:00")).toBe("+08:00");
    expect(normalizeTimeZone("Etc/UTC")).toBe("UTC");
  });

  it("falls back to UTC for missing or unknown values", () => {
    expect(normalizeTimeZone("")).toBe("UTC");
    expect(normalizeTimeZone("Unknown/Zone")).toBe("UTC");
  });
});

describe("isSupportedTimeZone", () => {
  it("accepts runtime zones, fixed offsets, and legacy values", () => {
    expect(isSupportedTimeZone("Asia/Shanghai")).toBe(true);
    expect(isSupportedTimeZone("Asia/Calcutta")).toBe(true);
    expect(isSupportedTimeZone("America/Phoenix")).toBe(true);
    expect(isSupportedTimeZone("Australia/Darwin")).toBe(true);
    expect(isSupportedTimeZone("Etc/GMT-8")).toBe(true);
    expect(isSupportedTimeZone("+08:00")).toBe(true);
    expect(isSupportedTimeZone("Beijing")).toBe(true);
  });

  it("rejects empty and unknown values", () => {
    expect(isSupportedTimeZone("")).toBe(false);
    expect(isSupportedTimeZone("Unknown/Zone")).toBe(false);
  });
});

describe("getTimeZoneOptions", () => {
  it("adds an unlisted current timezone without expanding the curated list", () => {
    const options = getTimeZoneOptions("America/Phoenix");

    expect(options).toHaveLength(TIMEZONES.length + 1);
    expect(options.at(-1)).toMatchObject({
      label: "America/Phoenix",
      value: "America/Phoenix",
    });
  });

  it("does not duplicate a curated timezone", () => {
    expect(getTimeZoneOptions("Asia/Shanghai")).toBe(TIMEZONES);
  });
});
