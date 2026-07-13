/**
 * List Paragraph Backspace
 *
 * TipTap's ListKeymap treats the start of every text block inside a list item
 * as the start of the list item itself. For a pasted item containing multiple
 * paragraphs, Backspace at the second paragraph can therefore join the whole
 * list item backward and remove its marker.
 *
 * This higher-priority shortcut handles the narrower paragraph-merge case
 * first. ListKeymap still owns Backspace at the first paragraph, where its
 * list-item join/lift behavior is appropriate.
 *
 * TipTap upgrade note: this compatibility extension was added against 3.22.1.
 * TipTap 3.25 changed list-item Backspace to lift before merging, but that is
 * still different from joining later sibling paragraphs inside the same item.
 * Do not remove this extension solely because TipTap was upgraded. Temporarily
 * remove it from the test editor and run the "merges paragraphs inside a list
 * item without removing its marker" regression test first; delete the local
 * extension only when the upstream keymap passes that behavior on its own.
 */

import { Extension, type Editor } from "@tiptap/core";

/**
 * Joins a later text block with the text block immediately before it when both
 * are direct children of the same list item.
 *
 * @param editor - Active TipTap editor
 * @returns Whether the list-paragraph Backspace case was handled
 */
function joinListItemParagraphBackward(editor: Editor): boolean {
  const { selection } = editor.state;
  if (!selection.empty) return false;

  const { $from } = selection;
  if (!$from.parent.isTextblock || $from.parentOffset !== 0) return false;

  let listItemDepth: number | null = null;
  for (let depth = $from.depth - 1; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "listItem") {
      listItemDepth = depth;
      break;
    }
  }

  if (listItemDepth === null || $from.depth !== listItemDepth + 1) return false;

  const childIndex = $from.index(listItemDepth);
  if (childIndex === 0) return false;

  const previousChild = $from.node(listItemDepth).child(childIndex - 1);
  if (!previousChild.isTextblock) return false;

  return editor.commands.joinBackward();
}

export const ListParagraphBackspace = Extension.create({
  name: "listParagraphBackspace",
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => joinListItemParagraphBackward(editor),
      "Mod-Backspace": ({ editor }) => joinListItemParagraphBackward(editor),
    };
  },
});
