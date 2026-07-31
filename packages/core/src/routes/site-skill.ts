import { Hono } from "hono";
import { renderSiteSkill } from "../lib/site-skill.js";
import type { Bindings } from "../types.js";
import type { AppVariables } from "../types/app-context.js";

type Env = { Bindings: Bindings; Variables: AppVariables };

export const siteSkillRoutes = new Hono<Env>();

siteSkillRoutes.get("/skill.md", (c) => {
  return new Response(renderSiteSkill(c.var.appConfig.siteUrl), {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
});
