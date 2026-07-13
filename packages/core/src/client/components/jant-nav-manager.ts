/**
 * Navigation Manager Component
 *
 * Manages nav item reordering with a live preview:
 * - Renders a preview bar that reflects current item order
 * - Sortable list with inline edit/delete panels
 * - SortableJS drag-and-drop reorder with immediate preview update
 * - Add link forms
 * - System nav item toggles with immediate list/preview update
 * - Applies server-rendered site header fragments after saved changes
 *
 * Light DOM only — BaseCoat and Tailwind classes apply directly.
 */

import { LitElement, html, nothing } from "lit";
import type { PropertyValueMap } from "lit";
import { repeat } from "lit/directives/repeat.js";
import Sortable from "sortablejs";
import type { SortableOptions } from "sortablejs";
import {
  captureSortableRevertNextSibling,
  getSortableMove,
  readSortableDataIds,
  responsiveSortableOptions,
  revertSortableDomMove,
} from "../sortable-list.js";
import { showConfirmDialog } from "../confirm.js";
import { showToast } from "../toast.js";
import { publicPath } from "../runtime-paths.js";
import { destroySiteHeaderNav, initSiteHeaderNav } from "../site-header-nav.js";
import type {
  NavManagerCollection,
  NavManagerItem,
  NavManagerLabels,
  NavManagerSuggestedLink,
  SystemNavConfig,
} from "./nav-manager-types.js";

const SITE_HEADER_REQUEST_HEADER = "X-Jant-Site-Header";
const INCLUDE_SITE_HEADER_RESPONSE = "include";

type NavManagerMutationResponse<T extends object> = T & {
  headerHtml?: string;
};

type SortableEndEvent = Parameters<NonNullable<SortableOptions["onEnd"]>>[0];

export class JantNavManager extends LitElement {
  static properties = {
    items: { type: Array },
    labels: { type: Object },
    systemNavItems: { type: Array, attribute: "system-nav-items" },
    collections: { type: Array },
    suggestedLinks: { type: Array, attribute: "suggested-links" },
    siteName: { type: String, attribute: "site-name" },

    _items: { state: true },
    _editingId: { state: true },
    _editLabel: { state: true },
    _editUrl: { state: true },
    _togglingKeys: { state: true },
    _showLinkForm: { state: true },
    _newLinkLabel: { state: true },
    _newLinkUrl: { state: true },
    _addingLink: { state: true },
    _showPreviewMore: { state: true },
    _addingCollectionId: { state: true },
    _showCollectionPicker: { state: true },
    _addingSuggestedKey: { state: true },
  };

  declare items: NavManagerItem[];
  declare labels: NavManagerLabels;
  declare systemNavItems: SystemNavConfig[];
  declare collections: NavManagerCollection[];
  declare suggestedLinks: NavManagerSuggestedLink[];
  declare siteName: string;

  declare _items: NavManagerItem[];
  declare _editingId: string | null;
  declare _editLabel: string;
  declare _editUrl: string;
  /** Keys currently mid-request (to disable switch during toggle) */
  declare _togglingKeys: Set<SystemNavConfig["key"]>;
  declare _showLinkForm: boolean;
  declare _newLinkLabel: string;
  declare _newLinkUrl: string;
  declare _addingLink: boolean;
  declare _showPreviewMore: boolean;
  /** ID of the collection currently being added (for loading state) */
  declare _addingCollectionId: string | null;
  declare _showCollectionPicker: boolean;
  /** Key of the suggested link currently being added */
  declare _addingSuggestedKey: string | null;

  #sortableHeader: { destroy(): void } | null = null;
  #sortableMore: { destroy(): void } | null = null;
  #initialized = false;
  #revertNextSibling: Node | null = null;
  #closeLinkForm = () => {
    this._showLinkForm = false;
    document.removeEventListener("click", this.#closeLinkForm);
  };
  #closeCollectionPicker = () => {
    this._showCollectionPicker = false;
    document.removeEventListener("click", this.#closeCollectionPicker);
  };
  #handlePreviewMoreDocumentClick = (event: Event) => {
    if (!(event.target instanceof Node)) return;

