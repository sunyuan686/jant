import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { i18nMiddleware } from "../middleware.js";
import type { Bindings } from "../../types.js";
import type { AppVariables } from "../../types/app-context.js";

type Env = { Bindings: Bindings; Variables: AppVariables };

function createApp(allSettings: Record<string, string>) {
  const app = new Hono<Env>();

  app.use("*", async (c, next) => {
    c.set("allSettings", allSettings);
    await next();
  });
  app.use("*", i18nMiddleware());
  // Returns `${lang}|${i18n.locale}` so tests can assert both independently.
  app.get("*", (c) => c.text(`${c.get("lang")}|${c.get("i18n").locale}`));

  return app;
}

describe("i18nMiddleware", () => {
  it("sets html lang to SITE_LANGUAGE but renders public UI in en", async () => {
    const app = createApp({
      ONBOARDING_STATUS: "completed",
      SITE_LANGUAGE: "zh-Hans",
    });
    const res = await app.request("/", {
      headers: { "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" },
    });

    // `lang` reflects content language (posts), i18n is en on public routes.
    expect(await res.text()).toBe("zh-Hans|en");
  });

  it("activates SITE_LANGUAGE on /settings routes", async () => {
    const app = createApp({
      ONBOARDING_STATUS: "completed",
      SITE_LANGUAGE: "zh-Hans",
    });
    const res = await app.request("/settings/general");

    expect(await res.text()).toBe("zh-Hans|zh-Hans");
  });

  it("activates SITE_LANGUAGE on /dash routes", async () => {
    const app = createApp({
      ONBOARDING_STATUS: "completed",
      SITE_LANGUAGE: "zh-Hans",
    });
    const res = await app.request("/dash");

    expect(await res.text()).toBe("zh-Hans|zh-Hans");
  });

  it("keeps public routes in en regardless of SITE_LANGUAGE", async () => {
    const app = createApp({
      ONBOARDING_STATUS: "completed",
      SITE_LANGUAGE: "zh-Hans",
    });
    const res = await app.request("/collections");

    expect(await res.text()).toBe("zh-Hans|en");
  });

  it("falls back to en on admin routes when SITE_LANGUAGE is missing", async () => {
    const app = createApp({ ONBOARDING_STATUS: "completed" });
    const res = await app.request("/settings");

    expect(await res.text()).toBe("en|en");
  });

  it("preserves SITE_LANGUAGE for html lang while falling back catalog to en", async () => {
    const app = createApp({
      ONBOARDING_STATUS: "completed",
      SITE_LANGUAGE: "fr",
    });
    const res = await app.request("/settings");

    // `lang` keeps the operator's content language verbatim; catalog falls
    // back to en because Jant has no French dashboard translation yet.
    expect(await res.text()).toBe("fr|en");
  });

  it("maps zh-CN content language to zh-Hans catalog", async () => {
    const app = createApp({
      ONBOARDING_STATUS: "completed",
      SITE_LANGUAGE: "zh-CN",
    });
    const res = await app.request("/settings");

    expect(await res.text()).toBe("zh-CN|zh-Hans");
  });

  it("maps zh-TW content language to zh-Hant catalog", async () => {
    const app = createApp({
      ONBOARDING_STATUS: "completed",
      SITE_LANGUAGE: "zh-TW",
    });
    const res = await app.request("/settings");

    expect(await res.text()).toBe("zh-TW|zh-Hant");
  });

  it("normalizes lowercase tags to canonical form", async () => {
    const app = createApp({
      ONBOARDING_STATUS: "completed",
      SITE_LANGUAGE: "ZH-hans",
    });
    const res = await app.request("/settings");

    expect(await res.text()).toBe("zh-Hans|zh-Hans");
  });

  it("falls back to en when SITE_LANGUAGE is not a valid BCP 47 tag", async () => {
    const app = createApp({
      ONBOARDING_STATUS: "completed",
      SITE_LANGUAGE: "not a locale!!!",
    });
    const res = await app.request("/settings");

    expect(await res.text()).toBe("en|en");
  });

  it("DASHBOARD_LANGUAGE drives the admin catalog independently of content", async () => {
    const app = createApp({
      ONBOARDING_STATUS: "completed",
      SITE_LANGUAGE: "fr",
      DASHBOARD_LANGUAGE: "zh-Hans",
    });
    const res = await app.request("/settings");

    // Content stays French; the dashboard renders in the explicit zh-Hans.
    expect(await res.text()).toBe("fr|zh-Hans");
  });

  it("ignores DASHBOARD_LANGUAGE on public routes", async () => {
    const app = createApp({
      ONBOARDING_STATUS: "completed",
      SITE_LANGUAGE: "fr",
      DASHBOARD_LANGUAGE: "zh-Hans",
    });
    const res = await app.request("/");

    expect(await res.text()).toBe("fr|en");
  });

  it("derives the admin catalog from content when DASHBOARD_LANGUAGE is empty", async () => {
    const app = createApp({
      ONBOARDING_STATUS: "completed",
      SITE_LANGUAGE: "zh-TW",
      DASHBOARD_LANGUAGE: "",
    });
    const res = await app.request("/settings");

    expect(await res.text()).toBe("zh-TW|zh-Hant");
  });

  it("ignores a DASHBOARD_LANGUAGE that is not a translated catalog locale", async () => {
    const app = createApp({
      ONBOARDING_STATUS: "completed",
      SITE_LANGUAGE: "zh-Hans",
      DASHBOARD_LANGUAGE: "fr",
    });
    const res = await app.request("/settings");

    // "fr" is not one of the 3 catalog locales, so we derive from content.
    expect(await res.text()).toBe("zh-Hans|zh-Hans");
  });
});
