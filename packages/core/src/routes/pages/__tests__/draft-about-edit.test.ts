import { describe, expect, it } from "vitest";
import { createTestApp } from "../../../__tests__/helpers/app.js";
import { pageRoutes } from "../page.js";

function createPageTestApp(options: { authenticated?: boolean } = {}) {
  const testApp = createTestApp(options);
  const { app } = testApp;

  app.use("*", async (c, next) => {
    c.set("publicPath", c.req.path);
    c.set("publicRequestUrl", c.req.url);
    await next();
  });

  app.route("/", pageRoutes);

  return testApp;
}

async function createDraftAbout(
  services: ReturnType<typeof createTestApp>["services"],
) {
  return services.posts.create({
    format: "note",
    title: "About",
    slug: "about",
    bodyMarkdown: "Draft About body",
    status: "draft",
    visibility: "latest_hidden",
  });
}

describe("draft About edit route", () => {
  it("keeps draft About hidden from anonymous edit requests", async () => {
    const { app, services } = createPageTestApp();
    await createDraftAbout(services);

    const res = await app.request("/about?edit=1");

    expect(res.status).toBe(404);
  });

  it("keeps draft About hidden from normal authenticated page requests", async () => {
    const { app, services } = createPageTestApp({ authenticated: true });
    await createDraftAbout(services);

    const res = await app.request("/about");

    expect(res.status).toBe(404);
  });

  it("renders draft About for authenticated edit requests", async () => {
    const { app, services } = createPageTestApp({ authenticated: true });
    const post = await createDraftAbout(services);

    const res = await app.request("/about?edit=1");

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(`data-post-id="${post.id}"`);
    expect(html).toContain("data-authenticated");
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain("application/ld+json");
  });
});