    const previewMore = this.querySelector<HTMLElement>("[data-preview-more]");
    if (!previewMore?.contains(event.target)) {
      this.#closePreviewMore();
    }
  };
  #handlePreviewMoreKeydown = (event: Event) => {
    if (!("key" in event) || event.key !== "Escape" || !this._showPreviewMore) {
      return;
    }
    // Defensive: nav editor has many text inputs; let IME swallow Escape
    // when the user is dismissing a CJK candidate popup.
    const ke = event as globalThis.KeyboardEvent;
    if (ke.isComposing || ke.keyCode === 229) return;

    event.preventDefault();
    this.#closePreviewMore();
    this.querySelector<HTMLElement>("[data-preview-more-trigger]")?.focus();
  };

  createRenderRoot() {
    this.innerHTML = "";
    return this;
  }

  constructor() {
    super();
    this.items = [];
    this.labels = {} as NavManagerLabels;
    this.systemNavItems = [];
    this.collections = [];
    this.suggestedLinks = [];
    this.siteName = "";

    this._items = [];
    this._editingId = null;
    this._editLabel = "";
    this._editUrl = "";
    this._togglingKeys = new Set();
    this._showLinkForm = false;
    this._newLinkLabel = "";
    this._newLinkUrl = "";
    this._addingLink = false;
    this._showPreviewMore = false;
    this._addingCollectionId = null;
    this._showCollectionPicker = false;
    this._addingSuggestedKey = null;
  }

  protected update(changedProperties: PropertyValueMap<JantNavManager>): void {
    if (!this.#initialized || changedProperties.has("items")) {
      this._items = [...(this.items ?? [])];
      this.#initialized = true;
    }
    super.update(changedProperties);
  }

  protected updated(): void {
    if (this._showPreviewMore && this.#moreItems.length === 0) {
      this.#closePreviewMore();
    }
    this.#initSortable();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#sortableHeader?.destroy();
    this.#sortableHeader = null;
    this.#sortableMore?.destroy();
    this.#sortableMore = null;
    document.removeEventListener("click", this.#closeLinkForm);
    document.removeEventListener("click", this.#closeCollectionPicker);
    this.#closePreviewMore();
  }

  #jsonMutationHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      [SITE_HEADER_REQUEST_HEADER]: INCLUDE_SITE_HEADER_RESPONSE,
    };
  }

  #deleteMutationHeaders(): Record<string, string> {
    return {
      Accept: "application/json",
      [SITE_HEADER_REQUEST_HEADER]: INCLUDE_SITE_HEADER_RESPONSE,
    };
  }

  #stripHeaderHtml<T extends object>(
    response: NavManagerMutationResponse<T>,
  ): T {
    const body = { ...response };
    delete (body as { headerHtml?: string }).headerHtml;
    return body as T;
  }

  #normalizeItem(item: NavManagerItem): NavManagerItem {
    const systemLabel =
      item.type === "system"
        ? this.systemNavItems.find((config) => config.key === item.systemKey)
            ?.label
        : undefined;
    const displayLabel =
      item.label.trim() || systemLabel || item.displayLabel || item.label;

    return { ...item, displayLabel };
  }

  #applySiteHeaderHtml(headerHtml: string | undefined) {
    if (!headerHtml) return;

    const template = document.createElement("template");
    template.innerHTML = headerHtml.trim();

    const selectors = [
      '[data-site-header-fragment="header"]',
      '[data-site-header-fragment="drawer-backdrop"]',
      '[data-site-header-fragment="drawer"]',
    ];
    let replaced = false;

    destroySiteHeaderNav(document);
    for (const selector of selectors) {
      const current = document.querySelector<HTMLElement>(selector);
      const next = template.content.querySelector<HTMLElement>(selector);
      if (!current || !next) continue;

      current.replaceWith(next);
      replaced = true;
    }

    if (replaced) {
      initSiteHeaderNav(document);
    }
  }

  // ===========================================================================
  // SortableJS
  // ===========================================================================

  #destroySortables() {
    this.#sortableHeader?.destroy();
    this.#sortableHeader = null;
    this.#sortableMore?.destroy();
    this.#sortableMore = null;
  }

  #initSortable() {
    const headerList = this.querySelector<HTMLElement>("#nav-items-header");
    const moreList = this.querySelector<HTMLElement>("#nav-items-more");

    if (headerList && !this.#sortableHeader) {
      this.#sortableHeader = Sortable.create(
        headerList,
        this.#sortableOptions(),
      );
    }
    if (moreList && !this.#sortableMore) {
      this.#sortableMore = Sortable.create(moreList, this.#sortableOptions());
    }
  }

  #sortableOptions(): SortableOptions {
    return {
      ...responsiveSortableOptions,
      animation: 150,
      handle: "[data-drag-handle]",
      draggable: "[data-nav-id]",
      group: "nav-items",
      onStart: (evt) => {
        this.#revertNextSibling = captureSortableRevertNextSibling(evt);
      },
      onEnd: (evt) => {
        void this.#handleSortableEnd(evt);
      },
    };
  }

  async #handleSortableEnd(evt: SortableEndEvent) {
    const targetList = evt.to;
    const sourceList = evt.from;
    const crossList = sourceList !== targetList;
    const targetPlacement: "header" | "more" =
      targetList.id === "nav-items-header" ? "header" : "more";
    const headerList = this.querySelector<HTMLElement>("#nav-items-header");
    const moreList = this.querySelector<HTMLElement>("#nav-items-more");
    const previousItems = this._items.map((item) => ({ ...item }));

    const movedId = evt.item?.dataset?.navId;
    if (!movedId || !headerList || !moreList) {
      this.#revertNextSibling = null;
      return;
    }

    const headerIds = readSortableDataIds(headerList, "[data-nav-id]", "navId");
    const moreIds = readSortableDataIds(moreList, "[data-nav-id]", "navId");

    if (crossList) {
      evt.item.parentNode?.removeChild(evt.item);
      if (this.#revertNextSibling) {
        sourceList.insertBefore(evt.item, this.#revertNextSibling);
      } else if (
        evt.oldIndex != null &&
        evt.oldIndex < sourceList.children.length
      ) {
        sourceList.insertBefore(
          evt.item,
          sourceList.children[evt.oldIndex] ?? null,
        );
      } else {
        sourceList.appendChild(evt.item);
      }
    } else {
      revertSortableDomMove(targetList, evt, this.#revertNextSibling);
    }

    this.#revertNextSibling = null;
    this.#destroySortables();

    const orderedIds = [...new Set([...headerIds, ...moreIds])];
    const itemMap = new Map(
      this._items.map((item) => [
        item.id,
        item.id === movedId
          ? { ...item, placement: targetPlacement }
          : { ...item },
      ]),
    );
    const reorderedItems = orderedIds
      .map((id) => itemMap.get(id))
      .filter((item): item is NavManagerItem => item !== undefined);
    const remainingItems = this._items
      .filter((item) => !orderedIds.includes(item.id))
      .map((item) =>
        item.id === movedId
          ? { ...item, placement: targetPlacement }
          : { ...item },
      );
    this._items = [...reorderedItems, ...remainingItems];

    const targetIds = targetPlacement === "header" ? headerIds : moreIds;
    const {
      movedId: persistedId,
      afterId,
      beforeId,
    } = getSortableMove(targetIds, evt.newIndex);
    if (!persistedId) return;

    try {
      if (crossList) {
        const placementRes = await fetch(`/api/nav-items/${movedId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ placement: targetPlacement }),
        });
        if (!placementRes.ok) throw new Error(`HTTP ${placementRes.status}`);
      }

      const moveRes = await fetch(`/api/nav-items/${persistedId}/move`, {
        method: "PUT",
        headers: this.#jsonMutationHeaders(),
        body: JSON.stringify({
          after: afterId ?? null,
          before: beforeId ?? null,
        }),
      });
      if (!moveRes.ok) throw new Error(`HTTP ${moveRes.status}`);

      const moved =
        (await moveRes.json()) as NavManagerMutationResponse<NavManagerItem>;
      this.#applySiteHeaderHtml(moved.headerHtml);
      showToast(
        crossList ? this.labels.placementSaved : this.labels.orderSaved,
      );
    } catch {
      this.#destroySortables();
      this._items = previousItems;
      showToast(this.labels.saveFailed, "error");
    }
  }

  // ===========================================================================
  // Inline edit handlers
  // ===========================================================================

  #toggleEdit(item: NavManagerItem) {
    if (this._editingId === item.id) {
      this._editingId = null;
    } else {
      this._editingId = item.id;
      this._editLabel = item.label;
      this._editUrl = item.url;
    }
  }

  async #handleUpdate(item: NavManagerItem) {
    const label = this._editLabel.trim();
    if (!label && item.type !== "system") {
      showToast(this.labels.labelRequired, "error");
      return;
    }

    try {
      const res = await fetch(`/api/nav-items/${item.id}`, {
        method: "PUT",
        headers: this.#jsonMutationHeaders(),
        body: JSON.stringify({
          label,
          ...(item.type === "link" && { url: this._editUrl.trim() }),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const response =
        (await res.json()) as NavManagerMutationResponse<NavManagerItem>;
      const updated = this.#normalizeItem(this.#stripHeaderHtml(response));
      this.#destroySortables();
      this._items = this._items.map((current) =>
        current.id === updated.id ? updated : current,
      );
      this._editingId = null;
      this.#applySiteHeaderHtml(response.headerHtml);
    } catch {
      showToast(this.labels.saveFailed, "error");
    }
  }

  async #handleDelete(item: NavManagerItem) {
    const message =
      item.type === "collection"
        ? this.labels.confirmDeleteCollection
        : this.labels.confirmDeleteLink;
    const confirmLabel =
      item.type === "collection" ? this.labels.remove : this.labels.delete;
    const confirmed = await showConfirmDialog({
      message,
      confirmLabel,
      cancelLabel: this.labels.cancel,
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/nav-items/${item.id}`, {
        method: "DELETE",
        headers: this.#deleteMutationHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const response = (await res.json()) as NavManagerMutationResponse<{
        success: true;
      }>;
      this.#destroySortables();
      this._items = this._items.filter((current) => current.id !== item.id);
      this._editingId = null;
      this.#applySiteHeaderHtml(response.headerHtml);
    } catch {
      showToast(this.labels.deleteFailed, "error");
    }
  }

  // ===========================================================================
  // Add link handler
  // ===========================================================================

  async #handleAddLink() {
    const label = this._newLinkLabel.trim();
    const url = this._newLinkUrl.trim();
    if (!label || !url) {
      showToast(this.labels.labelAndUrlRequired, "error");
      return;
    }

    this._addingLink = true;
    try {
      const res = await fetch("/api/nav-items", {
        method: "POST",
        headers: this.#jsonMutationHeaders(),
        body: JSON.stringify({ type: "link", label, url, placement: "header" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const response =
        (await res.json()) as NavManagerMutationResponse<NavManagerItem>;
      const created = this.#normalizeItem(this.#stripHeaderHtml(response));
      this.#destroySortables();
      this._items = [...this._items, created];
      this._newLinkLabel = "";
      this._newLinkUrl = "";
      this._showLinkForm = false;
      document.removeEventListener("click", this.#closeLinkForm);
      this.#applySiteHeaderHtml(response.headerHtml);
    } catch {
      showToast(this.labels.saveFailed, "error");
    } finally {
      this._addingLink = false;
    }
  }

  // ===========================================================================
  // Add collection handler
  // ===========================================================================

  async #handleAddCollection(collectionId: string) {
    if (!collectionId || this._addingCollectionId) return;

    this._addingCollectionId = collectionId;
    try {
      const res = await fetch("/api/nav-items", {
        method: "POST",
        headers: this.#jsonMutationHeaders(),
        body: JSON.stringify({
          type: "collection",
          collectionId,
          placement: "header",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const response =
        (await res.json()) as NavManagerMutationResponse<NavManagerItem>;
      const created = this.#normalizeItem(this.#stripHeaderHtml(response));
      this.#destroySortables();
      this._items = [...this._items, created];
      this.#closeCollectionPicker();
      this.#applySiteHeaderHtml(response.headerHtml);
    } catch {
      showToast(this.labels.saveFailed, "error");
    } finally {
      this._addingCollectionId = null;
    }
  }

  // ===========================================================================
  // Suggested link handlers
  // ===========================================================================

  #getComparableInternalPath(url: string): string | null {
    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("//") ||
      url.startsWith("mailto:") ||
      url.startsWith("tel:") ||
      url.startsWith("#")
    ) {
      return null;
    }

    try {
      const pathname = new URL(url, "https://jant.invalid").pathname;
      const normalized = pathname
        .trim()
        .toLowerCase()
        .replace(/^\/+|\/+$/g, "")
        .replace(/\/+/g, "/");
      return normalized ? `/${normalized}` : "/";
    } catch {
      return null;
    }
  }

  #isSuggestedLinkAdded(link: NavManagerSuggestedLink): boolean {
    const path = this.#getComparableInternalPath(link.url);
    const hasMatchingPath =
      path !== null &&
      this._items.some(
        (item) => this.#getComparableInternalPath(item.url) === path,
      );
    if (hasMatchingPath) return true;

    return Boolean(
      link.collectionId &&
      this._items.some(
        (item) =>
          item.type === "collection" && item.collectionId === link.collectionId,
      ),
    );
  }

  get #availableSuggestedLinks(): NavManagerSuggestedLink[] {
    return (this.suggestedLinks ?? []).filter(
      (link) => !this.#isSuggestedLinkAdded(link),
    );
  }

  async #handleAddSuggestedLink(link: NavManagerSuggestedLink) {
    if (this._addingSuggestedKey) return;

    this._addingSuggestedKey = link.key;
    try {
      const body =
        link.navItemType === "collection" && link.collectionId
          ? {
              type: "collection",
              collectionId: link.collectionId,
              placement: "header",
            }
          : {
              type: "link",
              label: link.label,
              url: link.url,
              placement: "header",
            };

      const res = await fetch("/api/nav-items", {
        method: "POST",
        headers: this.#jsonMutationHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const response =
        (await res.json()) as NavManagerMutationResponse<NavManagerItem>;
      const created = this.#normalizeItem(this.#stripHeaderHtml(response));
      this.#destroySortables();
      this._items = [...this._items, created];
      this.#applySiteHeaderHtml(response.headerHtml);
      showToast(this.labels.suggestedLinkAdded);
    } catch {
      showToast(this.labels.saveFailed, "error");
    } finally {
      this._addingSuggestedKey = null;
    }
  }

  // ===========================================================================
  // System toggle handlers
  // ===========================================================================

  #isSystemEnabled(config: SystemNavConfig): boolean {
    return this._items.some(
      (item) => item.type === "system" && item.systemKey === config.key,
    );
  }

  async #handleSystemToggle(config: SystemNavConfig, enabled: boolean) {
    this._togglingKeys = new Set([...this._togglingKeys, config.key]);

    try {
      if (enabled) {
        const res = await fetch("/api/nav-items", {
          method: "POST",
          headers: this.#jsonMutationHeaders(),
          body: JSON.stringify({
            type: "system",
            systemKey: config.key,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const response =
          (await res.json()) as NavManagerMutationResponse<NavManagerItem>;
        const created = this.#normalizeItem(this.#stripHeaderHtml(response));
        this.#destroySortables();
        this._items = [...this._items, created];
        this.#applySiteHeaderHtml(response.headerHtml);
      } else {
        const existing = this._items.find(
          (item) => item.type === "system" && item.systemKey === config.key,
        );
        if (existing) {
          const res = await fetch(`/api/nav-items/${existing.id}`, {
            method: "DELETE",
            headers: this.#deleteMutationHeaders(),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const response = (await res.json()) as NavManagerMutationResponse<{
            success: true;
          }>;
          this.#destroySortables();
          this._items = this._items.filter((item) => item.id !== existing.id);
          this.#applySiteHeaderHtml(response.headerHtml);
        }
      }
    } catch {
      showToast(this.labels.saveFailed, "error");
      this.requestUpdate();
    } finally {
      const next = new Set(this._togglingKeys);
      next.delete(config.key);
      this._togglingKeys = next;
    }
  }

  // ===========================================================================
  // Render helpers
  // ===========================================================================

  get #headerItems(): NavManagerItem[] {
    return this._items.filter((i) => (i.placement ?? "header") === "header");
  }

  get #moreItems(): NavManagerItem[] {
    return this._items.filter((i) => i.placement === "more");
  }

  #closePreviewMore() {
    this._showPreviewMore = false;
    document.removeEventListener("click", this.#handlePreviewMoreDocumentClick);
    document.removeEventListener("keydown", this.#handlePreviewMoreKeydown);
  }

  #togglePreviewMore(event: Event) {
    event.preventDefault();
    event.stopPropagation();

    if (this._showPreviewMore) {
      this.#closePreviewMore();
      return;
    }

    this._showPreviewMore = true;
    document.addEventListener("keydown", this.#handlePreviewMoreKeydown);
    setTimeout(() => {
      document.addEventListener("click", this.#handlePreviewMoreDocumentClick);
    });
  }

  #renderPreview() {
    const headerItems = this.#headerItems;
    const moreItems = this.#moreItems;

    return html`
      <div class="nav-preview">
        <div class="nav-preview-chrome">
          <div class="nav-preview-dots">
            <span></span><span></span><span></span>
          </div>
          <span class="nav-preview-label">${this.labels.preview}</span>
        </div>
        <div class="nav-preview-content">
          <div class="site-header-top">
            <a href=${publicPath("/")} class="site-logo">${this.siteName}</a>
            <nav class="site-header-nav">
              ${repeat(
                headerItems,
                (item) => item.id,
                (item, index) =>
                  html`<a
                    class=${index === 0
                      ? "site-header-link site-header-link-active"
                      : "site-header-link"}
                  >
                    ${item.displayLabel ?? item.label}
                  </a>`,
              )}
              ${moreItems.length > 0
                ? html`
                    <div class="site-header-more" data-preview-more>
                      <button
                        type="button"
                        class="site-header-more-btn"
                        data-preview-more-trigger
                        aria-haspopup="menu"
                        aria-expanded=${this._showPreviewMore
                          ? "true"
                          : "false"}
                        @click=${this.#togglePreviewMore}
                      >
                        ${this.labels.moreSection}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      <div
                        class="site-header-more-popover"
                        aria-hidden=${this._showPreviewMore ? "false" : "true"}
                        @click=${(event: Event) => event.stopPropagation()}
                      >
                        ${repeat(
                          moreItems,
                          (item) => item.id,
                          (item) => html`
                            <span class="site-header-more-link">
                              ${item.displayLabel ?? item.label}
                            </span>
                          `,
                        )}
                      </div>
                    </div>
                  `
                : nothing}
            </nav>
          </div>
        </div>
      </div>
    `;
  }

  #renderTypeBadge(type: string) {
    const label =
      type === "system"
        ? this.labels.system
        : type === "collection"
          ? this.labels.collection
          : this.labels.link;
    return html`<span class="badge-secondary">${label}</span>`;
  }

  #renderEditPanel(item: NavManagerItem) {
    if (this._editingId !== item.id) return nothing;

    if (item.type === "system") {
      return html`
        <div class="nav-item-edit">
          <div class="field">
            <label class="label">${this.labels.label}</label>
            <input
              type="text"
              class="input"
              placeholder=${item.displayLabel ?? ""}
              .value=${this._editLabel}
              @input=${(e: Event) => {
                this._editLabel = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
          <div class="flex items-center justify-between">
            <button
              type="button"
              class="btn-sm-ghost text-destructive"
              @click=${() => {
                const config = this.systemNavItems.find(
                  (c) => c.key === item.systemKey,
                );
                if (config) {
                  this._editingId = null;
                  this.#handleSystemToggle(config, false);
                }
              }}
            >
              ${this.labels.remove}
            </button>
            <button
              type="button"
              class="btn-sm"
              @click=${() => this.#handleUpdate(item)}
            >
              ${this.labels.save}
            </button>
          </div>
        </div>
      `;
    }

    if (item.type === "collection") {
      return html`
        <div class="nav-item-edit">
          <div class="field">
            <label class="label">${this.labels.label}</label>
            <input
              type="text"
              class="input"
              required
              .value=${this._editLabel}
              @input=${(e: Event) => {
                this._editLabel = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
          <div class="flex items-center justify-between">
            <button
              type="button"
              class="btn-sm-ghost text-destructive"
              @click=${() => void this.#handleDelete(item)}
            >
              ${this.labels.remove}
            </button>
            <button
              type="button"
              class="btn-sm"
              @click=${() => this.#handleUpdate(item)}
            >
              ${this.labels.save}
            </button>
          </div>
        </div>
      `;
    }

    if (item.type === "link") {
      return html`
        <div class="nav-item-edit">
          <div class="field">
            <label class="label">${this.labels.label}</label>
            <input
              type="text"
              class="input"
              required
              .value=${this._editLabel}
              @input=${(e: Event) => {
                this._editLabel = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
          <div class="field">
            <label class="label">${this.labels.url}</label>
            <input
              type="text"
              class="input"
              required
              .value=${this._editUrl}
              @input=${(e: Event) => {
                this._editUrl = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
          <div class="flex items-center justify-between">
            <button
              type="button"
              class="btn-sm-ghost text-destructive"
              @click=${() => void this.#handleDelete(item)}
            >
              ${this.labels.delete}
            </button>
            <button
              type="button"
              class="btn-sm"
              @click=${() => this.#handleUpdate(item)}
            >
              ${this.labels.save}
            </button>
          </div>
        </div>
      `;
    }

    return nothing;
  }

  #renderItem(item: NavManagerItem) {
    const isEditing = this._editingId === item.id;

    return html`
      <div
        data-nav-id=${item.id}
        class="nav-item${isEditing ? " nav-item-editing" : ""}"
      >
        <div class="nav-item-row">
          <div class="nav-item-handle" data-drag-handle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-muted-foreground shrink-0"
            >
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="5" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="15" cy="19" r="1" />
            </svg>
          </div>
          <div class="nav-item-info" @click=${() => this.#toggleEdit(item)}>
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-sm font-medium truncate"
                >${item.displayLabel ?? item.label}</span
              >
              ${this.#renderTypeBadge(item.type)}
            </div>
            <span class="text-xs text-muted-foreground truncate"
              >${item.url}</span
            >
          </div>
          <button
            type="button"
            class="nav-item-toggle"
            @click=${() => this.#toggleEdit(item)}
            aria-label=${this.labels.toggleEdit}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              style="transition: transform 0.15s; ${isEditing
                ? "transform: rotate(180deg);"
                : ""}"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
        ${this.#renderEditPanel(item)}
      </div>
    `;
  }

  #renderSuggestedLinksSection() {
    const available = this.#availableSuggestedLinks;
    if (available.length === 0) return nothing;

    return html`
      <section class="mt-8">
        <h2 class="text-lg font-semibold mb-1">
          ${this.labels.suggestedLinks}
        </h2>
        <p class="text-sm text-muted-foreground mb-3">
          ${this.labels.suggestedLinksDescription}
        </p>
        <div class="nav-suggestions-list">
          ${available.map((link) => {
            const adding = this._addingSuggestedKey === link.key;
            return html`
              <div class="nav-suggestion-item">
                <div class="nav-suggestion-info">
                  <span class="nav-suggestion-title">${link.label}</span>
                  <span class="nav-suggestion-meta">
                    ${link.url} · ${link.targetLabel}
                  </span>
                </div>
                <button
                  type="button"
                  class="btn-sm"
                  ?disabled=${adding || this._addingSuggestedKey !== null}
                  @click=${() => this.#handleAddSuggestedLink(link)}
                >
                  ${this.labels.addSuggestedLink}
                </button>
              </div>
            `;
          })}
        </div>
      </section>
    `;
  }

  #renderAddLinkSection() {
    return html`
      <section class="mt-8">
        <h2 class="text-lg font-semibold mb-3">
          ${this.labels.addCustomLinkToNavigation}
        </h2>
        <div id="nav-link-popover" class="popover">
          <button
            id="nav-link-popover-trigger"
            type="button"
            aria-expanded=${this._showLinkForm}
            aria-controls="nav-link-popover-content"
            class="btn-outline"
            @click=${(e: Event) => {
              e.stopPropagation();
              this._showLinkForm = !this._showLinkForm;
              if (this._showLinkForm) {
                setTimeout(() => {
                  document.addEventListener("click", this.#closeLinkForm);
                });
              } else {
                document.removeEventListener("click", this.#closeLinkForm);
              }
            }}
          >
            ${this.labels.addLink}
          </button>
          ${this._showLinkForm
            ? html`
                <div
                  id="nav-link-popover-content"
                  data-popover
                  data-side="top"
                  aria-hidden="false"
                  class="w-80"
                  style="bottom: 100%; margin-bottom: 0.5rem;"
                  @click=${(e: Event) => e.stopPropagation()}
                >
                  <div class="grid gap-4">
                    <header class="grid gap-1.5">
                      <h4 class="leading-none font-medium">
                        ${this.labels.addLink}
                      </h4>
                      <p class="text-muted-foreground text-sm">
                        ${this.labels.addLinkDescription}
                      </p>
                    </header>
                    <form
                      class="form grid gap-2"
                      @submit=${(e: Event) => {
                        e.preventDefault();
                        this.#handleAddLink();
                      }}
                    >
                      <div class="grid grid-cols-3 items-center gap-4">
                        <label for="nav-link-label">${this.labels.label}</label>
                        <input
                          type="text"
                          id="nav-link-label"
                          class="col-span-2 h-8"
                          placeholder="Home"
                          required
                          .value=${this._newLinkLabel}
                          @input=${(e: Event) => {
                            this._newLinkLabel = (
                              e.target as HTMLInputElement
                            ).value;
                          }}
                          autofocus
                        />
                      </div>
                      <div class="grid grid-cols-3 items-center gap-4">
                        <label for="nav-link-url">${this.labels.url}</label>
                        <input
                          type="text"
                          id="nav-link-url"
                          class="col-span-2 h-8"
                          placeholder=${this.labels.urlPlaceholder}
                          required
                          .value=${this._newLinkUrl}
                          @input=${(e: Event) => {
                            this._newLinkUrl = (
                              e.target as HTMLInputElement
                            ).value;
                          }}
                        />
                      </div>
                      <button
                        type="submit"
                        class="btn-sm mt-2"
                        ?disabled=${this._addingLink}
                      >
                        ${this.labels.addLink}
                      </button>
                    </form>
                  </div>
                </div>
              `
            : nothing}
        </div>
      </section>
    `;
  }

  #renderAddCollectionSection() {
    if (!this.collections?.length) {
      return html`
        <section class="mt-8">
          <h2 class="text-lg font-semibold mb-1">
            ${this.labels.addCollectionToNavigation}
          </h2>
          <p class="text-sm text-muted-foreground">
            ${this.labels.noCollections}
          </p>
        </section>
      `;
    }

    const addedCollectionIds = new Set(
      this._items
        .filter((i) => i.type === "collection" && i.collectionId)
        .map((i) => i.collectionId),
    );
    const available = this.collections.filter(
      (c) => !addedCollectionIds.has(c.id),
    );

    if (available.length === 0) {
      return html`
        <section class="mt-8">
          <h2 class="text-lg font-semibold mb-1">
            ${this.labels.addCollectionToNavigation}
          </h2>
          <p class="text-sm text-muted-foreground">
            ${this.labels.allCollectionsAdded}
          </p>
        </section>
      `;
    }

    // Group available collections by their directory group label
    const groups: { label: string | null; items: typeof available }[] = [];
    let currentGroup: { label: string | null; items: typeof available } | null =
      null;

    for (const c of available) {
      const groupLabel = c.group ?? null;
      if (!currentGroup || currentGroup.label !== groupLabel) {
        currentGroup = { label: groupLabel, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(c);
    }

    return html`
      <section class="mt-8">
        <h2 class="text-lg font-semibold mb-1">
          ${this.labels.addCollectionToNavigation}
        </h2>
        <p class="text-sm text-muted-foreground mb-3">
          ${this.labels.addCollectionDescription}
        </p>
        <div class="relative inline-block">
          <button
            type="button"
            aria-expanded=${this._showCollectionPicker}
            aria-haspopup="menu"
            class="btn-outline"
            @click=${(e: Event) => {
              e.stopPropagation();
              this._showCollectionPicker = !this._showCollectionPicker;
              if (this._showCollectionPicker) {
                setTimeout(() => {
                  document.addEventListener(
                    "click",
                    this.#closeCollectionPicker,
                  );
                });
              } else {
                document.removeEventListener(
                  "click",
                  this.#closeCollectionPicker,
                );
              }
            }}
          >
            ${this.labels.addCollection}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="ml-1.5 -mr-0.5"
              aria-hidden="true"
              style="transition: transform 0.15s; ${this._showCollectionPicker
                ? "transform: rotate(180deg);"
                : ""}"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          ${this._showCollectionPicker
            ? html`
                <div
                  class="collection-picker"
                  role="menu"
                  @click=${(e: Event) => e.stopPropagation()}
                >
                  ${groups.map(
                    (group) => html`
                      ${group.label
                        ? html`<div class="collection-picker-group">
                            ${group.label}
                          </div>`
                        : nothing}
                      ${group.items.map((c) => {
                        const adding = this._addingCollectionId === c.id;
                        return html`
                          <button
                            type="button"
                            role="menuitem"
                            class="collection-picker-item"
                            ?disabled=${adding ||
                            this._addingCollectionId !== null}
                            @click=${() => this.#handleAddCollection(c.id)}
                          >
                            <span class="collection-picker-title">
                              ${c.title}
                            </span>
                            ${adding
                              ? html`<svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  class="animate-spin shrink-0 text-muted-foreground"
                                >
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>`
                              : nothing}
                          </button>
                        `;
                      })}
                    `,
                  )}
                </div>
              `
            : nothing}
        </div>
      </section>
    `;
  }

  #renderSystemToggles() {
    if (!this.systemNavItems?.length) return nothing;

    return html`
      <section class="mt-8">
        <h2 class="text-lg font-semibold mb-1">${this.labels.systemLinks}</h2>
        <p class="text-sm text-muted-foreground mb-3">
          ${this.labels.systemLinksDescription}
        </p>
        <div class="flex flex-col divide-y">
          ${this.systemNavItems.map((config) => {
            const enabled = this.#isSystemEnabled(config);
            const toggling = this._togglingKeys.has(config.key);
            const rowClass = toggling
              ? "flex items-center justify-between gap-4 py-3 opacity-60 cursor-not-allowed"
              : "flex items-center justify-between gap-4 py-3 cursor-pointer";
            return html`
              <label class=${rowClass}>
                <div>
                  <p class="font-medium">${config.label}</p>
                  <p class="text-sm text-muted-foreground">
                    ${config.description}
                  </p>
                </div>
                <input
                  type="checkbox"
                  role="switch"
                  class="input"
                  .checked=${enabled}
                  ?disabled=${toggling}
                  @change=${(e: Event) => {
                    const checked = (e.target as HTMLInputElement).checked;
                    this.#handleSystemToggle(config, checked);
                  }}
                />
              </label>
            `;
          })}
        </div>
      </section>
    `;
  }

  render() {
    return html`
      ${this.#renderPreview()}

      <section class="mt-8">
        <h2 class="text-lg font-semibold mb-3">${this.labels.headerSection}</h2>
        ${this.#headerItems.length === 0
          ? html`<p class="text-sm text-muted-foreground py-4">
              ${this.labels.emptyState}
            </p>`
          : nothing}
        <div id="nav-items-header" class="nav-items-list">
          ${repeat(
            this.#headerItems,
            (item) => item.id,
            (item) => this.#renderItem(item),
          )}
        </div>
      </section>

      <section class="mt-8">
        <h2 class="text-lg font-semibold mb-3">${this.labels.moreSection}</h2>
        <div id="nav-items-more" class="nav-items-list nav-items-list-drop">
          ${this.#moreItems.length > 0
            ? repeat(
                this.#moreItems,
                (item) => item.id,
                (item) => this.#renderItem(item),
              )
            : html`<p class="nav-items-empty-hint">
                ${this.labels.moreEmptyHint}
              </p>`}
        </div>
      </section>

      ${this.#renderSuggestedLinksSection()} ${this.#renderAddLinkSection()}
      ${this.#renderAddCollectionSection()} ${this.#renderSystemToggles()}
    `;
  }
}

customElements.define("jant-nav-manager", JantNavManager);
