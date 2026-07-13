// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { normalizeFootnoteArtifacts } from "../../../lib/footnotes.js";
import {
  MarkdownFootnoteDefinition,
  MarkdownFootnoteReference,
} from "../../../lib/markdown-manager.js";
import {
  createFootnoteInputRules,
  FOOTNOTE_DEFINITION_INPUT_REGEX,
  FOOTNOTE_REFERENCE_INPUT_REGEX,
  Footnotes,
} from "../footnotes.js";
import { getSlashCommands } from "../slash-commands.js";

const editors: Editor[] = [];

function createEditor(
  content: JSONContent = { type: "doc", content: [{ type: "paragraph" }] },
) {
  const element = document.createElement("div");
  document.body.appendChild(element);

  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: false },
      }),
      MarkdownFootnoteReference,
      MarkdownFootnoteDefinition,
      Footnotes,
    ],
    content,
  });

  editors.push(editor);
  return editor;
}

function dispatchInputRule(
  editor: Editor,
  ruleIndex: number,
  regex: RegExp,
  text: string,
) {
  const match = text.match(regex);
  if (!match) {
    throw new Error(`expected "${text}" to match ${regex}`);
  }

  const tr = editor.state.tr;
  const state = {
    doc: editor.state.doc,
    selection: editor.state.selection,
    schema: editor.state.schema,
    tr,
  } as typeof editor.state;
  const range = {
    from: editor.state.selection.from - match[0].length,
    to: editor.state.selection.from,
  };
  const rules = createFootnoteInputRules();
  const rule = rules[ruleIndex];
  if (!rule) {
    throw new Error(`missing rule at index ${ruleIndex}`);
  }

  rule.handler({
    state,
    range,
    match: match as never,
    commands: editor.commands,
    chain: () => editor.chain(),
    can: () => editor.can(),
  });
  editor.view.dispatch(tr);
}

function applyInputRule(
  editor: Editor,
  ruleIndex: number,
  regex: RegExp,
  text: string,
) {
  editor.commands.setContent({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: text ? [{ type: "text", text }] : [],
      },
    ],
  });
  editor.commands.focus("end");
  dispatchInputRule(editor, ruleIndex, regex, text);
}

function pressKey(editor: Editor, key: string): boolean {
  const event = new window.KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });
  let handled = false;

  editor.view.someProp("handleKeyDown", (handleKeyDown) => {
    if (handleKeyDown(editor.view, event)) {
      handled = true;
      return true;
    }

    return false;
  });

  return handled;
}

function pressEnter(editor: Editor): boolean {
  return pressKey(editor, "Enter");
}

function pressBackspace(editor: Editor): boolean {
  return pressKey(editor, "Backspace");
}

function pressDelete(editor: Editor): boolean {
  return pressKey(editor, "Delete");
}

function findFootnoteReferencePos(editor: Editor, label: string): number {
  let referencePos: number | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (
      referencePos === null &&
      node.type.name === "footnoteReference" &&
      node.attrs.label === label
    ) {
      referencePos = pos;
    }

    return true;
  });

  if (referencePos === null) {
    throw new Error(`expected footnote reference ${label}`);
  }

  return referencePos;
}

function clickFootnoteReference(editor: Editor, label: string): boolean {
  const pos = findFootnoteReferencePos(editor, label);
  const node = editor.state.doc.nodeAt(pos);
  if (!node) {
    throw new Error(`expected footnote reference node ${label}`);
  }

  const event = new window.MouseEvent("click", {
    bubbles: true,
    button: 0,
  });
  let handled = false;

  editor.view.someProp("handleClickOn", (handleClickOn) => {
    if (handleClickOn(editor.view, pos, node, pos, event, true)) {
      handled = true;
      return true;
    }

    return false;
  });

  return handled;
}

