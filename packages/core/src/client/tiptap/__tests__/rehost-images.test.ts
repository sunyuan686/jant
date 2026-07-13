// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { ImageNode } from "../image-node.js";
import { RehostImages, clearRehostInFlight } from "../rehost-images.js";

const editors: Editor[] = [];
const usedSrcs: string[] = [];

/** Mirrors the predicate the compose editor passes to the extension. */
function shouldRehost(src: string): boolean {
  if (src.startsWith("data:")) return true;
  if (!/^https?:\/\//i.test(src)) return false;
  let origin: string;
  try {
    origin = new URL(src).origin;
  } catch {
    return false;
  }
  if (origin === window.location.origin) return false;
  const mediaBase = document.documentElement.dataset.mediaBase;
  if (mediaBase && src.startsWith(mediaBase)) return false;
  return true;
}

function createEditor(rehost: (src: string) => void): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: false },
      }),
      ImageNode,
      RehostImages.configure({ shouldRehost, rehost }),
    ],
    content: "<p></p>",
  });
  editors.push(editor);
  return editor;
}

/** Track a src so the module-level in-flight set is reset between tests. */
function track(src: string): string {
  usedSrcs.push(src);
  return src;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

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

afterEach(() => {
  while (editors.length > 0) editors.pop()?.destroy();
  for (const src of usedSrcs) clearRehostInFlight(src);
  usedSrcs.length = 0;
  document.body.innerHTML = "";
  delete document.documentElement.dataset.mediaBase;
  vi.restoreAllMocks();
});

describe("RehostImages extension", () => {
  it("fires rehost once for a pasted remote image", async () => {
    const rehost = vi.fn();
    const editor = createEditor(rehost);
    const src = track("https://ext.example/a-remote.png");

    dispatchPaste(editor, `<p><img src="${src}"></p>`);
    await flush();

    expect(rehost).toHaveBeenCalledTimes(1);
    expect(rehost).toHaveBeenCalledWith(src);
  });

  it("fires rehost for a data: URL", async () => {
    const rehost = vi.fn();
    const editor = createEditor(rehost);
    const src = track("data:image/png;base64,AAAAb");

    dispatchPaste(editor, `<p><img src="${src}"></p>`);
    await flush();

    expect(rehost).toHaveBeenCalledWith(src);
  });

  it("skips same-origin, relative, blob, and media-base images", async () => {
    const rehost = vi.fn();
    document.documentElement.dataset.mediaBase = "https://cdn.mysite.test";
    const editor = createEditor(rehost);
    const sameOrigin = track(`${window.location.origin}/m/x.png`);
    const relative = track("/relative/y.png");
    const blob = track("blob:abc-123");
    const mediaBase = track("https://cdn.mysite.test/z.png");

    dispatchPaste(
      editor,
      `<p><img src="${sameOrigin}"><img src="${relative}"><img src="${blob}"><img src="${mediaBase}"></p>`,
    );
    await flush();

    expect(rehost).not.toHaveBeenCalled();
  });

  it("dedupes identical remote srcs in one document", async () => {
    const rehost = vi.fn();
    const editor = createEditor(rehost);
    const src = track("https://ext.example/dupe.png");

    dispatchPaste(editor, `<p><img src="${src}"><img src="${src}"></p>`);
    await flush();

    expect(rehost).toHaveBeenCalledTimes(1);
  });

  it("does not rehost remote images loaded through setContent", async () => {
    const rehost = vi.fn();
    const editor = createEditor(rehost);
    const src = track("https://ext.example/saved-external.png");

    editor.commands.setContent({
      type: "doc",
      content: [
        { type: "paragraph" },
        {
          type: "image",
          attrs: { src },
        },
      ],
    });
    await flush();

    expect(rehost).not.toHaveBeenCalled();
  });

  it("does not retry a failed paste rehost on later edits", async () => {
    const rehost = vi.fn();
    const editor = createEditor(rehost);
    const src = track("https://ext.example/blocked.png");

    dispatchPaste(editor, `<p><img src="${src}"></p>`);
    await flush();
    expect(rehost).toHaveBeenCalledTimes(1);

    clearRehostInFlight(src);
    editor.commands.insertContent("later edit");
    await flush();

    expect(rehost).toHaveBeenCalledTimes(1);
  });

  it("does not re-trigger after the src is swapped to a local URL", async () => {
    const rehost = vi.fn();
    const editor = createEditor(rehost);
    const src = track("https://ext.example/swap.png");

    dispatchPaste(editor, `<p><img src="${src}"></p>`);
    await flush();
    expect(rehost).toHaveBeenCalledTimes(1);

    editor.commands.setContent({
      type: "doc",
      content: [
        { type: "paragraph" },
        {
          type: "image",
          attrs: { src: `${window.location.origin}/m/swap.png` },
        },
      ],
    });
    await flush();

    expect(rehost).toHaveBeenCalledTimes(1);
  });
});
