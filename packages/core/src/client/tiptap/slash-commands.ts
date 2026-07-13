/**
 * Slash Commands Extension
 *
 * Provides a "/" command menu for block formatting.
 * Built on @tiptap/suggestion for cursor tracking and filtering.
 */

import { Extension } from "@tiptap/core";
import Suggestion, {
  type SuggestionOptions,
  type SuggestionProps,
  type SuggestionKeyDownProps,
} from "@tiptap/suggestion";
import type { Editor, Range } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { escapeHtml } from "../../lib/html.js";
import { getConfiguredTableControlLabels } from "./table-controls.js";
import { openTableSizePicker } from "./table-size-picker.js";
import { getBestFieldSearchRank, normalizeSearch } from "../search-rank.js";
import {
  getFixedFloatingContainerRect,
  getFloatingPosition,
} from "./floating-position.js";
import { openEmbedDialog } from "./embed-dialog.js";

// SVG icons (18×18, stroke-based, Lucide style)
const ICONS = {
  image: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
  embed: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" ry="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/><polygon points="10 8 15 11 10 14 10 8" fill="currentColor"/></svg>`,
  divider: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/></svg>`,
  readMore: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="m9 18 3 3 3-3"/><path d="m9 6-3-3-3 3"/><path d="M3 6h18"/></svg>`,
  footnote: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10"/><path d="M12 4v11"/><path d="M9 9h6"/><path d="M16 20h4"/><path d="M18 14v6"/></svg>`,
  table: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>`,
  code: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  blockquote: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>`,
  bulletList: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`,
  orderedList: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>`,
  h1: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 12l3-2v10"/></svg>`,
  h2: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>`,
  h3: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/></svg>`,
} as const;

type SlashCommandGroup = "media" | "structure" | "formatting" | "headings";

interface SlashCommandItem {
  label: string;
  description: string;
  group: SlashCommandGroup;
  keywords: string[];
  icon: string;
  command: (editor: Editor, range: Range) => void;
}

const SLASH_GROUP_LABELS: Record<SlashCommandGroup, string> = {
  media: "Media",
  structure: "Structure",
  formatting: "Formatting",
  headings: "Headings",
};

const SLASH_GROUP_ORDER: SlashCommandGroup[] = [
  "media",
  "structure",
  "formatting",
  "headings",
];

