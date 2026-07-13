// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/core";
import type { ComposeLabels } from "../compose-types.js";
import "../jant-compose-editor.js";
import type { JantComposeEditor } from "../jant-compose-editor.js";

const labels = {
  bodyPlaceholder: "What's on your mind...",
  imageNotRehosted: "An image couldn't be saved — its original link was kept.",
  imagesNotRehosted:
    "{count} images couldn't be saved — their original links were kept.",
} as unknown as ComposeLabels;

function editorOf(el: JantComposeEditor): Editor {
  const editor = (el as unknown as { _editor?: Editor | null })._editor;
  if (!editor) throw new Error("expected compose editor instance");
  return editor;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function dispatchPaste(editor: Editor, html: string, text = "") {
  const event = new Event("paste", {
    bubbles: true,
    cancelable: true,
  }) as Event & { clipboardData: unknown };
  event.clipboardData = {
    getData: (type: string) =>
      type === "text/html" ? html : type === "text/plain" ? text : "",
    files: [],
    items: [],
    types: ["text/html", "text/plain"],
  };
  editor.commands.focus();
  editor.view.dom.dispatchEvent(event);
}

beforeEach(() => {
  const container = document.createElement("div");
  container.id = "toast-container";
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("compose editor: rehost failure notice", () => {
  it("shows an error toast when a pasted remote image can't be rehosted", async () => {
    // Server rejects the sideload (e.g. host hotlink protection).
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("blocked", { status: 403 })),
    );

    const el = document.createElement(
      "jant-compose-editor",
    ) as JantComposeEditor;
    el.format = "note";
    el.labels = labels;
    document.body.appendChild(el);
    await el.updateComplete;

    dispatchPaste(
      editorOf(el),
      '<p><img src="https://ext.example/blocked.png"></p>',
    );

    // Let the rehost fire, the sideload fail, then the debounce window elapse.
    await wait(50);
    await wait(900);

    const toast = document.querySelector("#toast-container .toast");
    expect(toast).not.toBeNull();
    expect(toast?.className).toContain("toast-error");
    expect(toast?.textContent ?? "").toContain("couldn't be saved");
  });
});
