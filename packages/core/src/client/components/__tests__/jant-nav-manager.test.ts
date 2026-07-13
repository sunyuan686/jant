// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

const { sortableCreateMock, sortableDestroyMock } = vi.hoisted(() => ({
  sortableCreateMock: vi.fn(),
  sortableDestroyMock: vi.fn(),
}));

vi.mock("sortablejs", () => ({
  default: {
    create: sortableCreateMock.mockImplementation(() => ({
      destroy: sortableDestroyMock,
    })),
  },
}));

import type {
  NavManagerItem,
  NavManagerLabels,
  NavManagerSuggestedLink,
} from "../nav-manager-types.js";
import "../jant-nav-manager.js";
import type { JantNavManager } from "../jant-nav-manager.js";

const labels: NavManagerLabels = {
  preview: "Preview",
  navigationItems: "Navigation items",
  emptyState: "Add a link to get started.",
  link: "Link",
  system: "System",
  toggleEdit: "Toggle edit",
  label: "Label",
  url: "URL",
  save: "Save",
  delete: "Delete",
  remove: "Remove",
  confirmDeleteLink: "Delete this navigation link?",
  orderSaved: "Navigation order updated.",
  labelRequired: "Add a label.",
  saveFailed: "Save failed.",
  deleteFailed: "Delete failed.",
  systemLinks: "System links",
  systemLinksDescription: "Built-in links.",
  addCustomLinkToNavigation: "Add a custom link",
  addLink: "Add link",
  addLinkDescription: "Add a custom nav link.",
  urlPlaceholder: "/about",
  labelAndUrlRequired: "Add a label and URL.",
  suggestedLinks: "Suggested links",
  suggestedLinksDescription: "Add common destinations.",
  addSuggestedLink: "Add",
  suggestedLinkAdded: "Link added to navigation.",
  headerSection: "Header",
  moreSection: "More",
  moreEmptyHint: "Move links here to hide them under More.",
  placementSaved: "Navigation placement updated.",
  cancel: "Cancel",
  collection: "collection",
  addCollection: "Add Collection",
  addCollectionToNavigation: "Add collection to navigation",
  addCollectionDescription:
    "Pin a collection to your navigation bar. An asterisk (*) appears next to collections updated in the last 48 hours.",
  allCollectionsAdded: "All collections are already in your navigation.",
  noCollections:
    "No collections yet. Create one first, then add it to your navigation.",
  confirmDeleteCollection:
    "Remove this collection from navigation? The collection itself won't be deleted.",
};

const items: NavManagerItem[] = [
  {
    id: "nav-1",
    type: "link",
    label: "About",
    url: "/about",
    placement: "header",
  },
  {
    id: "nav-2",
    type: "link",
    label: "Links",
    url: "/links",
    placement: "header",
  },
  {
    id: "nav-3",
    type: "link",
    label: "Archive",
    url: "/archive",
    placement: "more",
  },
];

const suggestedLinks: NavManagerSuggestedLink[] = [
  {
    key: "now",
    label: "Now",
    url: "/now",
    targetType: "collection",
    targetLabel: "Collection",
    navItemType: "collection",
    collectionId: "col_now",
  },
];

function renderHeaderFragment(label: string): string {
  return `
    <header class="site-header" data-site-header-fragment="header">
      <div class="site-header-inner">
        <div class="site-header-top">
          <a href="/" class="site-logo">Test Site</a>
          <nav class="site-header-nav" aria-label="Primary">
            <a href="/now" class="site-header-link">${label}</a>
          </nav>
          <button
            type="button"
            class="site-header-hamburger"
            aria-controls="site-nav-drawer"
            aria-expanded="false"
          ></button>
        </div>
      </div>
    </header>
    <div
      class="site-nav-drawer-backdrop"
      data-site-header-fragment="drawer-backdrop"
      aria-hidden="true"
    ></div>
    <div
      id="site-nav-drawer"
      class="site-nav-drawer"
      data-site-header-fragment="drawer"
      aria-hidden="true"
      inert
    >
      <button class="site-nav-drawer-close" type="button"></button>
      <a href="/now" class="site-nav-drawer-link">${label}</a>
    </div>
  `;
}

