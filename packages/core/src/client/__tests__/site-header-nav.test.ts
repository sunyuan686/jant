// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

type SiteHeaderInit = typeof import("../site-header-nav.js").initSiteHeaderNav;
type SiteHeaderDestroy =
  typeof import("../site-header-nav.js").destroySiteHeaderNav;

function createDrawerDOM(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <button
      class="site-header-hamburger"
      aria-controls="site-nav-drawer"
      aria-expanded="false"
    ></button>
    <div class="site-nav-drawer-backdrop" aria-hidden="true"></div>
    <div id="site-nav-drawer" class="site-nav-drawer" aria-hidden="true" inert>
      <div class="site-nav-drawer-header">
        <button class="site-nav-drawer-close"></button>
      </div>
      <nav class="site-nav-drawer-nav">
        <a href="/about" class="site-nav-drawer-link">About</a>
        <a href="/archive" class="site-nav-drawer-link">Archive</a>
      </nav>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function createMoreDropdownDOM(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <div class="site-header-more">
      <button
        type="button"
        class="site-header-more-btn"
        aria-expanded="false"
      >
        More
      </button>
      <div class="site-header-more-popover" aria-hidden="true">
        <a href="/archive" class="site-header-more-link">Archive</a>
        <a href="/collections" class="site-header-more-link">Collections</a>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

describe("site header more dropdown", () => {
  let initSiteHeaderNav: SiteHeaderInit;
  let destroySiteHeaderNav: SiteHeaderDestroy;
  let root: HTMLElement;

  beforeEach(async () => {
    document.body.innerHTML = "";
    vi.resetModules();
    root = createMoreDropdownDOM();
    ({ initSiteHeaderNav, destroySiteHeaderNav } =
      await import("../site-header-nav.js"));
    initSiteHeaderNav(root);
  });

  it("opens the popover when the more button is clicked", () => {
    const trigger = root.querySelector(
      ".site-header-more-btn",
    ) as HTMLButtonElement;
    const popover = root.querySelector(
      ".site-header-more-popover",
    ) as HTMLElement;

    trigger.click();

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(popover.getAttribute("aria-hidden")).toBe("false");
  });

  it("closes the popover on outside click", () => {
    const trigger = root.querySelector(
      ".site-header-more-btn",
    ) as HTMLButtonElement;
    const popover = root.querySelector(
      ".site-header-more-popover",
    ) as HTMLElement;

    trigger.click();
    document.body.click();

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(popover.getAttribute("aria-hidden")).toBe("true");
  });

  it("closes the popover on Escape and returns focus to the trigger", () => {
    const trigger = root.querySelector(
      ".site-header-more-btn",
    ) as HTMLButtonElement;
    const popover = root.querySelector(
      ".site-header-more-popover",
    ) as HTMLElement;

    trigger.click();
    document.dispatchEvent(
      new globalThis.KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
      }),
    );

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(popover.getAttribute("aria-hidden")).toBe("true");
    expect(document.activeElement).toBe(trigger);
  });

  it("closes the popover when another popover is opened", () => {
    const trigger = root.querySelector(
      ".site-header-more-btn",
    ) as HTMLButtonElement;
    const popover = root.querySelector(
      ".site-header-more-popover",
    ) as HTMLElement;
    const otherSource = document.createElement("div");

    document.body.appendChild(otherSource);
    trigger.click();
    document.dispatchEvent(
      new CustomEvent("basecoat:popover", {
        detail: { source: otherSource },
      }),
    );

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(popover.getAttribute("aria-hidden")).toBe("true");
  });

  it("removes dropdown listeners when destroyed", () => {
    const trigger = root.querySelector(
      ".site-header-more-btn",
    ) as HTMLButtonElement;
    const popover = root.querySelector(
      ".site-header-more-popover",
    ) as HTMLElement;

    destroySiteHeaderNav(root);
    trigger.click();

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(popover.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("site header nav drawer", () => {
  let initSiteHeaderNav: SiteHeaderInit;
  let destroySiteHeaderNav: SiteHeaderDestroy;
  let root: HTMLElement;

  beforeEach(async () => {
    document.body.innerHTML = "";
    document.documentElement.classList.remove("drawer-open");
    vi.resetModules();
    root = createDrawerDOM();
    ({ initSiteHeaderNav, destroySiteHeaderNav } =
      await import("../site-header-nav.js"));
    initSiteHeaderNav(root);
  });

  it("opens drawer when hamburger is clicked", () => {
    const hamburger = root.querySelector(
      ".site-header-hamburger",
    ) as HTMLButtonElement;
    const drawer = root.querySelector("#site-nav-drawer") as HTMLElement;
    const backdrop = root.querySelector(
      ".site-nav-drawer-backdrop",
    ) as HTMLElement;
    const closeBtn = root.querySelector(
      ".site-nav-drawer-close",
    ) as HTMLButtonElement;

    hamburger.click();

    expect(drawer.getAttribute("aria-hidden")).toBe("false");
    expect(drawer.hasAttribute("inert")).toBe(false);
    expect(backdrop.getAttribute("aria-hidden")).toBe("false");
    expect(hamburger.getAttribute("aria-expanded")).toBe("true");
    expect(document.documentElement.classList.contains("drawer-open")).toBe(
      true,
    );
    expect(document.activeElement).toBe(closeBtn);
  });

  it("closes drawer on close button click", () => {
    const hamburger = root.querySelector(
      ".site-header-hamburger",
    ) as HTMLButtonElement;
    const drawer = root.querySelector("#site-nav-drawer") as HTMLElement;
    const closeBtn = root.querySelector(
      ".site-nav-drawer-close",
    ) as HTMLButtonElement;

    hamburger.click();
    closeBtn.click();

    expect(drawer.getAttribute("aria-hidden")).toBe("true");
    expect(hamburger.getAttribute("aria-expanded")).toBe("false");
    expect(document.documentElement.classList.contains("drawer-open")).toBe(
      false,
    );
  });

  it("closes drawer on backdrop click", () => {
    const hamburger = root.querySelector(
      ".site-header-hamburger",
    ) as HTMLButtonElement;
    const drawer = root.querySelector("#site-nav-drawer") as HTMLElement;
    const backdrop = root.querySelector(
      ".site-nav-drawer-backdrop",
    ) as HTMLElement;

    hamburger.click();
    backdrop.click();

    expect(drawer.getAttribute("aria-hidden")).toBe("true");
    expect(backdrop.getAttribute("aria-hidden")).toBe("true");
  });

  it("closes drawer on Escape key", () => {
    const hamburger = root.querySelector(
      ".site-header-hamburger",
    ) as HTMLButtonElement;
    const drawer = root.querySelector("#site-nav-drawer") as HTMLElement;

    hamburger.click();
    drawer.dispatchEvent(
      new globalThis.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(drawer.getAttribute("aria-hidden")).toBe("true");
    expect(hamburger.getAttribute("aria-expanded")).toBe("false");
  });

  it("toggles drawer on repeated hamburger clicks", () => {
    const hamburger = root.querySelector(
      ".site-header-hamburger",
    ) as HTMLButtonElement;
    const drawer = root.querySelector("#site-nav-drawer") as HTMLElement;

    hamburger.click();
    expect(drawer.getAttribute("aria-hidden")).toBe("false");

    hamburger.click();
    expect(drawer.getAttribute("aria-hidden")).toBe("true");
  });

  it("closes drawer when a navigation link is clicked", () => {
    const hamburger = root.querySelector(
      ".site-header-hamburger",
    ) as HTMLButtonElement;
    const drawer = root.querySelector("#site-nav-drawer") as HTMLElement;
    const link = root.querySelector(
      ".site-nav-drawer-link",
    ) as HTMLAnchorElement;

    hamburger.click();
    link.click();

    expect(drawer.getAttribute("aria-hidden")).toBe("true");
    expect(hamburger.getAttribute("aria-expanded")).toBe("false");
  });

  it("removes drawer listeners when destroyed", () => {
    const hamburger = root.querySelector(
      ".site-header-hamburger",
    ) as HTMLButtonElement;
    const drawer = root.querySelector("#site-nav-drawer") as HTMLElement;

    destroySiteHeaderNav(root);
    hamburger.click();

    expect(drawer.getAttribute("aria-hidden")).toBe("true");
    expect(hamburger.getAttribute("aria-expanded")).toBe("false");
  });
});
