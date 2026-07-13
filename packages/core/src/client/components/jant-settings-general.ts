/**
 * General Settings Component
 *
 * Main container for the General settings page. Saveable groups track dirty
 * state independently, while checkbox-only sections save immediately.
 *
 * Light DOM only — BaseCoat and Tailwind classes apply directly.
 */

import { LitElement, html, nothing } from "lit";
import type { Editor } from "@tiptap/core";
import { MAX_SITE_NAME_LENGTH } from "../../types.js";
import {
  getSupportedLocaleEntries,
  getOrBuildEntry,
  type LocaleEntry,
} from "../../i18n/supported-locales.js";
import type {
  SettingsInitialData,
  SettingsLabels,
  SettingsTimezone,
  SettingsCjkFont,
  SettingsDashboardLanguage,
  SettingsAboutPageStatus,
} from "./settings-types.js";
import { showToast } from "../toast.js";
import {
  createSettingsEditor,
  jsonToMarkdown,
} from "../tiptap/create-editor.js";

export class JantSettingsGeneral extends LitElement {
  static properties = {
    labels: { type: Object },
    timezones: { type: Array },
    cjkFonts: { type: Array, attribute: "cjk-fonts" },
    siteNameFallback: { type: String, attribute: "sitename-fallback" },
    siteDescriptionFallback: {
      type: String,
      attribute: "sitedescription-fallback",
    },
    dashboardLanguages: { type: Array, attribute: "dashboard-languages" },
    demoMode: { type: Boolean, attribute: "demo-mode" },
    mainFeedUrl: { type: String, attribute: "main-feed-url" },
    latestFeedUrl: { type: String, attribute: "latest-feed-url" },
    featuredFeedUrl: { type: String, attribute: "featured-feed-url" },
    archiveFeedUrl: { type: String, attribute: "archive-feed-url" },
    aboutPage: { type: Object, attribute: "about-page" },
    aboutEditUrl: { type: String, attribute: "about-edit-url" },
    aboutCreateUrl: {
      type: String,
      attribute: "about-create-url",
    },

    // Site group
    _siteName: { state: true },
    _siteDescription: { state: true },
    _siteFooter: { state: true },
    _origSite: { state: true },
    _siteDirty: { state: true },
    _siteLoading: { state: true },

    // Language, CJK & time group
    _siteLanguage: { state: true },
    _dashboardLanguage: { state: true },
    _localeOpen: { state: true },
    _localeQuery: { state: true },
    _cjkSerifFont: { state: true },
    _timeZone: { state: true },
    _origLocale: { state: true },
    _localeDirty: { state: true },
    _localeLoading: { state: true },

    // Feed group
    _mainRssFeed: { state: true },
    _origMainRssFeed: { state: true },
    _feedDirty: { state: true },
    _feedLoading: { state: true },

    // Home auto-save
    _showJantBrandingOnHome: { state: true },
    _origShowJantBrandingOnHome: { state: true },
    _homeLoading: { state: true },

    // Search auto-save
    _noindex: { state: true },
    _origNoindex: { state: true },
    _searchLoading: { state: true },
  };

  declare labels: SettingsLabels;
  declare timezones: SettingsTimezone[];
  declare cjkFonts: SettingsCjkFont[];
  declare dashboardLanguages: SettingsDashboardLanguage[];
  declare siteNameFallback: string;
  declare siteDescriptionFallback: string;
  declare demoMode: boolean;
  declare mainFeedUrl: string;
  declare latestFeedUrl: string;
  declare featuredFeedUrl: string;
  declare archiveFeedUrl: string;
  declare aboutPage: SettingsAboutPageStatus;
  declare aboutEditUrl: string;
  declare aboutCreateUrl: string;

  // Site
  declare _siteName: string;
  declare _siteDescription: string;
  declare _siteFooter: string;
  declare _origSite: {
    siteName: string;
    siteDescription: string;
    siteFooter: string;
  };
  declare _siteDirty: boolean;
  declare _siteLoading: boolean;