const SLASH_EMPTY_MESSAGE = "No matches. Try another command.";
const SLASH_FOOTER_LABELS = {
  insert: "Insert",
  close: "Close",
} as const;

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    label: "Media",
    description: "Upload an image or video.",
    group: "media",
    keywords: ["image", "video", "photo", "upload"],
    icon: ICONS.image,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      document.dispatchEvent(
        new CustomEvent("jant:slash-image", { bubbles: true }),
      );
    },
  },
  {
    label: "Embed",
    description: "Embed a YouTube video, tweet, or any HTTPS page.",
    group: "media",
    keywords: [
      "embed",
      "youtube",
      "vimeo",
      "spotify",
      "video",
      "iframe",
      "html",
      "letterbird",
    ],
    icon: ICONS.embed,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      void openEmbedDialog().then((result) => {
        if (!result) {
          editor.commands.focus();
          return;
        }
        if (result.kind === "embed") {
          editor
            .chain()
            .focus()
            .setEmbed({
              url: result.url,
              caption: result.caption,
            })
            .run();
        } else if (result.kind === "link") {
          // Insert the URL as text and wrap it with a link mark, so the
          // "Insert as link instead" affordance produces a normal hyperlink
          // rather than an embed.
          editor
            .chain()
            .focus()
            .insertContent({
              type: "text",
              text: result.url,
              marks: [{ type: "link", attrs: { href: result.url } }],
            })
            .run();
        } else {
          editor.chain().focus().setHtmlBlock({ html: result.html }).run();
        }
      });
    },
  },
  {
    label: "Divider",
    description: "Separate one thought from the next.",
    group: "structure",
    keywords: ["line", "rule", "separator", "break", "hr"],
    icon: ICONS.divider,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    label: "Read More",
    description: "Collapse the rest of a longer post.",
    group: "structure",
    keywords: ["excerpt", "continue", "teaser", "more", "break"],
    icon: ICONS.readMore,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).insertMoreBreak().run();
    },
  },
  {
    label: "Footnote",
    description: "Insert a numbered footnote and jump to its note.",
    group: "structure",
    keywords: ["footnote", "note", "citation", "reference", "superscript"],
    icon: ICONS.footnote,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).insertFootnote().run();
    },
  },
  {
    label: "Table",
    description: "Insert a table.",
    group: "structure",
    keywords: ["grid", "rows", "columns", "spreadsheet"],
    icon: ICONS.table,
    command: (editor, range) => {
      const labels = getConfiguredTableControlLabels(editor);
      if (labels) {
        openTableSizePicker(editor, range, labels);
        return;
      }
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    label: "Code Block",
    description: "Format a block of code or monospace text.",
    group: "formatting",
    keywords: ["code", "snippet", "pre", "monospace"],
    icon: ICONS.code,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    label: "Blockquote",
    description: "Set off quoted text or a pull quote.",
    group: "formatting",
    keywords: ["quote", "citation", "excerpt", "callout"],
    icon: ICONS.blockquote,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    label: "Bullet List",
    description: "Start an unordered list.",
    group: "formatting",
    keywords: ["list", "bullets", "unordered", "ul"],
    icon: ICONS.bulletList,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    label: "Ordered List",
    description: "Start a numbered list.",
    group: "formatting",
    keywords: ["list", "numbered", "ordered", "ol"],
    icon: ICONS.orderedList,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    label: "Heading 1",
    description: "Insert the largest section heading.",
    group: "headings",
    keywords: ["title", "h1", "large heading", "section title"],
    icon: ICONS.h1,
    command: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleHeading({ level: 1 })
        .run();
    },
  },
  {
    label: "Heading 2",
    description: "Insert a medium section heading.",
    group: "headings",
    keywords: ["subtitle", "h2", "section heading"],
    icon: ICONS.h2,
    command: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleHeading({ level: 2 })
        .run();
    },
  },
  {
    label: "Heading 3",
    description: "Insert a small section heading.",
    group: "headings",
    keywords: ["subheading", "h3", "small heading"],
    icon: ICONS.h3,
    command: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleHeading({ level: 3 })
        .run();
    },
  },
];

/** Check whether a document already contains a moreBreak node */
function hasMoreBreak(editor: Editor): boolean {
  let found = false;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "moreBreak") {
      found = true;
      return false; // stop traversal
    }
    return !found;
  });
  return found;
}

/**
 * Returns the slash commands list, used by both the extension and the + menu.
 * Omits "Read More" when the document already contains one.
 */
export function getSlashCommands(editor?: Editor): SlashCommandItem[] {
  if (editor && hasMoreBreak(editor)) {
    return SLASH_COMMANDS.filter((item) => item.label !== "Read More");
  }
  return SLASH_COMMANDS;
}

// Popup element management
let popupEl: HTMLElement | null = null;
let selectedIndex = 0;
let filteredItems: SlashCommandItem[] = [];
let commandFn: ((item: { index: number }) => void) | null = null;
let editorRef: Editor | null = null;
let currentRange: Range | null = null;
let outsideClickHandler: ((e: MouseEvent) => void) | null = null;

function getPopupScrollBody(): HTMLElement | null {
  if (!popupEl) return null;
  return (
    popupEl.querySelector<HTMLElement>(".tiptap-slash-menu-scroll") ?? popupEl
  );
}

function createPopup(): HTMLElement {
  const el = document.createElement("div");
  el.className = "tiptap-slash-menu";
  el.dataset.editorFloatingUi = "true";
  el.style.position = "fixed";
  return el;
}

/** Scroll the selected item into view within the popup only (no ancestor scroll) */
function scrollSelectedIntoView() {
  if (!popupEl) return;
  const scrollBody = getPopupScrollBody();
  if (!scrollBody) return;
  const selected = popupEl.querySelector(
    ".tiptap-slash-item.is-selected",
  ) as HTMLElement | null;
  if (!selected) return;
  const itemTop = selected.offsetTop - scrollBody.offsetTop;
  const itemBottom = itemTop + selected.offsetHeight;
  const scrollTop = scrollBody.scrollTop;
  const viewBottom = scrollTop + scrollBody.clientHeight;
  if (itemTop < scrollTop) {
    scrollBody.scrollTop = itemTop;
  } else if (itemBottom > viewBottom) {
    scrollBody.scrollTop = itemBottom - scrollBody.clientHeight;
  }
}

