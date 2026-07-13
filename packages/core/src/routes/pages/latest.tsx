/**
 * Latest Page Route
 *
 * The homepage is the canonical latest timeline, so /latest redirects to /.
 */

import { Hono } from "hono";
import type { Bindings } from "../../types.js";
import type { AppVariables } from "../../types/app-context.js";
import { toPublicPath } from "../../lib/url.js";
import { defaultFeedRenderer } from "../../lib/feed.js";
import { buildFeedData, parseFormatQuery, renderFeed } from "../feed/feed.js";

type Env = { Bindings: Bindings; Variables: AppVariables };

export const latestRoutes = new Hono<Env>();

latestRoutes.get("/", async (c) => {
  return c.redirect(toPublicPath("/", c.var.appConfig.sitePathPrefix), 302);
});

// Atom — /latest/feed (canonical latest feed; accepts ?format=note|link|quote)
latestRoutes.get("/feed", async (c) => {
  const format = parseFormatQuery(c);
  const feedData = await buildFeedData(c, {
    kind: "latest",
    selfPath: "/latest/feed",
    format,
  });
  return renderFeed(defaultFeedRenderer(feedData));
});

// Legacy atom.xml suffix → canonical /latest/feed (preserves ?format=)
latestRoutes.get("/feed/atom.xml", (c) => {
  const sitePathPrefix = c.var.appConfig.sitePathPrefix;
  const qs = c.req.url.includes("?")
    ? c.req.url.slice(c.req.url.indexOf("?"))
    : "";
  return c.redirect(
    `${toPublicPath("/latest/feed", sitePathPrefix)}${qs}`,
    308,
  );
});