  // Language, CJK & time
  declare _siteLanguage: string;
  /** Admin dashboard UI locale (one of the translated catalog locales). */
  declare _dashboardLanguage: string;
  /** Whether the locale combobox dropdown is currently open. */
  declare _localeOpen: boolean;
  /** Search query inside the locale combobox. */
  declare _localeQuery: string;
  declare _cjkSerifFont: string;
  declare _timeZone: string;
  declare _origLocale: {
    siteLanguage: string;
    dashboardLanguage: string;
    cjkSerifFont: string;
    timeZone: string;
  };
  declare _localeDirty: boolean;
  declare _localeLoading: boolean;

  // Feed
  declare _mainRssFeed: string;
  declare _origMainRssFeed: string;
  declare _feedDirty: boolean;
  declare _feedLoading: boolean;

  // Home
  declare _showJantBrandingOnHome: boolean;
  declare _origShowJantBrandingOnHome: boolean;
  declare _homeLoading: boolean;

  // Search
  declare _noindex: boolean;
  declare _origNoindex: boolean;
  declare _searchLoading: boolean;

  // TipTap editor instances
  private _descEditor: Editor | null = null;
  private _footerEditor: Editor | null = null;

  createRenderRoot() {
    this.innerHTML = "";
    return this;
  }

  constructor() {
    super();
    this.labels = {} as SettingsLabels;
    this.timezones = [];
    this.cjkFonts = [];
    this.dashboardLanguages = [];
    this.siteNameFallback = "";
    this.siteDescriptionFallback = "";
    this.demoMode = false;
    this.mainFeedUrl = "/feed";
    this.latestFeedUrl = "/latest/feed";
    this.featuredFeedUrl = "/featured/feed";
    this.archiveFeedUrl = "/archive/feed";
    this.aboutPage = {
      state: "missing",
      path: "/about",
    };
    this.aboutEditUrl = "/about?edit=1";
    this.aboutCreateUrl = "/settings/general/about-page";

    this._siteName = "";
    this._siteDescription = "";
    this._siteFooter = "";
    this._origSite = {
      siteName: "",
      siteDescription: "",
      siteFooter: "",
    };
    this._siteDirty = false;
    this._siteLoading = false;

    this._siteLanguage = "en";
    this._dashboardLanguage = "en";
    this._localeOpen = false;
    this._localeQuery = "";
    this._cjkSerifFont = "off";
    this._timeZone = "UTC";
    this._origLocale = {
      siteLanguage: "en",
      dashboardLanguage: "en",
      cjkSerifFont: "off",
      timeZone: "UTC",
    };

    this._localeDirty = false;
    this._localeLoading = false;

    this._mainRssFeed = "featured";
    this._origMainRssFeed = "featured";
    this._feedDirty = false;
    this._feedLoading = false;

    this._noindex = false;
    this._origNoindex = false;
    this._showJantBrandingOnHome = false;
    this._origShowJantBrandingOnHome = false;
    this._homeLoading = false;
    this._searchLoading = false;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this._onLocalePickerDocumentClick);
    document.addEventListener("keydown", this._onLocalePickerKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("click", this._onLocalePickerDocumentClick);
    document.removeEventListener("keydown", this._onLocalePickerKeydown);
    this._descEditor?.destroy();
    this._descEditor = null;
    this._footerEditor?.destroy();
    this._footerEditor = null;
  }

