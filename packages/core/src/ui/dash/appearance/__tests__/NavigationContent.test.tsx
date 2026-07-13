import type { Context } from "hono";
import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../../../i18n/context.js";
import { createI18n } from "../../../../i18n/i18n.js";
import { NavigationContent } from "../NavigationContent.js";

function renderNavigationContent(
  props: Partial<Parameters<typeof NavigationContent>[0]> = {},
): string {
  const i18n = createI18n("en");
  const c = {
    get(key: string) {
      if (key === "i18n") return i18n;
      return undefined;
    },
  } as unknown as Context;

  I18nProvider({ c, children: "" });

  return renderToString(
    NavigationContent({
      navItems: [],
      directoryData: { collections: [], items: [], directoryItems: [] },
      suggestedLinks: [],
      mainRssFeed: "latest",
      siteName: "Test Site",
      ...props,
    }),
  );
}

describe("NavigationContent", () => {
  it("interpolates the latest feed label in the RSS system link description", () => {
    const html = renderNavigationContent({ mainRssFeed: "latest" });

    expect(html).toContain(
      "Header RSS points to your Latest feed (/feed). Change what /feed returns in General.",
    );
  });

  it("interpolates the featured feed label in the RSS system link description", () => {
    const html = renderNavigationContent({ mainRssFeed: "featured" });

    expect(html).toContain(
      "Header RSS points to your Featured feed (/feed). Change what /feed returns in General.",
    );
  });

  it("renders the built-in links heading", () => {
    const html = renderNavigationContent();

    expect(html).toContain("Built-in links");
  });

  it("serializes suggested links with translated target labels", () => {
    const html = renderNavigationContent({
      suggestedLinks: [
        {
          key: "now",
          label: "Now",
          url: "/now",
          targetType: "collection",
          navItemType: "collection",
          collectionId: "col_now",
        },
      ],
    });

    expect(html).toContain("suggested-links=");
    expect(html).toContain("&quot;targetLabel&quot;:&quot;Collection&quot;");
  });
});
