import { describe, expect, it } from "vitest";
import { shouldRunLinguiBuildForFile } from "../../vite.dev-plugins.js";

describe("vite dev plugins", () => {
  it("does not run Lingui build for generated i18n output", () => {
    expect(
      shouldRunLinguiBuildForFile(
        "/repo/packages/core/src/i18n/coverage.generated.ts",
      ),
    ).toBe(false);
    expect(
      shouldRunLinguiBuildForFile(
        "\\repo\\packages\\core\\src\\i18n\\coverage.generated.ts",
      ),
    ).toBe(false);
    expect(
      shouldRunLinguiBuildForFile(
        "/repo/packages/core/src/i18n/locales/settings/en.ts",
      ),
    ).toBe(false);
  });

  it("runs Lingui build for source TypeScript files", () => {
    expect(
      shouldRunLinguiBuildForFile("/repo/packages/core/src/ui/pages/Home.tsx"),
    ).toBe(true);
    expect(
      shouldRunLinguiBuildForFile("/repo/packages/core/src/routes/posts.ts"),
    ).toBe(true);
    expect(
      shouldRunLinguiBuildForFile("/repo/packages/core/src/styles/ui.css"),
    ).toBe(false);
  });
});