  /** Initialize form state from data attributes set by the bridge */
  initData(data: SettingsInitialData) {
    this._siteName = data.siteName;
    this._siteDescription = data.siteDescription;
    this._siteFooter = data.siteFooter;

    this._siteLanguage = data.siteLanguage;
    this._dashboardLanguage = data.dashboardLanguage;
    this._cjkSerifFont = data.cjkSerifFont;
    this._timeZone = data.timeZone;
    this._origLocale = {
      siteLanguage: data.siteLanguage,
      dashboardLanguage: data.dashboardLanguage,
      cjkSerifFont: data.cjkSerifFont,
      timeZone: data.timeZone,
    };

    this._mainRssFeed = data.mainRssFeed;
    this._origMainRssFeed = data.mainRssFeed;

    this._showJantBrandingOnHome = data.showJantBrandingOnHome;
    this._origShowJantBrandingOnHome = data.showJantBrandingOnHome;

    this._noindex = data.noindex;
    this._origNoindex = data.noindex;

    // Defer editor init to after Lit renders the containers
    this.updateComplete.then(() => {
      this._initEditors();
      // Normalize origSite after editors round-trip the markdown
      this._origSite = {
        siteName: data.siteName,
        siteDescription: this._siteDescription,
        siteFooter: this._siteFooter,
      };
    });
  }

  /** Called by bridge after a section save succeeds */
  sectionSaved(section: string) {
    if (section === "site") {
      this._origSite = {
        siteName: this._siteName,
        siteDescription: this._siteDescription,
        siteFooter: this._siteFooter,
      };
      this._siteDirty = false;
      this._siteLoading = false;
    } else if (section === "language-time") {
      this._origLocale = {
        siteLanguage: this._siteLanguage,
        dashboardLanguage: this._dashboardLanguage,
        cjkSerifFont: this._cjkSerifFont,
        timeZone: this._timeZone,
      };
      this._localeDirty = false;
      this._localeLoading = false;
    } else if (section === "feeds") {
      this._origMainRssFeed = this._mainRssFeed;
      this._feedDirty = false;
      this._feedLoading = false;
    } else if (section === "home") {
      this._origShowJantBrandingOnHome = this._showJantBrandingOnHome;
      this._homeLoading = false;
    } else if (section === "search") {
      this._origNoindex = this._noindex;
      this._searchLoading = false;
    }
  }

  /** Called by bridge on save error */
  sectionError(section: string) {
    if (section === "site") {
      this._siteLoading = false;
    } else if (section === "language-time") {
      this._localeLoading = false;
    } else if (section === "feeds") {
      this._feedLoading = false;
    } else if (section === "home") {
      this._showJantBrandingOnHome = this._origShowJantBrandingOnHome;
      this._homeLoading = false;
    } else if (section === "search") {
      this._noindex = this._origNoindex;
      this._searchLoading = false;
    }
  }

  // ── TipTap editor helpers ──────────────────────────────────────────

  private _initEditors() {
    this._initDescEditor();
    this._initFooterEditor();
  }

  private _initDescEditor() {
    const container = this.querySelector<HTMLElement>(
      "[data-settings-desc-editor]",
    );
    if (!container || this._descEditor) return;

    this._descEditor = createSettingsEditor({
      element: container,
      placeholder: this.siteDescriptionFallback,
      content: this._siteDescription || undefined,
      onUpdate: (markdown) => {
        this._siteDescription = markdown;
        this._syncSiteDirty();
      },
    });

    // Normalize initial markdown through the editor round-trip
    this._siteDescription = jsonToMarkdown(this._descEditor.getJSON());

    const pm = container.querySelector<HTMLElement>(".ProseMirror");
    if (pm) {
      pm.style.outline = "none";
      pm.style.minHeight = "3rem";
    }
  }

  private _initFooterEditor() {
    const container = this.querySelector<HTMLElement>(
      "[data-settings-footer-editor]",
    );
    if (!container || this._footerEditor) return;

    this._footerEditor = createSettingsEditor({
      element: container,
      content: this._siteFooter || undefined,
      onUpdate: (markdown) => {
        this._siteFooter = markdown;
        this._syncSiteDirty();
      },
    });

    // Normalize initial markdown through the editor round-trip
    this._siteFooter = jsonToMarkdown(this._footerEditor.getJSON());

    const pm = container.querySelector<HTMLElement>(".ProseMirror");
    if (pm) {
      pm.style.outline = "none";
      pm.style.minHeight = "6rem";
    }
  }