function clickBeforeFootnoteDefinition(editor: Editor, label: string): boolean {
  let definitionPos: number | null = null;

  editor.state.doc.forEach((node, offset) => {
    if (
      definitionPos === null &&
      node.type.name === "footnoteDefinition" &&
      node.attrs.label === label
    ) {
      definitionPos = offset;
    }
  });

  if (definitionPos === null) {
    throw new Error(`expected footnote definition ${label}`);
  }
  const targetPos = definitionPos;

  const event = new window.MouseEvent("click", {
    bubbles: true,
    button: 0,
  });
  let handled = false;

  editor.view.someProp("handleClick", (handleClick) => {
    if (handleClick(editor.view, targetPos, event)) {
      handled = true;
      return true;
    }

    return false;
  });

  return handled;
}

afterEach(() => {
  while (editors.length > 0) {
    editors.pop()?.destroy();
  }
  document.body.innerHTML = "";
});

describe("Footnotes editor extension", () => {
  it("adds an empty definition when initial content has only a reference", async () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body" },
            { type: "footnoteReference", attrs: { label: "1" } },
          ],
        },
      ],
    });

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(normalizeFootnoteArtifacts(editor.getJSON()).content?.[1]).toEqual({
      type: "footnoteDefinition",
      attrs: { label: "1" },
      content: [{ type: "paragraph" }],
    });
  });

  it("adds empty definitions for missing references after a document change", () => {
    const editor = createEditor();

    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body" },
            { type: "footnoteReference", attrs: { label: "Note" } },
            { type: "text", text: " and again" },
            { type: "footnoteReference", attrs: { label: "note" } },
          ],
        },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Nested" },
                { type: "footnoteReference", attrs: { label: "2" } },
              ],
            },
          ],
        },
      ],
    });

    expect(
      normalizeFootnoteArtifacts(editor.getJSON()).content?.slice(-2),
    ).toEqual([
      {
        type: "footnoteDefinition",
        attrs: { label: "Note" },
        content: [{ type: "paragraph" }],
      },
      {
        type: "footnoteDefinition",
        attrs: { label: "2" },
        content: [{ type: "paragraph" }],
      },
    ]);
  });

  it("does not duplicate an existing case-insensitive definition", () => {
    const editor = createEditor();

    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body" },
            { type: "footnoteReference", attrs: { label: "Note" } },
          ],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "note" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Existing note" }],
            },
          ],
        },
      ],
    });

    expect(
      editor
        .getJSON()
        .content?.filter((node) => node.type === "footnoteDefinition"),
    ).toHaveLength(1);
  });

  it("insertFootnote inserts a reference, appends a definition, and moves selection into the definition", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body copy" }],
        },
      ],
    });

    editor.commands.focus("end");

    expect(editor.commands.insertFootnote()).toBe(true);
    expect(normalizeFootnoteArtifacts(editor.getJSON())).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body copy" },
            { type: "footnoteReference", attrs: { label: "1" } },
          ],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "1" },
          content: [{ type: "paragraph" }],
        },
      ],
    });
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    expect(
      editor.state.selection.$from.node(editor.state.selection.$from.depth - 1)
        .type.name,
    ).toBe("footnoteDefinition");
  });

  it("clicking an orphan reference creates and focuses its definition", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body" },
            { type: "footnoteReference", attrs: { label: "1" } },
          ],
        },
      ],
    });
    expect(clickFootnoteReference(editor, "1")).toBe(true);

    expect(normalizeFootnoteArtifacts(editor.getJSON()).content?.[1]).toEqual({
      type: "footnoteDefinition",
      attrs: { label: "1" },
      content: [{ type: "paragraph" }],
    });
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    expect(
      editor.state.selection.$from.node(editor.state.selection.$from.depth - 1)
        .type.name,
    ).toBe("footnoteDefinition");
  });

  it("pressing Enter on a selected reference focuses its definition", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body" },
            { type: "footnoteReference", attrs: { label: "1" } },
          ],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "1" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Existing note" }],
            },
          ],
        },
      ],
    });
    editor.commands.setNodeSelection(findFootnoteReferencePos(editor, "1"));

    expect(pressEnter(editor)).toBe(true);
    expect(
      editor.state.selection.$from.node(editor.state.selection.$from.depth - 1)
        .type.name,
    ).toBe("footnoteDefinition");
  });

  it("clicking between adjacent definitions focuses the next definition", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body" }],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "1" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "First note" }],
            },
          ],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "2" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Second note" }],
            },
          ],
        },
      ],
    });

    expect(clickBeforeFootnoteDefinition(editor, "2")).toBe(true);

    const definitionNode = editor.state.selection.$from.node(
      editor.state.selection.$from.depth - 1,
    );
    expect(definitionNode.type.name).toBe("footnoteDefinition");
    expect(definitionNode.attrs.label).toBe("2");
  });

  it("assigns the next numeric label when a footnote already exists", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body copy" },
            { type: "footnoteReference", attrs: { label: "1" } },
          ],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "1" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Existing note" }],
            },
          ],
        },
      ],
    });

    const bodyEnd = (editor.state.doc.firstChild?.nodeSize ?? 2) - 1;
    editor.commands.setTextSelection(bodyEnd);

    expect(editor.commands.insertFootnote()).toBe(true);

    const paragraph = normalizeFootnoteArtifacts(editor.getJSON()).content?.[0];
    expect(paragraph?.type).toBe("paragraph");
    expect(paragraph?.content?.[2]).toEqual({
      type: "footnoteReference",
      attrs: { label: "2" },
    });
    expect(normalizeFootnoteArtifacts(editor.getJSON()).content?.[2]).toEqual({
      type: "footnoteDefinition",
      attrs: { label: "2" },
      content: [{ type: "paragraph" }],
    });
  });

  it("converts typed footnote references when followed by a delimiter", () => {
    const editor = createEditor();

    applyInputRule(editor, 1, FOOTNOTE_REFERENCE_INPUT_REGEX, "Body[^note] ");

    expect(normalizeFootnoteArtifacts(editor.getJSON())).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body" },
            { type: "footnoteReference", attrs: { label: "note" } },
            { type: "text", text: " " },
          ],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "note" },
          content: [{ type: "paragraph" }],
        },
      ],
    });
  });

  it("does not duplicate an existing definition when typing a matching reference", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body[^note] " }],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "note" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Existing note" }],
            },
          ],
        },
      ],
    });

    const bodyEnd = (editor.state.doc.firstChild?.nodeSize ?? 2) - 1;
    editor.commands.setTextSelection(bodyEnd);
    dispatchInputRule(
      editor,
      1,
      FOOTNOTE_REFERENCE_INPUT_REGEX,
      "Body[^note] ",
    );

    expect(normalizeFootnoteArtifacts(editor.getJSON())).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body" },
            { type: "footnoteReference", attrs: { label: "note" } },
            { type: "text", text: " " },
          ],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "note" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Existing note" }],
            },
          ],
        },
      ],
    });
  });

  it("converts a typed footnote reference at paragraph end on Enter and moves selection into the definition", () => {
    const editor = createEditor();

    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body[^note]" }],
        },
      ],
    });
    editor.commands.focus("end");

    expect(pressEnter(editor)).toBe(true);
    expect(normalizeFootnoteArtifacts(editor.getJSON())).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body" },
            { type: "footnoteReference", attrs: { label: "note" } },
          ],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "note" },
          content: [{ type: "paragraph" }],
        },
      ],
    });
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    expect(
      editor.state.selection.$from.node(editor.state.selection.$from.depth - 1)
        .type.name,
    ).toBe("footnoteDefinition");
  });

  it("lets Enter create a normal newline after a structured footnote reference already exists", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body" },
            { type: "footnoteReference", attrs: { label: "1" } },
          ],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "1" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Existing note" }],
            },
          ],
        },
      ],
    });

    editor.commands.focus("end");
    editor.commands.setTextSelection(
      (editor.state.doc.firstChild?.nodeSize ?? 2) - 1,
    );

    expect(pressEnter(editor)).toBe(true);
    expect(normalizeFootnoteArtifacts(editor.getJSON())).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body" },
            { type: "footnoteReference", attrs: { label: "1" } },
          ],
        },
        {
          type: "paragraph",
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "1" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Existing note" }],
            },
          ],
        },
      ],
    });
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    expect(editor.state.selection.$from.depth).toBe(1);
  });

  it("deletes a lone reference and its definition with Backspace", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body" },
            { type: "footnoteReference", attrs: { label: "1" } },
          ],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "1" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Existing note" }],
            },
          ],
        },
      ],
    });

    editor.commands.setTextSelection(
      (editor.state.doc.firstChild?.nodeSize ?? 2) - 1,
    );

    expect(pressBackspace(editor)).toBe(true);
    expect(normalizeFootnoteArtifacts(editor.getJSON())).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body" }],
        },
      ],
    });
  });

  it("deletes only the current reference when other references still use the definition", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "First" },
            { type: "footnoteReference", attrs: { label: "1" } },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Second" },
            { type: "footnoteReference", attrs: { label: "1" } },
          ],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "1" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Shared note" }],
            },
          ],
        },
      ],
    });

    editor.commands.setTextSelection(
      (editor.state.doc.firstChild?.nodeSize ?? 2) - 1,
    );

    expect(pressBackspace(editor)).toBe(true);
    expect(normalizeFootnoteArtifacts(editor.getJSON())).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "First" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Second" },
            { type: "footnoteReference", attrs: { label: "1" } },
          ],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "1" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Shared note" }],
            },
          ],
        },
      ],
    });
  });

  it("deletes a trailing reference with Delete", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "footnoteReference", attrs: { label: "1" } },
            { type: "text", text: "Body" },
          ],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "1" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Existing note" }],
            },
          ],
        },
      ],
    });

    editor.commands.setTextSelection(1);

    expect(pressDelete(editor)).toBe(true);
    expect(normalizeFootnoteArtifacts(editor.getJSON())).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body" }],
        },
      ],
    });
  });

  it("converts a top-level definition starter into a footnote definition block", () => {
    const editor = createEditor();

    applyInputRule(editor, 0, FOOTNOTE_DEFINITION_INPUT_REGEX, "[^note]: ");

    expect(normalizeFootnoteArtifacts(editor.getJSON())).toEqual({
      type: "doc",
      content: [
        {
          type: "footnoteDefinition",
          attrs: { label: "note" },
          content: [{ type: "paragraph" }],
        },
      ],
    });
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    expect(
      editor.state.selection.$from.node(editor.state.selection.$from.depth - 1)
        .type.name,
    ).toBe("footnoteDefinition");
  });

  it("deletes a footnote pair when Backspace is pressed at the definition start", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body" },
            { type: "footnoteReference", attrs: { label: "1" } },
          ],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "1" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Existing note" }],
            },
          ],
        },
      ],
    });

    editor.commands.focus("end");
    editor.commands.setTextSelection(
      (editor.state.doc.firstChild?.nodeSize ?? 2) + 2,
    );

    expect(pressBackspace(editor)).toBe(true);
    expect(normalizeFootnoteArtifacts(editor.getJSON())).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body" }],
        },
      ],
    });
  });

  it("promotes a nested definition starter into a sibling footnote definition", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "footnoteDefinition",
          attrs: { label: "1" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "First note" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "[^2]: " }],
            },
          ],
        },
      ],
    });

    editor.commands.focus("end");
    dispatchInputRule(editor, 0, FOOTNOTE_DEFINITION_INPUT_REGEX, "[^2]: ");

    expect(normalizeFootnoteArtifacts(editor.getJSON())).toEqual({
      type: "doc",
      content: [
        {
          type: "footnoteDefinition",
          attrs: { label: "1" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "First note" }],
            },
          ],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "2" },
          content: [{ type: "paragraph" }],
        },
      ],
    });
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    expect(
      editor.state.selection.$from.node(editor.state.selection.$from.depth - 1)
        .type.name,
    ).toBe("footnoteDefinition");
  });

  it("exposes a slash command that inserts a footnote pair", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "/" }],
        },
      ],
    });

    const item = getSlashCommands(editor).find(
      (command) => command.label === "Footnote",
    );
    if (!item) {
      throw new Error("expected Footnote slash command");
    }

    item.command(editor, { from: 1, to: 2 });

    expect(normalizeFootnoteArtifacts(editor.getJSON())).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "footnoteReference", attrs: { label: "1" } }],
        },
        {
          type: "footnoteDefinition",
          attrs: { label: "1" },
          content: [{ type: "paragraph" }],
        },
      ],
    });
  });
});
