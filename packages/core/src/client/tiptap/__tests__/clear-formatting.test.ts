// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { createMarkdownContentExtensions } from "../../../lib/markdown-manager.js";
import { clearFormatting } from "../bubble-menu.js";

const editors: Editor[] = [];

function createEditor(content: string): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);

  const editor = new Editor({
    element,
    extensions: createMarkdownContentExtensions(),
    content,
  });

  editor.view.dispatch(editor.state.tr);
  editors.push(editor);
  return editor;
}

function selectText(editor: Editor, fromText: string, toText = fromText): void {
  let from: number | null = null;
  let to: number | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    if (from === null && node.text?.includes(fromText)) {
      from = pos;
    }
    if (node.text?.includes(toText)) {
      to = pos + node.nodeSize;
    }
  });

  if (from === null || to === null) {
    throw new Error(`Text selection not found: ${fromText} → ${toText}`);
  }

  editor.view.dispatch(
    editor.state.tr.setSelection(
      TextSelection.create(editor.state.doc, from, to),
    ),
  );
}

function getMarkNames(editor: Editor): string[] {
  const markNames: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.isText) {
      markNames.push(...node.marks.map((mark) => mark.type.name));
    }
  });
  return markNames;
}

afterEach(() => {
  while (editors.length > 0) editors.pop()?.destroy();
  document.body.innerHTML = "";
});

describe("clear formatting", () => {
  it("converts selected headings to paragraphs and preserves semantic links", () => {
    const editor = createEditor(
      '<h2><a href="https://example.com"><strong>Heading</strong></a></h2>',
    );
    selectText(editor, "Heading");

    clearFormatting(editor);

    const paragraph = editor.state.doc.firstChild;
    const linkedText = paragraph?.firstChild;
    expect(paragraph?.type.name).toBe("paragraph");
    expect(linkedText?.marks.map((mark) => mark.type.name)).toEqual(["link"]);
    expect(linkedText?.marks[0]?.attrs.href).toBe("https://example.com");
  });

  it("unwraps a blockquote without flattening its nested ordered list", () => {
    const editor = createEditor(
      '<blockquote><ol start="5"><li><p><a href="https://example.com"><strong>Five</strong></a></p><ol><li><p>Nested</p></li></ol></li><li><p><em>Six</em></p></li></ol></blockquote>',
    );
    selectText(editor, "Five", "Six");

    clearFormatting(editor);

    const outerList = editor.state.doc.firstChild;
    expect(outerList?.type.name).toBe("orderedList");
    expect(outerList?.attrs.start).toBe(5);
    expect(outerList?.childCount).toBe(2);
    expect(outerList?.child(0).lastChild?.type.name).toBe("orderedList");
    expect(outerList?.child(0).lastChild?.firstChild?.textContent).toBe(
      "Nested",
    );
    const linkedText = outerList?.child(0).firstChild?.firstChild;
    expect(linkedText?.marks.map((mark) => mark.type.name)).toEqual(["link"]);
    expect(linkedText?.marks[0]?.attrs.href).toBe("https://example.com");
    expect(editor.isActive("bold")).toBe(false);
    expect(editor.isActive("italic")).toBe(false);
  });

  it("clears headings and blockquotes across a mixed block selection", () => {
    const editor = createEditor(
      "<h2><strong>Heading</strong></h2><blockquote><p><em>Quote</em></p></blockquote><p><strong>Body</strong></p>",
    );
    selectText(editor, "Heading", "Body");

    clearFormatting(editor);

    expect(
      editor.state.doc.content.content.map((node) => node.type.name),
    ).toEqual(["paragraph", "paragraph", "paragraph"]);
    expect(getMarkNames(editor)).toEqual([]);
  });

  it("only unwraps the selected part of a multi-paragraph blockquote", () => {
    const editor = createEditor(
      "<blockquote><p>First</p><p><strong>Second</strong></p><p>Third</p></blockquote>",
    );
    selectText(editor, "Second");

    clearFormatting(editor);

    expect(editor.getJSON().content).toEqual([
      {
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "First" }],
          },
        ],
      },
      { type: "paragraph", content: [{ type: "text", text: "Second" }] },
      {
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Third" }],
          },
        ],
      },
      { type: "paragraph" },
    ]);
  });

  it("preserves code blocks and restores the whole clear with one undo", () => {
    const editor = createEditor(
      "<h3><strong>Heading</strong></h3><blockquote><p><em>Quote</em></p></blockquote><pre><code>const x = 1;\nnext();</code></pre>",
    );
    selectText(editor, "Heading", "next();");
    const before = editor.getJSON();

    clearFormatting(editor);

    expect(editor.state.doc.child(0).type.name).toBe("paragraph");
    expect(editor.state.doc.child(1).type.name).toBe("paragraph");
    expect(editor.state.doc.child(2).type.name).toBe("codeBlock");
    expect(editor.state.doc.child(2).textContent).toBe("const x = 1;\nnext();");

    expect(editor.commands.undo()).toBe(true);
    expect(editor.getJSON()).toEqual(before);
  });
});