  // ── Site group helpers ────────────────────────────────────────────

  private _syncSiteDirty() {
    this._siteDirty =
      this._siteName !== this._origSite.siteName ||
      this._siteDescription !== this._origSite.siteDescription ||
      this._siteFooter !== this._origSite.siteFooter;
  }

  private _saveSite() {
    if (this._siteLoading || !this._siteDirty) return;
    this._siteLoading = true;
    this.dispatchEvent(
      new CustomEvent("jant:settings-save", {
        bubbles: true,
        detail: {
          endpoint: "/settings/general",
          data: {
            siteName: this._siteName,
            siteDescription: this._siteDescription,
            siteFooter: this._siteFooter,
          },
          section: "site",
        },
      }),
    );
  }

  // ── Language & time group helpers ────────────────────────────────

  private _syncLocaleDirty() {
    this._localeDirty =
      this._siteLanguage !== this._origLocale.siteLanguage ||
      this._dashboardLanguage !== this._origLocale.dashboardLanguage ||
      this._cjkSerifFont !== this._origLocale.cjkSerifFont ||
      this._timeZone !== this._origLocale.timeZone;
  }

  private _saveLocale() {
    if (this._localeLoading || !this._localeDirty) return;
    this._localeLoading = true;
    this.dispatchEvent(
      new CustomEvent("jant:settings-save", {
        bubbles: true,
        detail: {
          endpoint: "/settings/general/language-time",
          data: {
            siteLanguage: this._siteLanguage,
            dashboardLanguage: this._dashboardLanguage,
            cjkSerifFont: this._cjkSerifFont,
            timeZone: this._timeZone,
          },
          section: "language-time",
        },
      }),
    );
  }

  // ── Locale combobox ────────────────────────────────────────────────

  private _filteredLocaleEntries(): LocaleEntry[] {
    const all = getSupportedLocaleEntries();
    const query = this._localeQuery.trim().toLowerCase();
    if (!query) return all;
    return all.filter(
      (e) =>
        e.tag.toLowerCase().includes(query) ||
        e.native.toLowerCase().includes(query) ||
        e.english.toLowerCase().includes(query),
    );
  }

  private _toggleLocalePicker = () => {
    this._localeOpen = !this._localeOpen;
    if (!this._localeOpen) {
      this._localeQuery = "";
    } else {
      // Focus the search input on next paint.
      this.updateComplete.then(() => {
        const input = this.querySelector<HTMLInputElement>(
          "[data-locale-search]",
        );
        input?.focus();
      });
    }
  };

  private _selectLocale(tag: string) {
    this._siteLanguage = tag;
    this._localeOpen = false;
    this._localeQuery = "";
    this._syncLocaleDirty();
  }

  private _onLocalePickerDocumentClick = (e: Event) => {
    if (!this._localeOpen) return;
    const target = e.target as Node | null;
    const picker = this.querySelector("[data-locale-picker]");
    if (picker && target && !picker.contains(target)) {
      this._localeOpen = false;
    }
  };