function installCurrentHeaderFragment(label = "Old"): void {
  document.body.insertAdjacentHTML("afterbegin", renderHeaderFragment(label));
}

function requireElement<T>(value: T | null, message: string): T {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

function getListIds(list: HTMLElement): string[] {
  return Array.from(list.querySelectorAll<HTMLElement>("[data-nav-id]")).map(
    (item) => item.dataset.navId ?? "",
  );
}

function getPreviewHeaderLabels(el: HTMLElement): string[] {
  return Array.from(
    el.querySelectorAll<HTMLElement>(
      ".nav-preview .site-header-nav > .site-header-link",
    ),
  ).map((item) => item.textContent?.trim() ?? "");
}

function getPreviewMoreLabels(el: HTMLElement): string[] {
  return Array.from(
    el.querySelectorAll<HTMLElement>(
      ".nav-preview .site-header-more-popover .site-header-more-link",
    ),
  ).map((item) => item.textContent?.trim() ?? "");
}

function getSortableOptions(
  listId: string,
): Record<string, ((event: unknown) => void) | undefined> {
  const call = sortableCreateMock.mock.calls.find(
    ([el]) => (el as HTMLElement).id === listId,
  );
  if (!call) {
    throw new Error(`Expected Sortable to be created for ${listId}`);
  }

  const [, options] = call;
  return options as Record<string, ((event: unknown) => void) | undefined>;
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function createElement(): Promise<JantNavManager> {
  const el = document.createElement("jant-nav-manager") as JantNavManager;
  el.labels = labels;
  el.items = items;
  el.systemNavItems = [];
  el.suggestedLinks = [];
  el.siteName = "Test Site";
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe("JantNavManager", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    sortableCreateMock.mockClear();
    sortableDestroyMock.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ...items[1] }),
      }),
    );
  });

  it("reconciles a cross-list drag after Sortable mutates the DOM", async () => {
    const el = await createElement();
    const headerList = requireElement(
      el.querySelector<HTMLElement>("#nav-items-header"),
      "expected header nav list",
    );
    const moreList = requireElement(
      el.querySelector<HTMLElement>("#nav-items-more"),
      "expected more nav list",
    );
    const movedItem = requireElement(
      headerList.querySelector<HTMLElement>('[data-nav-id="nav-2"]'),
      "expected moved nav item",
    );
    const headerSortable = getSortableOptions("nav-items-header");

    headerSortable.onStart?.({
      from: headerList,
      to: headerList,
      item: movedItem,
      oldIndex: 1,
      newIndex: 1,
    });

    moreList.insertBefore(movedItem, moreList.firstChild);

    headerSortable.onEnd?.({
      from: headerList,
      to: moreList,
      item: movedItem,
      oldIndex: 1,
      newIndex: 0,
    });

    await el.updateComplete;
    await flushAsyncWork();

    expect(getListIds(headerList)).toEqual(["nav-1"]);
    expect(getListIds(moreList)).toEqual(["nav-2", "nav-3"]);
    expect(getPreviewHeaderLabels(el)).toEqual(["About"]);
    expect(getPreviewMoreLabels(el)).toEqual(["Links", "Archive"]);
    expect(
      Array.from(el.querySelectorAll<HTMLElement>("[data-nav-id]")).map(
        (item) => item.dataset.navId,
      ),
    ).toEqual(["nav-1", "nav-2", "nav-3"]);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/nav-items/nav-2",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ placement: "more" }),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/nav-items/nav-2/move",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          "X-Jant-Site-Header": "include",
        }),
        body: JSON.stringify({
          after: null,
          before: "nav-3",
        }),
      }),
    );
  });

  it("opens and dismisses the preview More popover", async () => {
    const el = await createElement();
    const trigger = requireElement(
      el.querySelector<HTMLElement>("[data-preview-more-trigger]"),
      "expected preview more trigger",
    );
    const popover = requireElement(
      el.querySelector<HTMLElement>(".nav-preview .site-header-more-popover"),
      "expected preview more popover",
    );

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(popover.getAttribute("aria-hidden")).toBe("true");

    trigger.click();
    await el.updateComplete;

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(popover.getAttribute("aria-hidden")).toBe("false");
    expect(getPreviewMoreLabels(el)).toEqual(["Archive"]);

    const escapeEvent = new Event("keydown");
    Object.defineProperty(escapeEvent, "key", { value: "Escape" });
    document.dispatchEvent(escapeEvent);
    await el.updateComplete;

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(popover.getAttribute("aria-hidden")).toBe("true");
  });

  it("adds a suggested collection link through the nav items API", async () => {
    const el = await createElement();
    el.suggestedLinks = suggestedLinks;
    el.requestUpdate();
    await el.updateComplete;

    const addButton = requireElement(
      el.querySelector<HTMLButtonElement>(".nav-suggestion-item button"),
      "expected suggested link add button",
    );
    expect(el.textContent).toContain("Now");
    expect(el.textContent).toContain("/now · Collection");

    const created: NavManagerItem = {
      id: "nav-now",
      type: "collection",
      collectionId: "col_now",
      label: "Now",
      url: "/now",
      placement: "header",
    };
    installCurrentHeaderFragment("Old");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        ...created,
        headerHtml: renderHeaderFragment("Now"),
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    addButton.click();
    await flushAsyncWork();
    await el.updateComplete;

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/nav-items",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Jant-Site-Header": "include",
        }),
        body: JSON.stringify({
          type: "collection",
          collectionId: "col_now",
          placement: "header",
        }),
      }),
    );
    expect(
      getListIds(
        requireElement(
          el.querySelector<HTMLElement>("#nav-items-header"),
          "expected header nav list",
        ),
      ),
    ).toContain("nav-now");
    expect(el.querySelector(".nav-suggestion-item")).toBeNull();
    expect(
      document
        .querySelector<HTMLElement>('[data-site-header-fragment="header"]')
        ?.textContent?.trim(),
    ).toContain("Now");
  });

  it("confirms before deleting a navigation item", async () => {
    const el = await createElement();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        headerHtml: renderHeaderFragment("Links"),
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    installCurrentHeaderFragment("About");

    (
      el as unknown as { _editingId: string | null; requestUpdate: () => void }
    )._editingId = "nav-1";
    el.requestUpdate();
    await el.updateComplete;

    const deleteButton = requireElement(
      el.querySelector<HTMLButtonElement>(".nav-item-edit .btn-sm-ghost"),
      "expected nav delete button",
    );
    deleteButton.click();
    await flushAsyncWork();

    const host = requireElement(
      document.querySelector<HTMLElement>("jant-confirm-dialog"),
      "expected shared confirm dialog host",
    );
    const confirmButton = requireElement(
      host.querySelector<HTMLButtonElement>(
        ".confirm-dialog-actions .btn-destructive",
      ),
      "expected confirm button",
    );
    confirmButton.click();
    await flushAsyncWork();
    await el.updateComplete;

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/nav-items/nav-1",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          "X-Jant-Site-Header": "include",
        }),
      }),
    );
    expect(
      getListIds(
        requireElement(
          el.querySelector<HTMLElement>("#nav-items-header"),
          "expected header nav list",
        ),
      ),
    ).toEqual(["nav-2"]);
    expect(
      document
        .querySelector<HTMLElement>('[data-site-header-fragment="header"]')
        ?.textContent?.trim(),
    ).toContain("Links");
  });

  it("does not delete when confirmation is canceled", async () => {
    const el = await createElement();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    (
      el as unknown as { _editingId: string | null; requestUpdate: () => void }
    )._editingId = "nav-1";
    el.requestUpdate();
    await el.updateComplete;

    const deleteButton = requireElement(
      el.querySelector<HTMLButtonElement>(".nav-item-edit .btn-sm-ghost"),
      "expected nav delete button",
    );
    deleteButton.click();
    await flushAsyncWork();

    const host = requireElement(
      document.querySelector<HTMLElement>("jant-confirm-dialog"),
      "expected shared confirm dialog host",
    );
    const cancelButton = requireElement(
      host.querySelector<HTMLButtonElement>(
        ".confirm-dialog-actions .btn-outline",
      ),
      "expected cancel button",
    );
    cancelButton.click();
    await flushAsyncWork();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
