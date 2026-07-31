/**
 * Search API Routes
 */

import { Hono } from "hono";
import type { Bindings } from "../../types.js";
import type { AppVariables } from "../../types/app-context.js";
import { ValidationError, ExternalServiceError } from "../../lib/errors.js";
import { toSearchApiResult } from "../../lib/api-search.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { requirePublicApiAccess } from "../../middleware/public-content-access.js";

type Env = { Bindings: Bindings; Variables: AppVariables };

export const searchApiRoutes = new Hono<Env>();

searchApiRoutes.use("*", requirePublicApiAccess());

// Per-IP rate limit. The request-time wrapper is needed because the
// per-minute cap is pulled from `appConfig` which is only available on
// `c.var`; constructing the middleware once at module load would capture
// an undefined value.
searchApiRoutes.use("*", async (c, next) =>
  rateLimit({
    name: "search",
    limit: c.var.appConfig.rateLimit.searchPerMinute,
    windowSec: 60,
  })(c, next),
);

// Search posts
searchApiRoutes.get("/", async (c) => {
  const query = c.req.query("q");

  if (!query || query.trim().length === 0) {
    throw new ValidationError("Query parameter 'q' is required");
  }

  if (query.length > 200) {
    throw new ValidationError("Query too long");
  }

  const limitParam = c.req.query("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 50) : 20;

  try {
    const results = await c.var.services.search.search(query, {
      limit,
      status: ["published"],
    });

    return c.json({
      query,
      results: results.map((r) =>
        toSearchApiResult(r.post, r.snippet, c.var.appConfig.sitePathPrefix),
      ),
      count: results.length,
    });
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    // eslint-disable-next-line no-console -- Error logging is intentional
    console.error("Search error:", err);
    throw new ExternalServiceError("Search failed");
  }
});