/** Update selection highlight and scroll into view */
function updateSelection() {
  popupEl?.querySelectorAll(".tiptap-slash-item").forEach((item, i) => {
    const isSelected = i === selectedIndex;
    item.classList.toggle("is-selected", isSelected);
    item.setAttribute("aria-selected", isSelected ? "true" : "false");
  });
  updateFooterDescription();
  scrollSelectedIntoView();
}

function getSelectedItem(): SlashCommandItem | null {
  return filteredItems[selectedIndex] ?? null;
}

function updateFooterDescription() {
  const descriptionEl = popupEl?.querySelector<HTMLElement>(
    ".tiptap-slash-footer-description",
  );
  if (!descriptionEl) return;
  descriptionEl.textContent = getSelectedItem()?.description ?? "";
}

function renderFooterMarkup(selectedItem: SlashCommandItem | null): string {
  return `<div class="tiptap-slash-footer">
    <span class="tiptap-slash-footer-description">${escapeHtml(selectedItem?.description ?? "")}</span>
    <span class="tiptap-slash-footer-actions" aria-hidden="true">
      <span class="tiptap-slash-footer-note">
        <span class="tiptap-slash-kbd">Enter</span>
        <span>${escapeHtml(SLASH_FOOTER_LABELS.insert)}</span>
      </span>
      <span class="tiptap-slash-footer-separator"></span>
      <span class="tiptap-slash-footer-note">
        <span class="tiptap-slash-kbd">Esc</span>
        <span>${escapeHtml(SLASH_FOOTER_LABELS.close)}</span>
      </span>
    </span>
  </div>`;
}

function renderItemMarkup(item: SlashCommandItem, index: number): string {
  const isSelected = index === selectedIndex;
  return `<div
      class="tiptap-slash-item${isSelected ? " is-selected" : ""}"
      data-index="${index}"
      role="option"
      aria-selected="${isSelected ? "true" : "false"}"
    >
      <span class="tiptap-slash-item-icon" aria-hidden="true">${item.icon}</span>
      <span class="tiptap-slash-item-label">${escapeHtml(item.label)}</span>
    </div>`;
}

function renderPopup(
  items: SlashCommandItem[],
  onSelect: (index: number) => void,
) {
  if (!popupEl) return;

  filteredItems = items;
  if (items.length === 0) {
    selectedIndex = 0;
    popupEl.dataset.empty = "true";
    popupEl.innerHTML = `<div class="tiptap-slash-menu-scroll">
        <div class="tiptap-slash-empty-shell">
          <div class="tiptap-slash-empty" role="status" aria-live="polite">${escapeHtml(SLASH_EMPTY_MESSAGE)}</div>
        </div>
      </div>
      ${renderFooterMarkup(null)}`;
    const scrollBody = getPopupScrollBody();
    if (scrollBody) scrollBody.scrollTop = 0;
    return;
  }

  delete popupEl.dataset.empty;
  if (selectedIndex >= items.length || Number.isNaN(selectedIndex)) {
    selectedIndex = 0;
  }

  const groupedMarkup = SLASH_GROUP_ORDER.map((group) => {
    const groupItems = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.group === group);
    if (groupItems.length === 0) return "";

    return `<section class="tiptap-slash-group" data-group="${group}">
        <p class="tiptap-slash-group-label">${escapeHtml(SLASH_GROUP_LABELS[group])}</p>
        ${groupItems
          .map(({ item, index }) => renderItemMarkup(item, index))
          .join("")}
      </section>`;
  }).join("");

  popupEl.innerHTML = `<div class="tiptap-slash-menu-scroll">
      ${groupedMarkup}
    </div>
    ${renderFooterMarkup(getSelectedItem())}`;

  // Click handlers
  popupEl.querySelectorAll<HTMLElement>(".tiptap-slash-item").forEach((el) => {
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const idx = parseInt(el.dataset.index ?? "0", 10);
      onSelect(idx);
    });
    el.addEventListener("mouseenter", () => {
      selectedIndex = parseInt(el.dataset.index ?? "0", 10);
      updateSelection();
    });
  });
  const scrollBody = getPopupScrollBody();
  if (scrollBody) scrollBody.scrollTop = 0;
}

