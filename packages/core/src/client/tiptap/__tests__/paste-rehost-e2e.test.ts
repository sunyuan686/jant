// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { createTiptapEditor } from "../create-editor.js";
import type { Editor } from "@tiptap/core";

const editors: Editor[] = [];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  while (editors.length > 0) editors.pop()?.destroy();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

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
  editor.view.dom.dispatchEvent(event);
}

function imageSrcs(editor: Editor): string[] {
  const out: string[] = [];
  editor.state.doc.descendants((n) => {
    if (n.type.name === "image") out.push(n.attrs.src as string);
  });
  return out;
}

describe("paste → rehost end to end", () => {
  it("turns pasted article <img> into image nodes and triggers rehost", async () => {
    const rehost = vi.fn();
    const el = document.createElement("div");
    document.body.appendChild(el);
    const editor = createTiptapEditor({
      element: el,
      rehostImages: { shouldRehost: () => true, rehost },
    });
    editors.push(editor);
    editor.commands.focus();

    const html =
      "<p>正文段落一</p>" +
      '<p><img src="https://img1.doubanio.com/view/photo/l/public/p1.jpg"></p>' +
      "<p>正文段落二</p>";
    dispatchPaste(editor, html);
    await flush();

    expect(imageSrcs(editor)).toContain(
      "https://img1.doubanio.com/view/photo/l/public/p1.jpg",
    );
    expect(rehost).toHaveBeenCalledWith(
      "https://img1.doubanio.com/view/photo/l/public/p1.jpg",
    );
  });
});
