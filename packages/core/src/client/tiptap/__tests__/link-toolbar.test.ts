// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { BubbleMenu } from "../bubble-menu.js";
import { LinkToolbar } from "../link-toolbar.js";

const editors: Editor[] = [];

function requireElement<T extends globalThis.Element>(
  element: T | null,
  message: string,
): T {
  if (!element) {
    throw new Error(message);
  }
  return element;
}

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
      BubbleMenu.configure({ toolbarMode: "compose" }),
      LinkToolbar,
    ],
    content: "<p>Hello world</p>",
  });

  vi.spyOn(editor.view, "coordsAtPos").mockImplementation(() => ({
    left: 120,
    right: 180,
    top: 120,
    bottom: 140,
  }));

  editors.push(editor);
  return editor;
}

afterEach(() => {
  vi.restoreAllMocks();
  while (editors.length > 0) {
    editors.pop()?.destroy();
  }
  document.body.innerHTML = "";
});

describe("LinkToolbar", () => {
  it("collapses the selection to the link end after confirming with Enter", async () => {
    const editor = createEditor();

    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.view.dom.dispatchEvent(new CustomEvent("tiptap:open-link-input"));

    const input = requireElement(
      document.querySelector<HTMLInputElement>(".tiptap-link-input-field"),
      "expected link input field",
    );

    input.value = "https://example.com";
    input.dispatchEvent(
      new globalThis.KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      }),
    );

    await Promise.resolve();

    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection.from).toBe(6);
    expect(editor.state.selection.to).toBe(6);
    expect(editor.isActive("link")).toBe(false);
    expect(
      document.querySelector<HTMLElement>(".tiptap-link-input")?.style.display,
    ).toBe("none");
    expect(
      document.querySelector<HTMLElement>(".tiptap-bubble-menu")?.style.display,
    ).toBe("none");
  });

  it("auto-shows an unfocused popup when the cursor lands on a link", async () => {
    const editor = createEditor();

    // Create a link first (via the open event path).
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.view.dom.dispatchEvent(new CustomEvent("tiptap:open-link-input"));
    const urlInput = requireElement(
      document.querySelector<HTMLInputElement>(".tiptap-link-input-field"),
      "expected url field",
    );
    urlInput.value = "https://example.com";
    urlInput.dispatchEvent(
      new globalThis.KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      }),
    );
    await Promise.resolve();

    // Move cursor off the link, then back inside it.
    editor.commands.setTextSelection(10);
    await Promise.resolve();
    editor.commands.setTextSelection(3);
    await Promise.resolve();

    const popup = requireElement(
      document.querySelector<HTMLElement>(".tiptap-link-input"),
      "expected link popup",
    );
    expect(popup.style.display).toBe("flex");
    // Popup is shown but did NOT steal focus from the editor.
    const textField = requireElement(
      document.querySelector<HTMLInputElement>(".tiptap-link-input-text"),
      "expected text field",
    );
    expect(document.activeElement).not.toBe(textField);
    expect(document.activeElement).not.toBe(urlInput);
    expect(textField.value).toBe("Hello");
    expect(urlInput.value).toBe("https://example.com");
  });

  it("removes the link when URL is cleared and confirmed", async () => {
    const editor = createEditor();

    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.view.dom.dispatchEvent(new CustomEvent("tiptap:open-link-input"));
    const urlInput = requireElement(
      document.querySelector<HTMLInputElement>(".tiptap-link-input-field"),
      "expected url field",
    );
    urlInput.value = "https://example.com";
    urlInput.dispatchEvent(
      new globalThis.KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      }),
    );
    await Promise.resolve();

    // Now move cursor into the link — popup re-appears with current values.
    editor.commands.setTextSelection(3);
    await Promise.resolve();

    urlInput.value = "";
    urlInput.dispatchEvent(
      new globalThis.KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      }),
    );
    await Promise.resolve();

    // Text is preserved, link mark is gone.
    expect(editor.state.doc.textContent).toBe("Hello world");
    const linkMark = editor.state.doc
      .nodeAt(1)
      ?.marks.find((m) => m.type.name === "link");
    expect(linkMark).toBeUndefined();
  });

  it("opens the popover when a link is clicked (tap on mobile)", async () => {
    const editor = createEditor();

    // Create a link, then move the caret off it and dismiss the popover.
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.view.dom.dispatchEvent(new CustomEvent("tiptap:open-link-input"));
    const urlInput = requireElement(
      document.querySelector<HTMLInputElement>(".tiptap-link-input-field"),
      "expected url field",
    );
    urlInput.value = "https://example.com";
    urlInput.dispatchEvent(
      new globalThis.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await Promise.resolve();

    editor.commands.setTextSelection(10);
    await Promise.resolve();
    editor.commands.blur();
    const popup = requireElement(
      document.querySelector<HTMLElement>(".tiptap-link-input"),
      "expected link popup",
    );
    popup.style.display = "none";

    // Clicking the rendered link re-opens the popover without a prior caret
    // move — this is the path that was broken on touch devices.
    const anchor = requireElement(
      editor.view.dom.querySelector<HTMLAnchorElement>("a"),
      "expected rendered link",
    );
    anchor.dispatchEvent(
      new globalThis.MouseEvent("click", { bubbles: true, button: 0 }),
    );
    await Promise.resolve();

    expect(popup.style.display).toBe("flex");
    expect(urlInput.value).toBe("https://example.com");
    expect(editor.state.selection.empty).toBe(true);
  });

  it("replaces the link text when the text field is edited", async () => {
    const editor = createEditor();

    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.view.dom.dispatchEvent(new CustomEvent("tiptap:open-link-input"));

    const textInput = requireElement(
      document.querySelector<HTMLInputElement>(".tiptap-link-input-text"),
      "expected link text field",
    );
    const urlInput = requireElement(
      document.querySelector<HTMLInputElement>(".tiptap-link-input-field"),
      "expected link url field",
    );

    expect(textInput.value).toBe("Hello");

    textInput.value = "苹果派";
    urlInput.value = "https://example.com";
    urlInput.dispatchEvent(
      new globalThis.KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      }),
    );

    await Promise.resolve();

    // Paragraph text should now be "苹果派 world"
    expect(editor.state.doc.textContent).toBe("苹果派 world");
    // Link mark applied over the new text range [1, 4]
    const linkMark = editor.state.doc
      .nodeAt(1)
      ?.marks.find((m) => m.type.name === "link");
    expect(linkMark?.attrs.href).toBe("https://example.com");
    // Cursor at end of inserted text
    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection.from).toBe(4);
  });
});
