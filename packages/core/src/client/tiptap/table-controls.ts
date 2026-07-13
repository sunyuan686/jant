/**
 * Contextual table controls for compose editors.
 *
 * TipTap's table extension owns the document commands but intentionally ships
 * without interface chrome. This extension adds a small, keyboard-accessible
 * toolbar while the caret is inside a table.
 */

import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { TableMap } from "@tiptap/pm/tables";
import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import {
  getFixedFloatingContainerRect,
  getFloatingPosition,
} from "./floating-position.js";
import {
  DEFAULT_TABLE_CONTROL_LABELS,
  type TableControlLabels,
} from "./table-control-labels.js";

export type { TableControlLabels } from "./table-control-labels.js";

const tableControlsKey = new PluginKey("tableControls");
const TABLE_MENU_OPEN_EVENT = "jant:table-options-open";

const ICON_ADD_ROW = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="11" rx="2"/><path d="M4 8.5h16M12 3v11M12 18v4M10 20h4"/></svg>`;
const ICON_ADD_COLUMN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="11" height="16" rx="2"/><path d="M8.5 4v16M3 12h11M18 12h4M20 10v4"/></svg>`;
const ICON_MORE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>`;

interface TableControlsOptions {
  labels: TableControlLabels;
}

interface TableInfo {
  node: ProseMirrorNode;
  pos: number;
}

type TableActionKey =
  | "addRowAbove"
  | "addRowBelow"
  | "addColumnBefore"
  | "addColumnAfter"
  | "deleteRow"
  | "deleteColumn"
  | "toggleHeaderRow"
  | "deleteTable";

interface TableAction {
  key: TableActionKey;
  label: string;
  destructive?: boolean;
  separatorBefore?: boolean;
}

function findTable($pos: ResolvedPos): TableInfo | null {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (node.type.name === "table") {
      return { node, pos: $pos.before(depth) };
    }
  }
  return null;
}

function getActiveTable(editor: Editor): TableInfo | null {
  return findTable(editor.state.selection.$from);
}

function getActiveTableElement(
  view: EditorView,
): globalThis.HTMLTableElement | null {
  const { node } = view.domAtPos(view.state.selection.from);
  const element = node instanceof HTMLElement ? node : node.parentElement;
  const table = element?.closest("table");
  return table instanceof globalThis.HTMLTableElement &&
    view.dom.contains(table)
    ? table
    : null;
}

function getTableDimensions(editor: Editor): { rows: number; columns: number } {
  const table = getActiveTable(editor);
  if (!table) return { rows: 0, columns: 0 };
  const map = TableMap.get(table.node);
  return { rows: map.height, columns: map.width };
}

function toggleFirstHeaderRow(editor: Editor): boolean {
  return editor.commands.command(({ state, tr, dispatch }) => {
    const table = findTable(state.selection.$from);
    const firstRow = table?.node.firstChild;
    const headerType = state.schema.nodes.tableHeader;
    const cellType = state.schema.nodes.tableCell;
    if (!table || !firstRow || !headerType || !cellType) return false;

    const shouldEnable = firstRow.firstChild?.type !== headerType;
    let cellPos = table.pos + 2;
    firstRow.forEach((cell) => {
      tr.setNodeMarkup(
        cellPos,
        shouldEnable ? headerType : cellType,
        cell.attrs,
      );
      cellPos += cell.nodeSize;
    });
    dispatch?.(tr);
    return true;
  });
}

/**
 * Returns labels configured on the compose-only table controls extension.
 *
 * @param editor - Editor whose extensions should be inspected
 * @returns Localized labels, or null when table UI is not enabled
 */
export function getConfiguredTableControlLabels(
  editor: Editor,
): TableControlLabels | null {
  const extension = editor.extensionManager.extensions.find(
    (candidate) => candidate.name === "tableControls",
  );
  if (!extension) return null;
  return extension.options.labels as TableControlLabels;
}

export const TableControls = Extension.create<TableControlsOptions>({
  name: "tableControls",

  addOptions() {
    return {
      labels: DEFAULT_TABLE_CONTROL_LABELS,
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const labels = this.options.labels;
    let toolbar: HTMLElement | null = null;
    let optionsMenu: HTMLElement | null = null;
    let optionsButton: HTMLButtonElement | null = null;
    let viewRef: EditorView | null = null;
    let menuOpen = false;
    const actionButtons = new Map<TableActionKey, HTMLButtonElement[]>();

    const actions: TableAction[] = [
      { key: "addRowAbove", label: labels.addRowAbove },
      { key: "addRowBelow", label: labels.addRowBelow },
      { key: "addColumnBefore", label: labels.addColumnBefore },
      { key: "addColumnAfter", label: labels.addColumnAfter },
      { key: "deleteRow", label: labels.deleteRow, separatorBefore: true },
      { key: "deleteColumn", label: labels.deleteColumn },
      { key: "toggleHeaderRow", label: labels.toggleHeaderRow },
      {
        key: "deleteTable",
        label: labels.deleteTable,
        destructive: true,
        separatorBefore: true,
      },
    ];

    function canRun(key: TableActionKey): boolean {
      if (!getActiveTable(editor)) return false;
      const dimensions = getTableDimensions(editor);
      switch (key) {
        case "addRowAbove":
          return editor.can().addRowBefore();
        case "addRowBelow":
          return editor.can().addRowAfter();
        case "addColumnBefore":
          return editor.can().addColumnBefore();
        case "addColumnAfter":
          return editor.can().addColumnAfter();
        case "deleteRow":
          return dimensions.rows > 1 && editor.can().deleteRow();
        case "deleteColumn":
          return dimensions.columns > 1 && editor.can().deleteColumn();
        case "toggleHeaderRow":
          return true;
        case "deleteTable":
          return editor.can().deleteTable();
      }
    }

    function runAction(key: TableActionKey): void {
      if (!canRun(key)) return;
      const toolbarHadFocus = Boolean(
        document.activeElement && toolbar?.contains(document.activeElement),
      );
      switch (key) {
        case "addRowAbove":
          editor.commands.addRowBefore();
          break;
        case "addRowBelow":
          editor.commands.addRowAfter();
          break;
        case "addColumnBefore":
          editor.commands.addColumnBefore();
          break;
        case "addColumnAfter":
          editor.commands.addColumnAfter();
          break;
        case "deleteRow":
          editor.commands.deleteRow();
          break;
        case "deleteColumn":
          editor.commands.deleteColumn();
          break;
        case "toggleHeaderRow":
          toggleFirstHeaderRow(editor);
          break;
        case "deleteTable":
          editor.commands.deleteTable();
          break;
      }
      closeMenu();
      sync(viewRef ?? editor.view);
      if (toolbarHadFocus && !getActiveTable(editor)) {
        editor.view.focus();
      }
    }

    function registerActionButton(
      key: TableActionKey,
      button: HTMLButtonElement,
    ): void {
      const existing = actionButtons.get(key) ?? [];
      existing.push(button);
      actionButtons.set(key, existing);
    }

    function createActionButton(
      key: TableActionKey,
      label: string,
      icon?: string,
      className = "tiptap-table-menu-item",
    ): HTMLButtonElement {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.title = label;
      button.setAttribute("aria-label", label);
      if (icon) {
        button.innerHTML = icon;
      } else {
        button.textContent = label;
        button.setAttribute("role", "menuitem");
      }
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      button.addEventListener("click", () => runAction(key));
      registerActionButton(key, button);
      return button;
    }

    function createElements(): void {
      toolbar = document.createElement("div");
      toolbar.className = "tiptap-table-controls";
      toolbar.dataset.editorFloatingUi = "true";
      toolbar.style.position = "fixed";
      toolbar.style.display = "none";
      toolbar.setAttribute("role", "toolbar");
      toolbar.setAttribute("aria-label", labels.toolbarLabel);

      toolbar.appendChild(
        createActionButton(
          "addRowBelow",
          labels.addRowBelow,
          ICON_ADD_ROW,
          "tiptap-table-control-btn",
        ),
      );
      toolbar.appendChild(
        createActionButton(
          "addColumnAfter",
          labels.addColumnAfter,
          ICON_ADD_COLUMN,
          "tiptap-table-control-btn",
        ),
      );

      optionsButton = document.createElement("button");
      optionsButton.type = "button";
      optionsButton.className = "tiptap-table-control-btn";
      optionsButton.innerHTML = ICON_MORE;
      optionsButton.title = labels.options;
      optionsButton.setAttribute("aria-label", labels.options);
      optionsButton.setAttribute("aria-haspopup", "menu");
      optionsButton.setAttribute("aria-expanded", "false");
      optionsButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      optionsButton.addEventListener("click", (event) => {
        if (menuOpen) {
          closeMenu();
          return;
        }
        openMenu(event.detail === 0);
      });
      toolbar.appendChild(optionsButton);

      optionsMenu = document.createElement("div");
      optionsMenu.className = "tiptap-table-options";
      optionsMenu.dataset.editorFloatingUi = "true";
      optionsMenu.setAttribute("role", "menu");
      optionsMenu.hidden = true;

      for (const action of actions) {
        if (action.separatorBefore) {
          const separator = document.createElement("div");
          separator.className = "tiptap-table-options-separator";
          separator.setAttribute("role", "separator");
          optionsMenu.appendChild(separator);
        }
        const button = createActionButton(action.key, action.label);
        if (action.destructive) {
          button.classList.add("is-destructive");
        }
        optionsMenu.appendChild(button);
      }
      toolbar.appendChild(optionsMenu);

      toolbar.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        if (menuOpen) {
          closeMenu();
          optionsButton?.focus();
          return;
        }
        editor.view.focus();
      });
    }

    function openMenu(focusFirst: boolean): void {
      if (!optionsMenu || !optionsButton || !toolbar) return;
      document.dispatchEvent(
        new CustomEvent(TABLE_MENU_OPEN_EVENT, {
          detail: { source: toolbar },
        }),
      );
      menuOpen = true;
      optionsMenu.hidden = false;
      optionsButton.setAttribute("aria-expanded", "true");
      syncButtons();
      if (focusFirst) {
        optionsMenu
          .querySelector<HTMLButtonElement>("button:not(:disabled)")
          ?.focus();
      }
    }

    function closeMenu(): void {
      if (!optionsMenu || !optionsButton) return;
      menuOpen = false;
      optionsMenu.hidden = true;
      optionsButton.setAttribute("aria-expanded", "false");
    }

    function syncButtons(): void {
      for (const [key, buttons] of actionButtons) {
        const enabled = canRun(key);
        for (const button of buttons) {
          button.disabled = !enabled;
          button.setAttribute("aria-disabled", String(!enabled));
        }
      }
    }

    function hide(): void {
      closeMenu();
      if (toolbar) toolbar.style.display = "none";
    }

    function position(
      view: EditorView,
      table: globalThis.HTMLTableElement,
    ): void {
      if (!toolbar) return;
      toolbar.style.display = "flex";
      toolbar.style.visibility = "hidden";
      const dialog = view.dom.closest("dialog");
      const anchorRect = table.getBoundingClientRect();
      const floatingRect = toolbar.getBoundingClientRect();
      const layout = getFloatingPosition({
        anchorRect,
        containerRect: getFixedFloatingContainerRect(dialog),
        floatingWidth: floatingRect.width,
        floatingHeight: floatingRect.height,
        preferredPlacement: "top",
        fallbackPlacement: "bottom",
        align: "center",
        gap: 6,
      });
      toolbar.style.left = `${layout.left}px`;
      toolbar.style.top = `${layout.top}px`;
      toolbar.dataset.placement = layout.placement;
      toolbar.style.visibility = "visible";
    }

    function hasRelatedFocus(view: EditorView): boolean {
      const active = document.activeElement;
      return view.hasFocus() || Boolean(active && toolbar?.contains(active));
    }

    function sync(view: EditorView): void {
      viewRef = view;
      const table = getActiveTableElement(view);
      if (!table || !hasRelatedFocus(view)) {
        hide();
        return;
      }
      position(view, table);
      syncButtons();
    }

    function focusToolbar(view: EditorView): boolean {
      if (!getActiveTableElement(view)) return false;
      if (toolbar) toolbar.style.display = "flex";
      sync(view);
      const first = toolbar?.querySelector<HTMLButtonElement>(
        ":scope > button:not(:disabled)",
      );
      first?.focus();
      return Boolean(first);
    }

    return [
      new Plugin({
        key: tableControlsKey,
        props: {
          handleKeyDown(view, event) {
            if (event.altKey && event.key === "F10") {
              if (!getActiveTableElement(view)) return false;
              event.preventDefault();
              event.stopPropagation();
              return focusToolbar(view);
            }
            if (event.key === "Escape" && menuOpen) {
              event.preventDefault();
              event.stopPropagation();
              closeMenu();
              return true;
            }
            return false;
          },
        },
        view(editorView) {
          viewRef = editorView;
          createElements();
          const dialog = editorView.dom.closest("dialog");
          const container = dialog ?? document.body;
          if (toolbar) container.appendChild(toolbar);

          const scheduleSync = () => {
            requestAnimationFrame(() => {
              if (viewRef) sync(viewRef);
            });
          };
          const onViewportChange = () => {
            if (viewRef && toolbar && toolbar.style.display !== "none") {
              const table = getActiveTableElement(viewRef);
              if (table) position(viewRef, table);
            }
          };
          const onDocumentMousedown = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (toolbar?.contains(target)) return;
            if (editorView.dom.contains(target)) {
              closeMenu();
              return;
            }
            hide();
          };
          const onDocumentFocusIn = (event: globalThis.FocusEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (toolbar?.contains(target) || editorView.dom.contains(target)) {
              scheduleSync();
              return;
            }
            hide();
          };
          const onPeerMenuOpen = (event: Event) => {
            const detail = (event as CustomEvent<{ source: HTMLElement }>)
              .detail;
            if (detail.source !== toolbar) closeMenu();
          };

          editorView.dom.addEventListener("focusin", scheduleSync);
          editorView.dom.addEventListener("focusout", scheduleSync);
          document.addEventListener("mousedown", onDocumentMousedown, true);
          document.addEventListener("focusin", onDocumentFocusIn, true);
          document.addEventListener(TABLE_MENU_OPEN_EVENT, onPeerMenuOpen);
          window.addEventListener("resize", onViewportChange);
          window.addEventListener("scroll", onViewportChange, true);

          scheduleSync();

          return {
            update(view) {
              sync(view);
            },
            destroy() {
              editorView.dom.removeEventListener("focusin", scheduleSync);
              editorView.dom.removeEventListener("focusout", scheduleSync);
              document.removeEventListener(
                "mousedown",
                onDocumentMousedown,
                true,
              );
              document.removeEventListener("focusin", onDocumentFocusIn, true);
              document.removeEventListener(
                TABLE_MENU_OPEN_EVENT,
                onPeerMenuOpen,
              );
              window.removeEventListener("resize", onViewportChange);
              window.removeEventListener("scroll", onViewportChange, true);
              toolbar?.remove();
              toolbar = null;
              optionsMenu = null;
              optionsButton = null;
              actionButtons.clear();
              viewRef = null;
            },
          };
        },
      }),
    ];
  },
});
