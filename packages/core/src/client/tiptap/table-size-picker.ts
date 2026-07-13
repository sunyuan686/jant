/** Accessible table-dimension picker opened by the compose slash command. */

import type { Editor, Range } from "@tiptap/core";
import {
  getFixedFloatingContainerRect,
  getFloatingPosition,
} from "./floating-position.js";
import type { TableControlLabels } from "./table-control-labels.js";

const MAX_ROWS = 8;
const MAX_COLUMNS = 8;
const DEFAULT_ROWS = 3;
const DEFAULT_COLUMNS = 3;

interface ActivePicker {
  close: (restoreFocus?: boolean) => void;
}

let activePicker: ActivePicker | null = null;

function formatSizeLabel(
  template: string,
  rows: number,
  columns: number,
): string {
  return template
    .replaceAll("%rows%", String(rows))
    .replaceAll("%cols%", String(columns));
}

/**
 * Opens a bounded 8×8 table-size picker at the current slash-command range.
 *
 * @param editor - Editor receiving the selected table
 * @param range - Slash query range to remove before opening the picker
 * @param labels - Localized table UI labels
 * @returns Nothing
 */
export function openTableSizePicker(
  editor: Editor,
  range: Range,
  labels: TableControlLabels,
): void {
  activePicker?.close(false);

  editor.chain().focus().deleteRange(range).run();
  const insertPosition = editor.state.selection.from;
  const dialog = editor.view.dom.closest("dialog");
  const container = dialog ?? document.body;

  const picker = document.createElement("div");
  picker.className = "tiptap-table-size-picker";
  picker.dataset.editorFloatingUi = "true";
  picker.style.position = "fixed";
  picker.setAttribute("role", "dialog");
  picker.setAttribute("aria-label", labels.sizePickerLabel);

  const header = document.createElement("div");
  header.className = "tiptap-table-size-picker-header";
  const title = document.createElement("span");
  title.textContent = labels.sizePickerLabel;
  const dimensions = document.createElement("output");
  dimensions.className = "tiptap-table-size-picker-dimensions";
  dimensions.setAttribute("aria-live", "polite");
  header.appendChild(title);
  header.appendChild(dimensions);
  picker.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "tiptap-table-size-grid";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", labels.sizePickerLabel);
  picker.appendChild(grid);

  let selectedRows = DEFAULT_ROWS;
  let selectedColumns = DEFAULT_COLUMNS;
  let closed = false;
  const cells: HTMLButtonElement[][] = [];

  function labelFor(rows: number, columns: number): string {
    return formatSizeLabel(labels.insertTableSize, rows, columns);
  }

  function updateSelection(rows: number, columns: number): void {
    selectedRows = Math.min(Math.max(rows, 1), MAX_ROWS);
    selectedColumns = Math.min(Math.max(columns, 1), MAX_COLUMNS);
    dimensions.textContent = `${selectedRows} × ${selectedColumns}`;
    picker.setAttribute(
      "aria-label",
      `${labels.sizePickerLabel}: ${labelFor(selectedRows, selectedColumns)}`,
    );

    for (let row = 1; row <= MAX_ROWS; row += 1) {
      for (let column = 1; column <= MAX_COLUMNS; column += 1) {
        const cell = cells[row - 1]?.[column - 1];
        if (!cell) continue;
        const isCurrent = row === selectedRows && column === selectedColumns;
        cell.classList.toggle(
          "is-selected",
          row <= selectedRows && column <= selectedColumns,
        );
        cell.classList.toggle("is-current", isCurrent);
        cell.tabIndex = isCurrent ? 0 : -1;
        cell.setAttribute("aria-selected", String(isCurrent));
      }
    }
  }

  function focusSelection(): void {
    cells[selectedRows - 1]?.[selectedColumns - 1]?.focus();
  }

  function insertTable(): void {
    if (closed) return;
    close(false);
    editor
      .chain()
      .focus()
      .setTextSelection(insertPosition)
      .insertTable({
        rows: selectedRows,
        cols: selectedColumns,
        withHeaderRow: true,
      })
      .run();
  }

  function onKeydown(event: KeyboardEvent): void {
    let nextRows = selectedRows;
    let nextColumns = selectedColumns;
    if (event.key === "ArrowUp") nextRows -= 1;
    else if (event.key === "ArrowDown") nextRows += 1;
    else if (event.key === "ArrowLeft") nextColumns -= 1;
    else if (event.key === "ArrowRight") nextColumns += 1;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      insertTable();
      return;
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    } else {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    updateSelection(nextRows, nextColumns);
    focusSelection();
  }

  for (let row = 1; row <= MAX_ROWS; row += 1) {
    const rowElement = document.createElement("div");
    rowElement.className = "tiptap-table-size-grid-row";
    rowElement.setAttribute("role", "row");
    const rowCells: HTMLButtonElement[] = [];
    for (let column = 1; column <= MAX_COLUMNS; column += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "tiptap-table-size-cell";
      cell.dataset.row = String(row);
      cell.dataset.column = String(column);
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", labelFor(row, column));
      cell.addEventListener("pointerenter", () => {
        updateSelection(row, column);
      });
      cell.addEventListener("focus", () => {
        updateSelection(row, column);
      });
      cell.addEventListener("keydown", onKeydown);
      cell.addEventListener("click", insertTable);
      rowElement.appendChild(cell);
      rowCells.push(cell);
    }
    cells.push(rowCells);
    grid.appendChild(rowElement);
  }

  function positionPicker(): void {
    if (closed) return;
    const coords = editor.view.coordsAtPos(insertPosition);
    const rect = picker.getBoundingClientRect();
    const layout = getFloatingPosition({
      anchorRect: {
        left: coords.left,
        right: coords.right,
        top: coords.top,
        bottom: coords.bottom,
      },
      containerRect: getFixedFloatingContainerRect(dialog),
      floatingWidth: rect.width,
      floatingHeight: rect.height,
      preferredPlacement: "bottom",
      fallbackPlacement: "top",
      align: "start",
    });
    picker.style.left = `${layout.left}px`;
    picker.style.top = `${layout.top}px`;
    picker.dataset.placement = layout.placement;
  }

  function onOutsidePointer(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Node && !picker.contains(target)) {
      close(false);
    }
  }

  function onOutsideFocus(event: globalThis.FocusEvent): void {
    const target = event.target;
    if (
      target instanceof Node &&
      !picker.contains(target) &&
      !editor.view.dom.contains(target)
    ) {
      close(false);
    }
  }

  function onEditorDestroy(): void {
    close(false);
  }

  function close(restoreFocus = false): void {
    if (closed) return;
    closed = true;
    document.removeEventListener("mousedown", onOutsidePointer, true);
    document.removeEventListener("focusin", onOutsideFocus, true);
    window.removeEventListener("resize", positionPicker);
    window.removeEventListener("scroll", positionPicker, true);
    editor.off("destroy", onEditorDestroy);
    picker.remove();
    if (activePicker?.close === close) activePicker = null;
    if (restoreFocus && !editor.isDestroyed) editor.view.focus();
  }

  activePicker = { close };
  container.appendChild(picker);
  updateSelection(DEFAULT_ROWS, DEFAULT_COLUMNS);
  positionPicker();
  window.addEventListener("resize", positionPicker);
  window.addEventListener("scroll", positionPicker, true);
  editor.on("destroy", onEditorDestroy);
  setTimeout(() => {
    if (closed) return;
    document.addEventListener("mousedown", onOutsidePointer, true);
    document.addEventListener("focusin", onOutsideFocus, true);
    focusSelection();
  }, 0);
}
