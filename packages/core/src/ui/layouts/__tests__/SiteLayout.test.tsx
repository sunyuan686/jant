import type { Context } from "hono";
import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../../i18n/context.js";
import { createI18n } from "../../../i18n/i18n.js";
import type { NavItemView } from "../../../types.js";
import { SiteLayout } from "../SiteLayout.js";

function createNavItem(
  index: number,
  placement: NavItemView["placement"],
): NavItemView {
  return {
    id: `nav_${index}`,
    type: "link",
    label: `Link ${index}`,
    url: `/link-${index}`,
    placement,
    isActive: false,
    isExternal: false,
  };
}

function renderSiteLayout(
  props: Partial<Parameters<typeof SiteLayout>[0]> = {},
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
    SiteLayout({
      siteName: "Jant",
      links: [],
      currentPath: "/",
      children: "Feed",
      ...props,
    }),
  );
}

describe("SiteLayout", () => {
  it.each([
    [3, "sm"],
    [4, "md"],
    [5, "lg"],
  ] as const)(
    "reveals the More divider at the first breakpoint that overflows %i header links",
    (headerLinkCount, tier) => {
      const headerLinks = Array.from({ length: headerLinkCount }, (_, index) =>
        createNavItem(index, "header"),
      );
      const html = renderSiteLayout({
        links: [...headerLinks, createNavItem(headerLinkCount, "more")],
      });

      expect(html).toContain(
        `class="site-header-more-divider site-header-more-divider-responsive site-header-more-divider-show-${tier}"`,
      );
    },
  );

  it("omits the More divider when no header link can overflow", () => {
    const html = renderSiteLayout({
      links: [
        createNavItem(0, "header"),
        createNavItem(1, "header"),
        createNavItem(2, "more"),
      ],
    });

    expect(html).not.toContain("site-header-more-divider");
  });

  it("renders the mobile compose FAB for authenticated timeline pages", () => {
    const html = renderSiteLayout({
      currentPath: "/latest",
      isAuthenticated: true,
    });

    expect(html).toContain('class="site-mobile-compose-fab"');
    expect(html).toContain('aria-label="New post"');
    expect(html).toContain("openNew()");
  });

  it("does not render the mobile compose FAB for collection pages", () => {
    const html = renderSiteLayout({
      currentPath: "/collections/writing",
      isAuthenticated: true,
      children: "Collection",
    });

    expect(html).not.toContain('class="site-mobile-compose-fab"');
  });

  it("renders the mobile compose FAB with collection context on collection detail pages", () => {
    const html = renderSiteLayout({
      currentPath: "/collections/writing",
      isAuthenticated: true,
      composeCollectionId: "col_abc123",
      children: "Collection",
    });

    expect(html).toContain('class="site-mobile-compose-fab"');
    expect(html).toContain("col_abc123");
    expect(html).toContain("collectionId");
  });

  it("does not render the mobile compose FAB for signed-out readers", () => {
    const html = renderSiteLayout({
      currentPath: "/featured",
      isAuthenticated: false,
      children: "Feed",
    });

    expect(html).not.toContain('class="site-mobile-compose-fab"');
  });
});
