/**
 * Featured Page Route
 *
 * Shows featured posts as a timeline feed.
 */

import { Hono } from "hono";
import { msg } from "@lingui/core/macro";
import type { Bindings } from "../../types.js";
import type { AppVariables } from "../../types/app-context.js";
import { getI18n } from "../../i18n/index.js";
import { getNavigationData } from "../../lib/navigation.js";
import { formatPageLabel, parsePageNumber } from "../../lib/pagination.js";
import { buildPageTitle } from "../../lib/page-title.js";
import { renderPublicPage } from "../../lib/render.js";
import { assembleFeaturedTimeline } from "../../lib/timeline.js";
import { toPublicPath } from "../../lib/url.js";
import { defaultFeedRenderer } from "../../lib/feed.js";
import { buildFeedData, renderFeed } from "../feed/feed.js";
import { FeaturedPage } from "../../ui/pages/FeaturedPage.js";

type Env = { Bindings: Bindings; Variables: AppVariables };

export const featuredRoutes = new Hono<Env>();

featuredRoutes.get("/", async (c) => {
  const navData = await getNavigationData(c);
  const i18n = getI18n(c);

  const page = parsePageNumber(c.req.query("page"));
  const featuredTitle = i18n._(
    msg({
      message: "Featured",
      comment: "@context: Browser page title for the featured feed",
    }),
  );
  const paginatedPageTitle = formatPageLabel(page);
  const { items, currentPage, totalPages } = await assembleFeaturedTimeline(c, {
    page,
    isAuthenticated: navData.isAuthenticated,
  });

  return renderPublicPage(c, {
    title:
      page > 1
        ? buildPageTitle(featuredTitle, paginatedPageTitle, navData.siteName)
        : buildPageTitle(featuredTitle, navData.siteName),
    navData,
    content: (
      <FeaturedPage
        items={items}
        currentPage={currentPage}
        totalPages={totalPages}
        baseUrl={toPublicPath("/featured", navData.sitePathPrefix)}
      />
    ),
  });
});

// Atom — /featured/feed (canonical featured feed)
featuredRoutes.get("/feed", async (c) => {
  const feedData = await buildFeedData(c, {
    kind: "featured",
    selfPath: "/featured/feed",
  });
  return renderFeed(defaultFeedRenderer(feedData));
});

// Legacy atom.xml suffix → canonical /featured/feed
featuredRoutes.get("/feed/atom.xml", (c) => {
  const sitePathPrefix = c.var.appConfig.sitePathPrefix;
  return c.redirect(toPublicPath("/featured/feed", sitePathPrefix), 308);
});
