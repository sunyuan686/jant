import { describe, it, expect } from "vitest";
import { detectLocaleFromHeader, detectCjkFontFromHeader } from "../detect.js";

describe("detectLocaleFromHeader", () => {
  it("returns en for en", () => {
    expect(detectLocaleFromHeader("en")).toBe("en");
  });

  it("returns en for en-US", () => {
    expect(detectLocaleFromHeader("en-US")).toBe("en");
  });

  it("returns en for en-GB", () => {
    expect(detectLocaleFromHeader("en-GB")).toBe("en");
  });

  it("falls back to en for unsupported language", () => {
    expect(detectLocaleFromHeader("fr")).toBe("en");
  });

  it("maps Simplified Chinese browser locales to zh-Hans", () => {
    expect(detectLocaleFromHeader("zh-CN")).toBe("zh-Hans");
    expect(detectLocaleFromHeader("zh-SG")).toBe("zh-Hans");
  });

  it("maps Traditional Chinese browser locales to zh-Hant", () => {
    expect(detectLocaleFromHeader("zh-TW")).toBe("zh-Hant");
    expect(detectLocaleFromHeader("zh-HK")).toBe("zh-Hant");
  });

  it("returns en for undefined", () => {
    expect(detectLocaleFromHeader(undefined)).toBe("en");
  });

  it("returns en for empty string", () => {
    expect(detectLocaleFromHeader("")).toBe("en");
  });

  it("returns en for whitespace-only string", () => {
    expect(detectLocaleFromHeader("   ")).toBe("en");
  });

  it("handles wildcard (*)", () => {
    expect(detectLocaleFromHeader("*")).toBe("en");
  });
});

describe("detectCjkFontFromHeader", () => {
  // Simplified Chinese
  it("maps zh-CN to zh-Hans", () => {
    expect(detectCjkFontFromHeader("zh-CN")).toBe("zh-Hans");
  });

  it("maps zh-SG to zh-Hans", () => {
    expect(detectCjkFontFromHeader("zh-SG")).toBe("zh-Hans");
  });

  it("maps zh-Hans to zh-Hans", () => {
    expect(detectCjkFontFromHeader("zh-Hans")).toBe("zh-Hans");
  });

  it("maps bare zh to zh-Hans", () => {
    expect(detectCjkFontFromHeader("zh")).toBe("zh-Hans");
  });

  // Traditional Chinese
  it("maps zh-TW to zh-Hant", () => {
    expect(detectCjkFontFromHeader("zh-TW")).toBe("zh-Hant");
  });

  it("maps zh-HK to zh-Hant", () => {
    expect(detectCjkFontFromHeader("zh-HK")).toBe("zh-Hant");
  });

  it("maps zh-MO to zh-Hant", () => {
    expect(detectCjkFontFromHeader("zh-MO")).toBe("zh-Hant");
  });

  it("maps zh-Hant to zh-Hant", () => {
    expect(detectCjkFontFromHeader("zh-Hant")).toBe("zh-Hant");
  });

  // Japanese
  it("maps ja to ja", () => {
    expect(detectCjkFontFromHeader("ja")).toBe("ja");
  });

  it("maps ja-JP to ja", () => {
    expect(detectCjkFontFromHeader("ja-JP")).toBe("ja");
  });

  // Korean
  it("maps ko to ko", () => {
    expect(detectCjkFontFromHeader("ko")).toBe("ko");
  });

  it("maps ko-KR to ko", () => {
    expect(detectCjkFontFromHeader("ko-KR")).toBe("ko");
  });

  // q-value priority
  it("picks highest q-value CJK language", () => {
    expect(detectCjkFontFromHeader("fr;q=0.5,zh-CN;q=0.9,en;q=0.8")).toBe(
      "zh-Hans",
    );
  });

  it("picks first CJK when q-values are equal", () => {
    expect(detectCjkFontFromHeader("zh-TW,en")).toBe("zh-Hant");
  });

  // Non-CJK fallback
  it("returns off for non-CJK language", () => {
    expect(detectCjkFontFromHeader("en-US")).toBe("off");
  });

  it("returns off for undefined", () => {
    expect(detectCjkFontFromHeader(undefined)).toBe("off");
  });

  it("returns off for empty string", () => {
    expect(detectCjkFontFromHeader("")).toBe("off");
  });

  it("skips entries with q=0", () => {
    expect(detectCjkFontFromHeader("zh-CN;q=0,en")).toBe("off");
  });

  it("is case-insensitive", () => {
    expect(detectCjkFontFromHeader("ZH-CN")).toBe("zh-Hans");
  });

  it("handles realistic browser header", () => {
    expect(detectCjkFontFromHeader("zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7")).toBe(
      "zh-Hant",
    );
  });
});
