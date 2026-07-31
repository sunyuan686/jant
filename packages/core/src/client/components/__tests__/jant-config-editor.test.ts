// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../jant-config-editor.js";
import type { JantConfigEditor } from "../jant-config-editor.js";

const fields = [
  {
    key: "ENABLE_FEATURE",
    mode: "edit",
    type: "boolean",
    value: "false",
    fallbackValue: "false",
    modified: false,
    locked: false,
    label: "Enable feature",
    description: "Turns the feature on.",
  },
  {
    key: "SITE_TITLE",
    mode: "edit",
    type: "string",
    value: "Original",
    fallbackValue: "Default",
    modified: true,
    locked: false,
    maxLength: 120,
    label: "Site title",
    description: "Names the site.",
  },
  {
    key: "ITEM_COUNT",
    mode: "edit",
    type: "number",
    value: "5",
    fallbackValue: "5",
    modified: false,
    locked: false,
    min: 1,
    max: 20,
    step: 1,
    label: "Item count",
    description: "Controls the number of items.",
  },
  {
    key: "SEARCH_COUNT",
    mode: "edit",
    type: "number",
    value: "5",
    fallbackValue: "5",
    fallbackKey: "ITEM_COUNT",
    modified: false,
    locked: false,
    min: 1,
    max: 20,
    step: 1,
    label: "Search count",
    description: "Inherits the item count.",
  },
  {
    key: "DISPLAY_MODE",
    mode: "edit",
    type: "enum",
    value: "full",
    fallbackValue: "quiet",
    modified: false,
    locked: false,
    options: ["quiet", "full"],
    optionLabels: { quiet: "Quiet", full: "Full" },
    label: "Display mode",
    description: "Chooses how much detail to show.",
  },
  {
    key: "THEME",
    mode: "link",
    type: "string",
    value: "paper",
    fallbackValue: "tufte",
    modified: true,
    locked: false,
    resettable: true,
    description: "Chooses the active color theme.",
    settingsPath: "/settings/color-theme",
    display: "value",
  },
  {
    key: "CUSTOM_CSS",
    mode: "link",
    type: "string",
    value: "false",
    fallbackValue: "false",
    modified: false,
    locked: false,
    description: "Add site-wide CSS in the dedicated editor.",
    settingsPath: "/settings/custom-css",
    display: "configured",
  },
];

function rowFor(element: HTMLElement, key: string): HTMLElement {
  const row = Array.from(
    element.querySelectorAll<HTMLElement>(".config-editor-row"),
  ).find((candidate) => candidate.textContent?.includes(key));
  if (!row) throw new Error(`Missing row for ${key}`);
  return row;
}

async function createEditor(): Promise<JantConfigEditor> {
  const element = document.createElement(
    "jant-config-editor",
  ) as JantConfigEditor;
  element.setAttribute("endpoint", "/api/settings");
  element.setAttribute("initial-data", JSON.stringify({ fields }));
  element.setAttribute("labels", JSON.stringify({}));
  const fallback = document.createElement("div");
  fallback.className = "config-editor-fallback";
  fallback.textContent = "Server-rendered fallback";
  element.appendChild(fallback);
  document.body.appendChild(element);
  await element.updateComplete;
  return element;
}

