// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { ImageNode } from "../image-node.js";
import { MoreBreak } from "../more-break.js";

const editors: Editor[] = [];

function createEditor() {
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
      MoreBreak,
    ],
    content: "<p></p>",
  });

  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length > 0) {
    editors.pop()?.destroy();
  }
  document.body.innerHTML = "";
});

describe("Block insertion flow", () => {
  it("moves the cursor into the next paragraph after inserting read more", () => {
    const editor = createEditor();

    editor.commands.focus("start");

    expect(editor.commands.insertMoreBreak()).toBe(true);
    expect(editor.state.doc.firstChild?.type.name).toBe("moreBreak");
    expect(editor.state.doc.lastChild?.type.name).toBe("paragraph");
    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    expect(editor.state.selection.$from.parentOffset).toBe(0);
  });

  it("moves the cursor into the next paragraph after inserting an image", () => {
    const editor = createEditor();

    editor.commands.focus("start");

    expect(editor.commands.setImage({ src: "/uploads/test.webp" })).toBe(true);
    expect(editor.state.doc.firstChild?.type.name).toBe("image");
    expect(editor.state.doc.lastChild?.type.name).toBe("paragraph");
    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    expect(editor.state.selection.$from.parentOffset).toBe(0);
  });

  it("renders a removable placeholder when an image fails to load", () => {
    const editor = createEditor();

    editor.commands.focus("start");
    expect(editor.commands.setImage({ src: "/uploads/missing.webp" })).toBe(
      true,
    );

    const figure = document.querySelector<HTMLElement>(".tiptap-image-figure");
    const img = figure?.querySelector<HTMLImageElement>("img");
    if (!figure || !img) {
      throw new Error("expected image node view");
    }

    img.dispatchEvent(new Event("error"));

    expect(figure.dataset.loadState).toBe("missing");
    expect(figure.textContent).toContain("Image unavailable");

    const deleteButton = figure.querySelector<HTMLButtonElement>(
      ".tiptap-image-missing-delete",
    );
    if (!deleteButton) {
      throw new Error("expected broken image delete button");
    }

    deleteButton.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );

    expect(
      editor.getJSON().content?.some((node) => node.type === "image"),
    ).toBe(false);
  });
});
