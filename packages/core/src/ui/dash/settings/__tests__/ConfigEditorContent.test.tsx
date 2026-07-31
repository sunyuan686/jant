import type { Context } from "hono";
import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../../../i18n/context.js";
import { createI18n } from "../../../../i18n/i18n.js";
import type { ConfigEditorFieldState } from "../../../../types.js";
import { ConfigEditorContent } from "../ConfigEditorContent.js";

function renderConfigEditorContent(fields: ConfigEditorFieldState[]): string {
  const i18n = createI18n("en");
  const c = {
    get(key: string) {
      if (key === "i18n") return i18n;
      return undefined;
    },
  } as unknown as Context;

  I18nProvider({ c, children: "" });
  return renderToString(
    ConfigEditorContent({
      fields,
      endpoint: "/api/settings",
      sitePathPrefix: "/notes",
    }),
  );
}

describe("ConfigEditorContent", () => {
  it("renders the page, endpoint, and a useful server fallback", () => {
    const html = renderConfigEditorContent([
      {
        key: "SITE_NAME",
        mode: "edit",
        type: "string",
        value: "My Jant",
        fallbackValue: "Jant",
        modified: true,
        locked: false,
        maxLength: 120,
      },
      {
        key: "NOINDEX",
        mode: "edit",
        type: "boolean",
        value: "false",
        fallbackValue: "false",
        modified: false,
        locked: false,
      },
      {
        key: "CUSTOM_CSS",
        mode: "link",
        type: "string",
        value: "true",
        fallbackValue: "false",
        modified: true,
        locked: false,
        settingsPath: "/settings/custom-css",
        display: "configured",
      },
    ]);

    expect(html).toContain("Config Editor");
    expect(html).toContain("Changes apply immediately;");
    expect(html).toContain('endpoint="/api/settings"');
    expect(html).toContain("SITE_NAME");
    expect(html).toContain("My Jant");
    expect(html).toContain("Modified");
    expect(html).toContain("Configured");
    expect(html).toContain('href="/notes/settings/custom-css"');
    expect(html).toContain('class="config-editor-open-control"');
    expect(html).toContain("3 settings shown");
    expect(html).not.toContain("config-editor-guidance");
    expect(html).not.toContain("Save change");
    expect(html).not.toContain('target="_blank"');
  });

  it("keeps user-controlled values inert in JSON attributes and fallback HTML", () => {
    const html = renderConfigEditorContent([
      {
        key: "SITE_NAME",
        mode: "edit",
        type: "string",
        value: "</script><script>alert(1)</script>",
        fallbackValue: "",
        modified: true,
        locked: false,
        maxLength: 120,
      },
    ]);

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("\\u003c/script&gt;");
    expect(html).toContain(
      "&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });
});