describe("jant-config-editor", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders all four control types, linked settings, and live search", async () => {
    const element = await createEditor();

    expect(element.querySelector(".config-editor-fallback")).toBeNull();

    expect(
      rowFor(element, "ENABLE_FEATURE").querySelector('[role="switch"]'),
    ).not.toBeNull();
    expect(
      rowFor(element, "ENABLE_FEATURE")
        .querySelector('[role="switch"]')
        ?.getAttribute("name"),
    ).toBe("ENABLE_FEATURE");
    expect(
      rowFor(element, "SITE_TITLE").querySelector('input[type="text"]'),
    ).not.toBeNull();
    expect(
      rowFor(element, "ITEM_COUNT").querySelector('input[type="number"]'),
    ).not.toBeNull();
    expect(
      rowFor(element, "ITEM_COUNT")
        .querySelector(".config-editor-control-row")
        ?.classList.contains("config-editor-control-row-number"),
    ).toBe(true);
    expect(
      rowFor(element, "DISPLAY_MODE").querySelector("select"),
    ).not.toBeNull();
    const displayModeSelect = rowFor(element, "DISPLAY_MODE").querySelector(
      "select",
    ) as { value?: string } | null;
    expect(displayModeSelect?.value).toBe("full");
    expect(
      rowFor(element, "DISPLAY_MODE")
        .querySelector(".config-editor-control-row")
        ?.classList.contains("config-editor-control-row-select"),
    ).toBe(true);
    expect(
      rowFor(element, "CUSTOM_CSS")
        .querySelector<HTMLAnchorElement>(".config-editor-open-control")
        ?.getAttribute("href"),
    ).toBe("/settings/custom-css");
    expect(
      rowFor(element, "CUSTOM_CSS")
        .querySelector<HTMLAnchorElement>(".config-editor-open-control")
        ?.hasAttribute("target"),
    ).toBe(false);
    expect(rowFor(element, "CUSTOM_CSS").textContent).toContain(
      "Not configured",
    );
    expect(element.querySelector(".config-editor-save")).toBeNull();
    expect(element.querySelector(".config-editor-row-footer")).toBeNull();

    const search = element.querySelector<HTMLInputElement>(
      '.config-editor-search input[type="search"]',
    );
    if (!search) throw new Error("Missing search input");
    search.value = "display";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await element.updateComplete;

    const visibleRows = element.querySelectorAll(".config-editor-row");
    expect(visibleRows).toHaveLength(1);
    expect(visibleRows[0]?.textContent).toContain("DISPLAY_MODE");

    search.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await element.updateComplete;
    expect(element.querySelectorAll(".config-editor-row")).toHaveLength(7);
  });

  it("updates unmodified dependent values when their fallback changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          settings: { ITEM_COUNT: "10", SEARCH_COUNT: "10" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const element = await createEditor();
    const input = rowFor(element, "ITEM_COUNT").querySelector<HTMLInputElement>(
      'input[type="number"]',
    );
    if (!input) throw new Error("Missing number setting input");

    input.value = "10";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await element.updateComplete;
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    await vi.waitFor(() =>
      expect(
        rowFor(element, "SEARCH_COUNT").querySelector<HTMLInputElement>(
          'input[type="number"]',
        )?.value,
      ).toBe("10"),
    );
  });

  it("can show only modified settings", async () => {
    const element = await createEditor();
    const checkbox = element.querySelector<HTMLInputElement>(
      ".config-editor-modified-filter input",
    );
    if (!checkbox) throw new Error("Missing modified-only checkbox");
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    await element.updateComplete;

    const rows = element.querySelectorAll(".config-editor-row");
    expect(rows).toHaveLength(2);
    expect(Array.from(rows).map((row) => row.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("SITE_TITLE"),
        expect.stringContaining("THEME"),
      ]),
    );
  });

  it("saves text on Enter and resets the stored override", async () => {
    const fetchMock = vi.fn(async (...[, init]: Parameters<typeof fetch>) => {
      if (init?.method === "DELETE") {
        return new Response(
          JSON.stringify({ settings: { SITE_TITLE: "Default" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ settings: { SITE_TITLE: "Changed" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const element = await createEditor();
    const input = rowFor(element, "SITE_TITLE").querySelector<HTMLInputElement>(
      'input[type="text"]',
    );
    if (!input) throw new Error("Missing text setting input");

    input.value = "Changed";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await element.updateComplete;
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "PUT" });
    await vi.waitFor(() =>
      expect(rowFor(element, "SITE_TITLE").textContent).toContain("Saved"),
    );

    const reset = rowFor(
      element,
      "SITE_TITLE",
    ).querySelector<HTMLButtonElement>(".config-editor-reset");
    if (!reset) throw new Error("Missing reset action");
    reset.click();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/settings/SITE_TITLE");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "DELETE" });
    await vi.waitFor(() =>
      expect(
        rowFor(element, "SITE_TITLE").querySelector<HTMLInputElement>(
          'input[type="text"]',
        )?.value,
      ).toBe("Default"),
    );
    expect(rowFor(element, "SITE_TITLE").textContent).not.toContain("Modified");
  });

  it("saves a changed text value on blur", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ settings: { SITE_TITLE: "Changed" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const element = await createEditor();
    const input = rowFor(element, "SITE_TITLE").querySelector<HTMLInputElement>(
      'input[type="text"]',
    );
    if (!input) throw new Error("Missing text setting input");

    input.value = "Changed";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await element.updateComplete;
    input.dispatchEvent(new Event("blur"));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "PUT" });
    await vi.waitFor(() =>
      expect(rowFor(element, "SITE_TITLE").textContent).toContain("Saved"),
    );
  });

  it("rolls back an immediate boolean edit when saving fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "The setting is locked." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const element = await createEditor();
    const toggle = rowFor(
      element,
      "ENABLE_FEATURE",
    ).querySelector<HTMLInputElement>('[role="switch"]');
    if (!toggle) throw new Error("Missing boolean setting switch");

    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() => expect(toggle.checked).toBe(false));
    expect(rowFor(element, "ENABLE_FEATURE").textContent).toContain(
      "The setting is locked.",
    );
  });

  it("resets safe linked values without exposing reset for specialized content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          settings: {},
          setting: {
            key: "THEME",
            mode: "link",
            type: "string",
            value: "tufte",
            fallbackValue: "tufte",
            modified: false,
            locked: false,
            resettable: true,
            settingsPath: "/settings/color-theme",
            display: "value",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const element = await createEditor();
    const themeRow = rowFor(element, "THEME");
    const reset = themeRow.querySelector<HTMLButtonElement>(
      ".config-editor-reset",
    );

    expect(reset).not.toBeNull();
    expect(
      rowFor(element, "CUSTOM_CSS").querySelector(".config-editor-reset"),
    ).toBeNull();
    reset?.click();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/settings/THEME");
    await vi.waitFor(() =>
      expect(rowFor(element, "THEME").textContent).toContain("tufte"),
    );
    expect(rowFor(element, "THEME").textContent).not.toContain("Modified");
    expect(
      rowFor(element, "THEME").querySelector(".config-editor-reset"),
    ).toBeNull();
  });
});
