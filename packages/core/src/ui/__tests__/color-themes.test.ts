import { describe, expect, it } from "vitest";
import { BUILTIN_COLOR_THEMES } from "../color-themes.js";

describe("BUILTIN_COLOR_THEMES", () => {
  it("contains 15 themes", () => {
    expect(BUILTIN_COLOR_THEMES).toHaveLength(15);
  });

  it("keeps Tufte as the first theme", () => {
    expect(BUILTIN_COLOR_THEMES[0]?.id).toBe("tufte");
  });

  it("has no duplicate IDs", () => {
    const ids = BUILTIN_COLOR_THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("defines the required core tokens for each mode", () => {
    const requiredTokens = [
      "--background",
      "--foreground",
      "--primary",
      "--primary-foreground",
      "--site-accent",
      "--muted",
      "--muted-foreground",
      "--border",
    ] as const;

    for (const theme of BUILTIN_COLOR_THEMES) {
      for (const token of requiredTokens) {
        expect(theme.light[token]).toBeTruthy();
        expect(theme.dark[token]).toBeTruthy();
      }
    }
  });

  it("keeps Linen aligned with the default brand palette", () => {
    const linen = BUILTIN_COLOR_THEMES.find((theme) => theme.id === "linen");

    expect(linen?.light["--primary"]).toBe("oklch(0.3633 0.0697 159.95)");
    expect(linen?.light["--site-accent"]).toBe("oklch(0.4406 0.0568 159.95)");
    expect(linen?.light["--site-reading-body"]).toBe("oklch(0.242 0.012 58)");
    expect(linen?.light["--site-reading-heading"]).toBe("oklch(0.226 0.01 62)");
    expect(linen?.dark["--primary"]).toBe("oklch(0.6966 0.0528 159.95)");
    expect(linen?.dark["--site-accent"]).toBe("oklch(0.7306 0.0478 159.95)");
  });
});
