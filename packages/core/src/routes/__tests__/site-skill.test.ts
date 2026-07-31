import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { withConfig } from "../../middleware/config.js";
import type { Bindings } from "../../types.js";
import type { AppVariables } from "../../types/app-context.js";
import { siteSkillRoutes } from "../site-skill.js";

type Env = { Bindings: Bindings; Variables: AppVariables };

function createSiteSkillTestApp(
  env: Partial<Bindings> = {},
  pathPrefix: string | null = null,
) {
  const app = new Hono<Env>();

  app.use("*", async (c, next) => {
    c.env = env as Bindings;
    c.set("publicRequestUrl", c.req.url);
    c.set(
      "currentSiteDomain",
      pathPrefix === null
        ? null
        : ({ pathPrefix } as AppVariables["currentSiteDomain"]),
    );
    c.set("services", {
      settings: {
        getAll: async () => ({}),
      },
    } as AppVariables["services"]);
    await next();
  });
  app.use("*", withConfig());
  app.route("/", siteSkillRoutes);

  return app;
}

describe("GET /skill.md", () => {
  it("binds the guide to the request origin when SITE_ORIGIN is absent", async () => {
    const app = createSiteSkillTestApp();

    const response = await app.request("https://owen.jant.blog/skill.md");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=300, s-maxage=3600",
    );
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");

    const markdown = await response.text();
    expect(markdown).toContain("name: jant-site");
    expect(markdown).toContain("# Jant Site Skill");
    expect(markdown).toContain(
      "This site-scoped copy is bound to <https://owen.jant.blog>",
    );
    expect(markdown).toContain(
      'curl -X POST "https://owen.jant.blog/api/upload"',
    );
    expect(markdown).toContain(
      'curl -X POST "https://owen.jant.blog/api/collections"',
    );
    expect(markdown).toContain(
      "Sign in to Jant at `https://owen.jant.blog/signin`",
    );
    expect(markdown).not.toContain("$JANT_SITE");
    expect(markdown).not.toContain("<site>");
    expect(markdown).not.toContain("export JANT_SITE=");
    expect(markdown).toContain("## Common Content Operations");
    expect(markdown).toContain("## Import Content from Another Platform");
    expect(markdown).not.toContain("## If You Need to Start Over");
    expect(markdown).toContain('"url": "https://example.com/post"');
    expect(markdown).toContain("https://jant.me/docs/API.md");
  });

  it("uses the configured canonical URL and path prefix in single-site mode", async () => {
    const app = createSiteSkillTestApp({
      SITE_ORIGIN: "https://example.com",
      SITE_PATH_PREFIX: "/blog/",
    });

    const response = await app.request("https://preview.example/skill.md");
    const markdown = await response.text();

    expect(markdown).toContain(
      "This site-scoped copy is bound to <https://example.com/blog>",
    );
    expect(markdown).toContain(
      'curl -X POST "https://example.com/blog/api/upload"',
    );
    expect(markdown).not.toContain("https://preview.example");
  });

  it("includes a resolved domain path prefix in host-based mode", async () => {
    const app = createSiteSkillTestApp(
      { SITE_RESOLUTION_MODE: "host-based" },
      "/notes",
    );

    const response = await app.request("https://owen.example/skill.md");
    const markdown = await response.text();

    expect(markdown).toContain(
      "This site-scoped copy is bound to <https://owen.example/notes>",
    );
    expect(markdown).toContain(
      'curl -X POST "https://owen.example/notes/api/collections"',
    );
  });
});