  private _onLocalePickerKeydown = (e: KeyboardEvent) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === "Escape" && this._localeOpen) {
      this._localeOpen = false;
      this._localeQuery = "";
    }
  };

  private _renderLanguagePicker() {
    const current = getOrBuildEntry(this._siteLanguage || "en");
    const filtered = this._filteredLocaleEntries();
    const searchPlaceholder =
      this.labels.siteLanguageSearchPlaceholder || "Search…";
    const noMatches = this.labels.siteLanguageNoMatches || "No matches.";

    return html`
      <div class="relative w-fit max-w-full" data-locale-picker>
        <button
          type="button"
          class="flex h-9 w-full cursor-pointer items-center rounded-md border border-input bg-transparent bg-[image:var(--chevron-down-icon-50)] bg-position-[center_right_0.75rem] bg-size-[1rem] bg-no-repeat py-2 pl-3 pr-9 text-left text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
          aria-expanded=${this._localeOpen ? "true" : "false"}
          aria-haspopup="listbox"
          aria-labelledby="site-language-label"
          @click=${this._toggleLocalePicker}
        >
          <span class="min-w-0 truncate">${current.native}</span>
        </button>

        ${this._localeOpen
          ? html`
              <div
                class="absolute left-0 top-full z-10 mt-1 w-80 min-w-full max-w-[calc(100vw-2rem)] max-h-72 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
              >
                <div class="border-b p-2">
                  <input
                    type="text"
                    class="input w-full"
                    data-locale-search
                    placeholder=${searchPlaceholder}
                    autocomplete="off"
                    spellcheck="false"
                    .value=${this._localeQuery}
                    @input=${(e: Event) => {
                      this._localeQuery = (e.target as HTMLInputElement).value;
                    }}
                  />
                </div>
                <div role="listbox" class="max-h-56 overflow-auto py-1">
                  ${filtered.length === 0
                    ? html`
                        <div class="px-3 py-2 text-sm text-muted-foreground">
                          ${noMatches}
                        </div>
                      `
                    : filtered.map(
                        (entry) => html`
                          <button
                            type="button"
                            role="option"
                            aria-selected=${entry.tag === this._siteLanguage
                              ? "true"
                              : "false"}
                            class=${[
                              "flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent",
                              entry.tag === this._siteLanguage
                                ? "bg-accent/60"
                                : "",
                            ].join(" ")}
                            @click=${() => this._selectLocale(entry.tag)}
                          >
                            <span>${entry.native}</span>
                            <span class="text-xs text-muted-foreground">
                              ${entry.english}
                            </span>
                          </button>
                        `,
                      )}
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  // ── Feed group helpers ────────────────────────────────────────────

  private _syncFeedDirty() {
    this._feedDirty = this._mainRssFeed !== this._origMainRssFeed;
  }

  private _saveFeeds() {
    if (this._feedLoading || !this._feedDirty) return;
    this._feedLoading = true;
    this.dispatchEvent(
      new CustomEvent("jant:settings-save", {
        bubbles: true,
        detail: {
          endpoint: "/settings/general/feeds",
          data: {
            mainRssFeed: this._mainRssFeed,
          },
          section: "feeds",
        },
      }),
    );
  }

  // ── Home auto-save helpers ────────────────────────────────────────

  private _saveHomeToggle(nextValue: boolean) {
    if (this._homeLoading) return;
    this._showJantBrandingOnHome = nextValue;
    this._homeLoading = true;
    this.dispatchEvent(
      new CustomEvent("jant:settings-save", {
        bubbles: true,
        detail: {
          endpoint: "/settings/general/home",
          data: {
            showJantBrandingOnHome: nextValue,
          },
          section: "home",
        },
      }),
    );
  }

  // ── Search auto-save helpers ──────────────────────────────────────

  private _saveSearchToggle(nextAllowIndexing: boolean) {
    if (this.demoMode || this._searchLoading) return;
    this._noindex = !nextAllowIndexing;
    this._searchLoading = true;
    this.dispatchEvent(
      new CustomEvent("jant:settings-save", {
        bubbles: true,
        detail: {
          endpoint: "/settings/general/search",
          data: {
            allowIndexing: nextAllowIndexing,
          },
          section: "search",
        },
      }),
    );
  }

  /** Submit on Enter from non-textarea fields */
  private _onKeydown(
    e: globalThis.KeyboardEvent,
    save: () => void,
    dirty: boolean,
    loading: boolean,
  ) {
    // Pressing Enter to commit an IME candidate must not also submit the form.
    if (e.isComposing || e.keyCode === 229) return;
    if (
      e.key === "Enter" &&
      !loading &&
      dirty &&
      !(e.target instanceof HTMLTextAreaElement)
    ) {
      e.preventDefault();
      save();
    }
  }

  // ── Render helpers ────────────────────────────────────────────────

  private _renderSaveAction(
    loading: boolean,
    dirty: boolean,
    onSave: () => void,
  ) {
    return html`
      <div class="flex mt-4">
        <button
          type="button"
          class="btn"
          ?disabled=${loading || !dirty}
          @click=${onSave}
        >
          ${loading
            ? html`<svg
                class="animate-spin size-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                role="status"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>`
            : nothing}
          ${this.labels.save}
        </button>
      </div>
    `;
  }

  private _renderSectionTitle(title: string) {
    return html`<h3 class="text-sm font-semibold tracking-[0.01em]">
      ${title}
    </h3>`;
  }

  private _renderMainRssFeedOption(
    value: string,
    title: string,
    description: string,
  ) {
    const checked = this._mainRssFeed === value;
    return html`
      <label
        class=${`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
          checked ? "border-primary" : "border-border"
        }`}
      >
        <input
          type="radio"
          name="main-rss-feed"
          value=${value}
          class="mt-1"
          .checked=${checked}
          @change=${() => {
            this._mainRssFeed = value;
            this._syncFeedDirty();
          }}
        />
        <div>
          <div class="font-medium">${title}</div>
          <div class="text-sm text-muted-foreground">${description}</div>
        </div>
      </label>
    `;
  }

  private async _copyFeedUrl(value: string) {
    try {
      if (!globalThis.navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }

      await globalThis.navigator.clipboard.writeText(value);
      showToast(this.labels.feedUrlCopied);
    } catch {
      showToast(this.labels.copyFailed, "error");
    }
  }

  private _renderFeedInfoRow(
    label: string,
    value: string,
    description?: string,
  ) {
    return html`
      <div class="flex min-w-0 flex-col gap-1">
        <p class="text-sm font-medium">${label}</p>
        ${description
          ? html`<p class="text-sm text-muted-foreground">${description}</p>`
          : ""}
        <div class="relative">
          <input
            type="text"
            class="input w-full pr-20 font-mono text-sm"
            .value=${value}
            readonly
            aria-label=${label}
            @click=${(e: Event) =>
              (e.currentTarget as HTMLInputElement).select()}
            @focus=${(e: Event) =>
              (e.currentTarget as HTMLInputElement).select()}
          />
          <button
            type="button"
            class="btn-sm-outline absolute right-2 top-1/2 h-7 -translate-y-1/2 px-2.5 text-xs"
            data-copy-feed-url
            @click=${() => void this._copyFeedUrl(value)}
          >
            ${this.labels.copy}
          </button>
        </div>
      </div>
    `;
  }

  private _renderAboutPageRow() {
    const status = this.aboutPage;

    return html`
      <div class="mt-2 text-sm text-muted-foreground" data-about-page-row>
        ${this.labels.aboutPagePrompt}
        ${status.state === "ready"
          ? html`
              <a
                class="font-medium text-foreground underline-offset-4 hover:underline"
                href=${this.aboutEditUrl}
              >
                ${this.labels.editAboutPage}
              </a>
            `
          : status.state === "missing"
            ? html`
                <form
                  class="inline"
                  method="post"
                  action=${this.aboutCreateUrl}
                >
                  <button
                    type="submit"
                    class="inline cursor-pointer border-0 bg-transparent p-0 font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    ${this.labels.createAboutPage}
                  </button>
                </form>
              `
            : html`
                <span class="text-destructive"
                  >${this.labels.aboutPageConflict}</span
                >
              `}
      </div>
    `;
  }

  private _renderGeneralForm() {
    return html`
      <div class="flex flex-col gap-8">
        <div>
          <h2 class="text-lg font-semibold">${this.labels.general}</h2>
        </div>

        <section
          class="flex flex-col gap-4"
          @keydown=${(e: globalThis.KeyboardEvent) =>
            this._onKeydown(
              e,
              () => this._saveSite(),
              this._siteDirty,
              this._siteLoading,
            )}
        >
          ${this._renderSectionTitle(this.labels.site)}
          <div class="field">
            <label class="label">${this.labels.siteName}</label>
            <input
              type="text"
              class="input"
              maxlength=${MAX_SITE_NAME_LENGTH}
              .value=${this._siteName}
              placeholder=${this.siteNameFallback}
              @input=${(e: Event) => {
                this._siteName = (e.target as HTMLInputElement).value;
                this._syncSiteDirty();
              }}
            />
          </div>

          <div class="field">
            <label class="label">${this.labels.aboutBlog}</label>
            <div class="settings-tiptap-editor" data-settings-desc-editor></div>
            <p class="text-sm text-muted-foreground mt-1">
              ${this.labels.aboutBlogHelp}
            </p>
            ${this._renderAboutPageRow()}
          </div>

          <div class="field">
            <label class="label">${this.labels.siteFooter}</label>
            <div
              class="settings-tiptap-editor"
              data-settings-footer-editor
            ></div>
            <p class="text-sm text-muted-foreground mt-1">
              ${this.labels.footerHelp}
            </p>
          </div>

          ${this._renderSaveAction(this._siteLoading, this._siteDirty, () =>
            this._saveSite(),
          )}
        </section>

        <section
          class="flex flex-col gap-4 border-t pt-8"
          @keydown=${(e: globalThis.KeyboardEvent) =>
            this._onKeydown(
              e,
              () => this._saveLocale(),
              this._localeDirty,
              this._localeLoading,
            )}
        >
          ${this._renderSectionTitle(this.labels.languageAndTime)}
          <div class="field">
            <label id="site-language-label" class="label"
              >${this.labels.siteLanguage}</label
            >
            ${this._renderLanguagePicker()}
            <p class="text-sm text-muted-foreground mt-1">
              ${this.labels.siteLanguageHelp}
            </p>
            <p class="text-sm text-muted-foreground mt-1">
              ${this.labels.contentLanguagePreview}
              <code class="rounded bg-muted px-1.5 py-0.5 text-xs"
                >${`<html lang="${this._siteLanguage || "en"}">`}</code
              >
            </p>
          </div>

          <div class="field">
            <label id="dashboard-language-label" class="label"
              >${this.labels.dashboardLanguage}</label
            >
            <select
              class="select"
              aria-labelledby="dashboard-language-label"
              @change=${(e: Event) => {
                this._dashboardLanguage = (e.target as HTMLSelectElement).value;
                this._syncLocaleDirty();
              }}
            >
              ${this.dashboardLanguages.map(
                (lang) => html`
                  <option
                    value=${lang.value}
                    ?selected=${this._dashboardLanguage === lang.value}
                  >
                    ${lang.label}
                  </option>
                `,
              )}
            </select>
            <p class="text-sm text-muted-foreground mt-1">
              ${this.labels.dashboardLanguageHelp}
            </p>
          </div>

          <div class="field">
            <label class="label">${this.labels.cjkFont}</label>
            <select
              class="select"
              @change=${(e: Event) => {
                this._cjkSerifFont = (e.target as HTMLSelectElement).value;
                this._syncLocaleDirty();
              }}
            >
              ${this.cjkFonts.map(
                (font) => html`
                  <option
                    value=${font.value}
                    ?selected=${this._cjkSerifFont === font.value}
                  >
                    ${font.label}
                  </option>
                `,
              )}
            </select>
            <p class="text-sm text-muted-foreground mt-1">
              ${this.labels.cjkFontHelp}
            </p>
          </div>

          <div class="field">
            <label class="label">${this.labels.timeZone}</label>
            <select
              class="select"
              @change=${(e: Event) => {
                this._timeZone = (e.target as HTMLSelectElement).value;
                this._syncLocaleDirty();
              }}
            >
              ${this.timezones.map(
                (tz) => html`
                  <option
                    value=${tz.value}
                    ?selected=${this._timeZone === tz.value}
                  >
                    ${tz.label}
                  </option>
                `,
              )}
            </select>
          </div>

          ${this._renderSaveAction(this._localeLoading, this._localeDirty, () =>
            this._saveLocale(),
          )}
        </section>

        <section
          class="flex flex-col gap-4 border-t pt-8"
          @keydown=${(e: globalThis.KeyboardEvent) =>
            this._onKeydown(
              e,
              () => this._saveFeeds(),
              this._feedDirty,
              this._feedLoading,
            )}
        >
          ${this._renderSectionTitle(this.labels.feeds)}
          <div class="field">
            <p class="label">${this.labels.mainRssFeed}</p>
            <p class="text-sm text-muted-foreground mt-1">
              ${this.labels.mainRssFeedHelp}
            </p>
            <div class="mt-3 flex flex-col gap-2">
              ${this._renderMainRssFeedOption(
                "featured",
                this.labels.featuredFeedOption,
                this.labels.featuredFeedOptionDescription,
              )}
              ${this._renderMainRssFeedOption(
                "latest",
                this.labels.latestFeedOption,
                this.labels.latestFeedOptionDescription,
              )}
            </div>
            <p class="text-sm text-muted-foreground mt-2">
              ${this.labels.mainRssFeedWarning}
            </p>
          </div>

          <div class="rounded-xl border border-border/70 bg-muted/30 p-4">
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1">
                <p class="text-sm font-medium">
                  ${this.labels.availableFeedUrls}
                </p>
                <p class="text-sm text-muted-foreground">
                  ${this.labels.availableFeedUrlsHelp}
                </p>
              </div>

              ${this._renderFeedInfoRow(
                this.labels.mainFeedUrl,
                this.mainFeedUrl,
              )}
              ${this._renderFeedInfoRow(
                this.labels.latestFeedUrl,
                this.latestFeedUrl,
              )}
              ${this._renderFeedInfoRow(
                this.labels.featuredFeedUrl,
                this.featuredFeedUrl,
              )}
              ${this._renderFeedInfoRow(
                this.labels.archiveFeedUrl,
                this.archiveFeedUrl,
                this.labels.archiveFeedUrlHelp,
              )}
            </div>
          </div>

          ${this._renderSaveAction(this._feedLoading, this._feedDirty, () =>
            this._saveFeeds(),
          )}
        </section>

        <section class="flex flex-col gap-4 border-t pt-8 pb-6">
          ${this._renderSectionTitle(this.labels.home)}
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              class="checkbox"
              .checked=${this._showJantBrandingOnHome}
              ?disabled=${this._homeLoading}
              @change=${(e: Event) =>
                this._saveHomeToggle((e.target as HTMLInputElement).checked)}
            />
            <span>${this.labels.showJantBrandingOnHome}</span>
          </label>
        </section>
      </div>
    `;
  }

  private _renderSearchForm() {
    return html`
      <section class="flex flex-col gap-4 border-t pt-8">
        ${this._renderSectionTitle(this.labels.search)}
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            class="checkbox"
            .checked=${!this._noindex}
            ?disabled=${this.demoMode || this._searchLoading}
            @change=${(e: Event) =>
              this._saveSearchToggle((e.target as HTMLInputElement).checked)}
          />
          <span>${this.labels.allowIndexing}</span>
        </label>
        ${this.demoMode
          ? html`<p class="text-sm text-muted-foreground">
              ${this.labels.demoSeoLocked}
            </p>`
          : nothing}
      </section>
    `;
  }

  render() {
    return html`
      <div class="flex flex-col">
        ${this._renderGeneralForm()} ${this._renderSearchForm()}
      </div>
    `;
  }
}

customElements.define("jant-settings-general", JantSettingsGeneral);
