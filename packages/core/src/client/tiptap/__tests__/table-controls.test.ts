// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import { createMarkdownContentExtensions } from "../../../lib/markdown-manager.js";
import { TableControls } from "../table-controls.js";
import { DEFAULT_TABLE_CONTROL_LABELS } from "../table-control-labels.js";

const editors: Editor[] = [];

function requireElement<T extends globalThis.Element>(
  element: T | null,
  message: string,
): T {
  if (!element) throw new Error(message);
  return element;
}

function createEditor(): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: [
      ...createMarkdownContentExtensions(),
      TableControls.configure({ labels: DEFAULT_TABLE_CONTROL_LABELS }),
    ],
    content: "<p></p>",
  });
  vi.spyOn(editor.view, "coordsAtPos").mockImplementation(() => ({
    left: 80,
    right: 100,
    top: 120,
    bottom: 140,
  }));
  editors.push(editor);
  return editor;
}

function tableJson(editor: Editor): JSONContent {
  const table = editor.getJSON().content?.find((node) => node.type === "table");
  if (!table) throw new Error("expected table JSON");
  return table;
}

function tableDimensions(editor: Editor): { rows: number; columns: number } {
  const table = tableJson(editor);
  const rows = table.content ?? [];
  return {
    rows: rows.length,
    columns: rows[0]?.content?.length ?? 0,
  };
}

function cursorPositionInRow(editor: Editor, targetRow: number): number {
  let row = -1;
  let position: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "tableRow") row += 1;
    if (
      position === null &&
      row === targetRow &&
      (node.type.name === "tableCell" || node.type.name === "tableHeader")
    ) {
      position = pos + 2;
      return false;
    }
    return position === null;
  });
  if (position === null) throw new Error(`expected row ${targetRow}`);
  return position;
}

async function focusTable(editor: Editor, rows = 3, columns = 3) {
  editor.commands.focus();
  editor.commands.insertTable({
    rows,
    cols: columns,
    withHeaderRow: true,
  });
  await vi.waitFor(() => {
    expect(
      document.querySelector<HTMLElement>(".tiptap-table-controls")?.style
        .display,
    ).toBe("flex");
  });
}

function clickButton(label: string): HTMLButtonElement {
  const button = requireElement(
    document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`),
    `expected ${label} button`,
  );
  button.dispatchEvent(
    new globalThis.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      detail: 1,
    }),
  );
  return button;
}

afterEach(() => {
  vi.restoreAllMocks();
  while (editors.length > 0) editors.pop()?.destroy();
  document.body.innerHTML = "";
});

describe("TableControls", () => {
  it("appears only while the focused selection is inside a table", async () => {
    const editor = createEditor();
    const toolbar = requireElement(
      document.querySelector<HTMLElement>(".tiptap-table-controls"),
      "expected table toolbar",
    );
    expect(toolbar.style.display).toBe("none");

    await focusTable(editor);
    expect(toolbar.style.display).toBe("flex");

    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    await vi.waitFor(() => expect(toolbar.style.display).toBe("none"));
  });

  it("adds rows and columns without losing the active table selection", async () => {
    const editor = createEditor();
    await focusTable(editor);
    const selectionBefore = editor.state.selection.from;
    const addColumn = requireElement(
      document.querySelector<HTMLButtonElement>(
        'button[aria-label="Add column after"]',
      ),
      "expected add-column button",
    );
    const pointerDown = new globalThis.MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    addColumn.dispatchEvent(pointerDown);
    expect(pointerDown.defaultPrevented).toBe(true);
    expect(editor.state.selection.from).toBe(selectionBefore);

    addColumn.dispatchEvent(
      new globalThis.MouseEvent("click", { bubbles: true, detail: 1 }),
    );
    expect(tableDimensions(editor)).toEqual({ rows: 3, columns: 4 });
    clickButton("Add row below");
    expect(tableDimensions(editor)).toEqual({ rows: 4, columns: 4 });
  });

  it("offers complete structural actions and protects the last row and column", async () => {
    const editor = createEditor();
    await focusTable(editor, 2, 2);

    clickButton("Table options");
    expect(
      document.querySelector<HTMLElement>(".tiptap-table-options")?.hidden,
    ).toBe(false);
    clickButton("Add row above");
    expect(tableDimensions(editor)).toEqual({ rows: 3, columns: 2 });

    clickButton("Table options");
    clickButton("Delete row");
    clickButton("Table options");
    clickButton("Delete row");
    expect(tableDimensions(editor)).toEqual({ rows: 1, columns: 2 });

    editor.commands.setTextSelection(cursorPositionInRow(editor, 0));
    clickButton("Table options");
    expect(
      document.querySelector<HTMLButtonElement>(
        'button[aria-label="Delete row"]',
      )?.disabled,
    ).toBe(true);
    expect(
      document.querySelector<HTMLButtonElement>(
        'button[aria-label="Delete column"]',
      )?.disabled,
    ).toBe(false);
    clickButton("Delete column");
    expect(tableDimensions(editor)).toEqual({ rows: 1, columns: 1 });

    clickButton("Table options");
    expect(
      document.querySelector<HTMLButtonElement>(
        'button[aria-label="Delete column"]',
      )?.disabled,
    ).toBe(true);
  });

  it("toggles the first header row even when the caret is in a later row", async () => {
    const editor = createEditor();
    await focusTable(editor, 3, 2);
    editor.commands.setTextSelection(cursorPositionInRow(editor, 1));

    clickButton("Table options");
    clickButton("Toggle header row");
    let rows = tableJson(editor).content ?? [];
    expect(rows[0]?.content?.map((cell) => cell.type)).toEqual([
      "tableCell",
      "tableCell",
    ]);
    expect(rows[1]?.content?.[0]?.type).toBe("tableCell");

    clickButton("Table options");
    clickButton("Toggle header row");
    rows = tableJson(editor).content ?? [];
    expect(rows[0]?.content?.map((cell) => cell.type)).toEqual([
      "tableHeader",
      "tableHeader",
    ]);
  });

  it("supports keyboard entry and Escape focus restoration", async () => {
    const editor = createEditor();
    await focusTable(editor);
    const shortcut = new globalThis.KeyboardEvent("keydown", {
      key: "F10",
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    editor.view.dom.dispatchEvent(shortcut);
    expect(shortcut.defaultPrevented).toBe(true);
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Add row below",
    );

    document.activeElement?.dispatchEvent(
      new globalThis.KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(editor.view.hasFocus()).toBe(true);
  });

  it("dismisses options outside the editor and removes floating DOM on destroy", async () => {
    const editor = createEditor();
    await focusTable(editor);
    clickButton("Table options");
    requireElement(
      editor.view.dom.querySelector<HTMLElement>("td, th"),
      "expected table cell",
    ).dispatchEvent(new globalThis.MouseEvent("mousedown", { bubbles: true }));
    expect(
      document.querySelector<HTMLElement>(".tiptap-table-options")?.hidden,
    ).toBe(true);

    clickButton("Table options");
    document.body.dispatchEvent(
      new globalThis.MouseEvent("mousedown", { bubbles: true }),
    );
    expect(
      document.querySelector<HTMLElement>(".tiptap-table-options")?.hidden,
    ).toBe(true);

    editor.destroy();
    expect(document.querySelector(".tiptap-table-controls")).toBeNull();
  });
});
