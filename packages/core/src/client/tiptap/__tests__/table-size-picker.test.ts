// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import { createEditorExtensions } from "../extensions.js";
import { getSlashCommands } from "../slash-commands.js";
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
    extensions: createEditorExtensions({
      toolbarMode: "compose",
      tableControlLabels: DEFAULT_TABLE_CONTROL_LABELS,
    }),
    content: "<p>/table</p>",
  });
  vi.spyOn(editor.view, "coordsAtPos").mockImplementation(() => ({
    left: 80,
    right: 100,
    top: 120,
    bottom: 140,
  }));
  editor.commands.setTextSelection(7);
  editors.push(editor);
  return editor;
}

function openPicker(editor: Editor): HTMLElement {
  const tableCommand = getSlashCommands(editor).find(
    (item) => item.label === "Table",
  );
  if (!tableCommand) throw new Error("expected Table slash command");
  tableCommand.command(editor, { from: 1, to: 7 });
  return requireElement(
    document.querySelector<HTMLElement>(".tiptap-table-size-picker"),
    "expected table size picker",
  );
}

function tableJson(editor: Editor): JSONContent | undefined {
  return editor.getJSON().content?.find((node) => node.type === "table");
}

function tableDimensions(editor: Editor): { rows: number; columns: number } {
  const rows = tableJson(editor)?.content ?? [];
  return { rows: rows.length, columns: rows[0]?.content?.length ?? 0 };
}

afterEach(() => {
  vi.restoreAllMocks();
  while (editors.length > 0) editors.pop()?.destroy();
  document.body.innerHTML = "";
});

describe("table size picker", () => {
  it("opens at 3 by 3 without inserting a table immediately", () => {
    const editor = createEditor();
    const picker = openPicker(editor);

    expect(editor.getText()).toBe("");
    expect(tableJson(editor)).toBeUndefined();
    expect(picker.getAttribute("aria-label")).toContain("Insert 3 by 3 table");
    expect(
      picker.querySelectorAll(".tiptap-table-size-cell.is-selected"),
    ).toHaveLength(9);
    expect(
      picker.querySelector<HTMLButtonElement>(
        '.tiptap-table-size-cell[data-row="3"][data-column="3"]',
      )?.tabIndex,
    ).toBe(0);
  });

  it("inserts the pointer-selected dimensions with a header row", () => {
    const editor = createEditor();
    const picker = openPicker(editor);
    const target = requireElement(
      picker.querySelector<HTMLButtonElement>(
        '.tiptap-table-size-cell[data-row="4"][data-column="5"]',
      ),
      "expected 4 by 5 option",
    );
    target.dispatchEvent(
      new globalThis.PointerEvent("pointerenter", { bubbles: true }),
    );
    target.click();

    expect(tableDimensions(editor)).toEqual({ rows: 4, columns: 5 });
    expect(tableJson(editor)?.content?.[0]?.content?.[0]?.type).toBe(
      "tableHeader",
    );
    expect(document.querySelector(".tiptap-table-size-picker")).toBeNull();
  });

  it("supports bounded arrow navigation and Enter insertion", async () => {
    const editor = createEditor();
    const picker = openPicker(editor);
    await vi.waitFor(() => {
      expect(document.activeElement?.getAttribute("data-row")).toBe("3");
    });
    const current = () =>
      requireElement(
        picker.querySelector<HTMLButtonElement>(
          ".tiptap-table-size-cell.is-current",
        ),
        "expected current size",
      );

    current().dispatchEvent(
      new globalThis.KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
      }),
    );
    current().dispatchEvent(
      new globalThis.KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
      }),
    );
    current().dispatchEvent(
      new globalThis.KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      }),
    );

    expect(tableDimensions(editor)).toEqual({ rows: 4, columns: 4 });
  });

  it("cancels on Escape and restores editor focus", async () => {
    const editor = createEditor();
    openPicker(editor);
    await vi.waitFor(() => {
      expect(document.activeElement?.getAttribute("data-row")).toBe("3");
    });
    document.activeElement?.dispatchEvent(
      new globalThis.KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(document.querySelector(".tiptap-table-size-picker")).toBeNull();
    expect(tableJson(editor)).toBeUndefined();
    expect(editor.view.hasFocus()).toBe(true);
  });

  it("cancels on outside click and cleans up when the editor is destroyed", async () => {
    const editor = createEditor();
    openPicker(editor);
    await vi.waitFor(() => {
      expect(document.activeElement?.getAttribute("data-row")).toBe("3");
    });
    document.body.dispatchEvent(
      new globalThis.MouseEvent("mousedown", { bubbles: true }),
    );
    expect(document.querySelector(".tiptap-table-size-picker")).toBeNull();

    editor.commands.setContent("<p>/table</p>");
    editor.commands.setTextSelection(7);
    openPicker(editor);
    editor.destroy();
    expect(document.querySelector(".tiptap-table-size-picker")).toBeNull();
  });
});