function destroyPopup() {
  if (outsideClickHandler) {
    document.removeEventListener("mousedown", outsideClickHandler, true);
    outsideClickHandler = null;
  }
  popupEl?.remove();
  popupEl = null;
  selectedIndex = 0;
  filteredItems = [];
  commandFn = null;
  editorRef = null;
  currentRange = null;
}

/**
 * Position the popup relative to the cursor, accounting for dialog containing block.
 * When a `<dialog>` has CSS animation, it creates a containing block that makes
 * `position: fixed` relative to the dialog instead of the viewport.
 * Flips above the cursor when there isn't enough space below.
 */
function positionPopup(
  rect: globalThis.DOMRect,
  container: HTMLElement | null,
) {
  if (!popupEl) return;

  // Reset inline max-height so offsetHeight reflects the natural size
  popupEl.style.maxHeight = "";
  const viewportRect = getFixedFloatingContainerRect(null);
  const containerRect = container
    ? getFixedFloatingContainerRect(container)
    : viewportRect;
  const layout = getFloatingPosition({
    anchorRect: {
      left: rect.left,
      right: rect.left,
      top: rect.top,
      bottom: rect.bottom,
    },
    containerRect: viewportRect,
    floatingWidth: popupEl.offsetWidth,
    floatingHeight: popupEl.offsetHeight,
    preferredPlacement: "bottom",
    fallbackPlacement: "top",
    align: "start",
    gap: 6,
  });

  popupEl.style.left = `${layout.left - containerRect.left}px`;
  popupEl.style.top = `${layout.top - containerRect.top}px`;
  popupEl.style.maxHeight =
    layout.maxHeight !== null ? `${layout.maxHeight}px` : "";
}

/** Install a click-outside handler to dismiss the suggestion on external clicks */
function installClickOutside() {
  outsideClickHandler = (e: MouseEvent) => {
    if (!popupEl || popupEl.contains(e.target as Node)) return;
    // Click anywhere outside the popup (including inside the editor) — dismiss
    // by deleting the trigger text so the suggestion plugin deactivates via onExit
    if (editorRef && currentRange) {
      const { state, view } = editorRef;
      view.dispatch(state.tr.delete(currentRange.from, currentRange.to));
    }
  };
  document.addEventListener("mousedown", outsideClickHandler, true);
}

/**
 * Tracks whether the most recent transaction changed the document. Used by
 * the slash `allow` callback to distinguish "user just typed a character"
 * from "user moved the caret into an existing `/word`".
 *
 * This plugin must be registered BEFORE the Suggestion plugin so that by the
 * time Suggestion's apply runs, this plugin's state already reflects the
 * current transaction.
 */
const slashTypingKey = new PluginKey<{ docChanged: boolean }>(
  "jantSlashTyping",
);

function createSlashTypingPlugin(): Plugin<{ docChanged: boolean }> {
  return new Plugin<{ docChanged: boolean }>({
    key: slashTypingKey,
    state: {
      init: () => ({ docChanged: false }),
      apply: (tr) => ({ docChanged: tr.docChanged }),
    },
  });
}

/**
 * Decide whether the slash menu should activate for this range.
 *
 * Two conditions must hold:
 *
 * 1. Context check: the match (`/` + query) must be followed by whitespace,
 *    a block boundary, or a non-text node — so `/now` in the middle of
 *    existing prose (`/now,` or `/now rest`) does not trigger.
 *
 * 2. Intent check: the menu only activates when the user is actively
 *    *typing* — either the plugin was already active (continuing to type a
 *    command) or the latest transaction changed the document. Moving the
 *    caret back into a previously typed `/word` does not re-open the menu.
 */
function isSlashInCommandContext({
  state,
  range,
}: {
  state: EditorState;
  range: Range;
}): boolean {
  const $pos = state.doc.resolve(range.to);
  const parent = $pos.parent;
  const offset = range.to - $pos.start();
  if (offset >= parent.content.size) return true;
  // Treat non-text children and block separators as whitespace-equivalent.
  const nextChar = parent.textBetween(offset, offset + 1, " ", " ");
  if (!nextChar) return true;
  return /\s/.test(nextChar);
}

