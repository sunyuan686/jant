/**
 * Nav Items API Routes
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { Bindings } from "../../types.js";
import type { AppVariables } from "../../types/app-context.js";
import { requireAuthApi } from "../../middleware/auth.js";
import {
  CreateNavItemSchema,
  NavItemIdSchema,
  UpdateNavItemSchema,
  parseValidated,
} from "../../lib/schemas.js";
import { assertFound, parseIdParam, NotFoundError } from "../../lib/errors.js";
import { ID_PREFIX } from "../../lib/ids.js";
import { getCollectionPagePath } from "../../lib/collection-paths.js";
import { renderSiteHeaderHtml } from "../../lib/site-header-fragment.js";

type Env = { Bindings: Bindings; Variables: AppVariables };

export const navItemsApiRoutes = new Hono<Env>();

const INCLUDE_SITE_HEADER_RESPONSE = "include";
const SITE_HEADER_RESPONSE_HEADER = "x-jant-site-header";

const MoveSchema = z.object({
  after: NavItemIdSchema.nullable().optional(),
  before: NavItemIdSchema.nullable().optional(),
});

async function withSiteHeaderHtml<T extends object>(
  c: Context<Env>,
  body: T,
): Promise<T | (T & { headerHtml: string })> {
  if (
    c.req.header(SITE_HEADER_RESPONSE_HEADER) !== INCLUDE_SITE_HEADER_RESPONSE
  ) {
    return body;
  }

  return {
    ...body,
    headerHtml: await renderSiteHeaderHtml(c),
  };
}

// List nav items
navItemsApiRoutes.get("/", async (c) => {
  const items = await c.var.services.navItems.list();
  return c.json({ navItems: items });
});

// Move nav item (requires auth) — must be before /:id
navItemsApiRoutes.put("/:id/move", requireAuthApi(), async (c) => {
  const id = parseIdParam(c.req.param("id"), ID_PREFIX.navItem);
  const body = parseValidated(MoveSchema, await c.req.json());

  const item = assertFound(
    await c.var.services.navItems.move(
      id,
      body.after ?? null,
      body.before ?? null,
    ),
    "Nav item",
  );

  return c.json(await withSiteHeaderHtml(c, item));
});

// Create nav item (requires auth)
navItemsApiRoutes.post("/", requireAuthApi(), async (c) => {
  const body = parseValidated(CreateNavItemSchema, await c.req.json());

  let item;
  if (body.type === "system") {
    item = await c.var.services.navItems.create({
      type: "system",
      systemKey: body.systemKey,
      placement: body.placement,
    });
  } else if (body.type === "collection") {
    const collection = await c.var.services.collections.getById(
      body.collectionId,
    );
    if (!collection) throw new NotFoundError("Collection");

    item = await c.var.services.navItems.create({
      type: "collection",
      collectionId: body.collectionId,
      label: body.label || collection.title,
      url: getCollectionPagePath(collection.slug),
      placement: body.placement,
    });
  } else {
    item = await c.var.services.navItems.create({
      type: "link",
      label: body.label,
      url: body.url,
      placement: body.placement,
    });
  }

  return c.json(await withSiteHeaderHtml(c, item), 201);
});

// Update nav item (requires auth)
navItemsApiRoutes.put("/:id", requireAuthApi(), async (c) => {
  const id = parseIdParam(c.req.param("id"), ID_PREFIX.navItem);
  const body = parseValidated(UpdateNavItemSchema, await c.req.json());

  const item = assertFound(
    await c.var.services.navItems.update(id, body),
    "Nav item",
  );

  return c.json(await withSiteHeaderHtml(c, item));
});

// Delete nav item (requires auth)
navItemsApiRoutes.delete("/:id", requireAuthApi(), async (c) => {
  const id = parseIdParam(c.req.param("id"), ID_PREFIX.navItem);

  const success = await c.var.services.navItems.delete(id);
  if (!success) throw new NotFoundError("Nav item");

  return c.json(await withSiteHeaderHtml(c, { success: true }));
});
