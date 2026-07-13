// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { ImageInputRules } from "../image-input-rules.js";
import { ImageNode } from "../image-node.js";
import { LinkInputRules } from "../link-input-rules.js";

const editors: Editor[] = [];

function createEditor(): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);

  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: false },
      }),
      LinkInputRules,
      ImageNode,
      ImageInputRules,
    ],
    content: "<p></p>",
  });

  editors.push(editor);
  return editor;
}

function type(editor: Editor, text: string): void {
  const view = editor.view;
  for (const ch of text) {
    const { from, to } = view.state.selection;
    const handled = view.someProp("handleTextInput", (handler) =>
      handler(view, from, to, ch, () => view.state.tr.insertText(ch, from, to)),
    );
    if (!handled) view.dispatch(view.state.tr.insertText(ch, from, to));
  }
}

afterEach(() => {
  while (editors.length > 0) {
    editors.pop()?.destroy();
  }
  document.body.innerHTML = "";
});

describe("ImageInputRules", () => {
  it("converts typed empty-alt Markdown image syntax into an image node", () => {
    const editor = createEditor();

    type(editor, "![](https://example.com/image.png)");

    expect(editor.getJSON().content).toEqual([
      {
        type: "image",
        attrs: {
          src: "https://example.com/image.png",
          alt: "",
          title: "",
          caption: "",
          href: "",
          layout: "regular",
        },
      },
      { type: "paragraph" },
    ]);
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
  });

  it("preserves alt text and optional quoted title", () => {
    const editor = createEditor();

    type(editor, '![A test image](https://example.com/image.png "Title")');

    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: "image",
      attrs: {
        src: "https://example.com/image.png",
        alt: "A test image",
        title: "Title",
      },
    });
  });

  it("runs before Markdown link rules", () => {
    const editor = createEditor();

    type(editor, "![Alt](https://example.com/image.png)");

    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: "image",
      attrs: {
        src: "https://example.com/image.png",
        alt: "Alt",
      },
    });
    expect(editor.state.doc.textContent).toBe("");
  });

  it("leaves unsafe image URLs as typed text", () => {
    const editor = createEditor();

    type(editor, "![](javascript:alert)");

    expect(editor.getJSON().content).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: "![](javascript:alert)" }],
      },
    ]);
  });
});