function shouldAllowSlash({
  state,
  range,
  isActive,
}: {
  state: EditorState;
  range: Range;
  isActive?: boolean;
}): boolean {
  if (!isSlashInCommandContext({ state, range })) return false;
  // Already active: user is continuing to type within the command — keep it.
  if (isActive) return true;
  // Becoming active: only allow if this transaction changed the document
  // (i.e. the user just typed something). A selection-only change means the
  // caret moved into an existing `/word`, which shouldn't open the menu.
  const tracker = slashTypingKey.getState(state);
  return tracker?.docChanged ?? false;
}

/**
 * Slash commands Tiptap extension.
 */
export const SlashCommands = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        allow: shouldAllowSlash,
        items: ({ query, editor }: { query: string; editor: Editor }) => {
          const commands = getSlashCommands(editor);
          const search = normalizeSearch(query);
          if (!search) return commands;
          return commands
            .map((item, index) => ({
              item,
              index,
              rank: getBestFieldSearchRank(
                [item.label, item.description, ...item.keywords],
                search,
              ),
            }))
            .filter(
              (
                entry,
              ): entry is {
                item: SlashCommandItem;
                index: number;
                rank: number;
              } => entry.rank !== null,
            )
            .sort((a, b) => a.rank - b.rank || a.index - b.index)
            .map((entry) => entry.item);
        },
        render: () => {
          function getEditorElement(editor: Editor): globalThis.Element | null {
            const el = editor.options.element;
            return el instanceof globalThis.Element ? el : null;
          }

          return {
            onStart: (
              props: SuggestionProps<SlashCommandItem, { index: number }>,
            ) => {
              popupEl = createPopup();
              selectedIndex = 0;
              commandFn = props.command;
              editorRef = props.editor;
              currentRange = props.range;
              renderPopup(props.items, (index) => props.command({ index }));
              document.dispatchEvent(
                new CustomEvent("jant:slash-command-discovered", {
                  bubbles: true,
                }),
              );

              // Append inside the closest dialog (top-layer) or body
              const editorEl = getEditorElement(props.editor);
              const dialog = editorEl?.closest("dialog") ?? null;
              (dialog ?? document.body).appendChild(popupEl);

              const rect = props.clientRect?.();
              if (rect) {
                positionPopup(rect, dialog);
              }

              installClickOutside();
            },
            onUpdate: (
              props: SuggestionProps<SlashCommandItem, { index: number }>,
            ) => {
              commandFn = props.command;
              currentRange = props.range;
              renderPopup(props.items, (index) => props.command({ index }));
              const rect = props.clientRect?.();
              if (rect) {
                const editorEl = getEditorElement(props.editor);
                const dialog = editorEl?.closest("dialog") ?? null;
                positionPopup(rect, dialog);
              }
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              const { event, view, range } = props;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                if (filteredItems.length === 0) {
                  return true;
                }
                selectedIndex = (selectedIndex + 1) % filteredItems.length;
                updateSelection();
                return true;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                if (filteredItems.length === 0) {
                  return true;
                }
                selectedIndex =
                  (selectedIndex - 1 + filteredItems.length) %
                  filteredItems.length;
                updateSelection();
                return true;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (filteredItems.length === 0) {
                  return true;
                }
                commandFn?.({ index: selectedIndex });
                return true;
              }
              if (event.key === "Escape") {
                // Match click-outside cancel behavior: remove the slash query so
                // the suggestion exits instead of leaving an active hidden state.
                event.stopPropagation();
                event.preventDefault();
                view.dispatch(view.state.tr.delete(range.from, range.to));
                return true;
              }
              return false;
            },
            onExit: () => {
              destroyPopup();
            },
          };
        },
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: { index: number };
        }) => {
          const item = filteredItems[props.index];
          if (item) {
            item.command(editor, range);
          }
        },
      } satisfies Partial<SuggestionOptions>,
    };
  },

  addProseMirrorPlugins() {
    // Tracker runs first so `shouldAllowSlash` can read its fresh state
    // when Suggestion's apply calls the `allow` callback for this transaction.
    return [
      createSlashTypingPlugin(),
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
