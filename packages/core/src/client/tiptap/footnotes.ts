import { Extension, InputRule } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  NodeSelection,
  Plugin,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import {
  getFootnoteLabelKey,
  normalizeFootnoteLabel,
} from "../../lib/footnotes.js";

export const FOOTNOTE_REFERENCE_INPUT_REGEX = /\[\^([^\]\n]+)\]([ \t.,!?;)]$)/;
export const FOOTNOTE_DEFINITION_INPUT_REGEX = /^\[\^([^\]\n]+)\]: $/;
const FOOTNOTE_REFERENCE_AT_PARAGRAPH_END_REGEX = /\[\^([^\]\n]+)\]$/;

interface FootnoteNodeRange {
  from: number;
  to: number;
}

function collectUsedFootnoteLabels(doc: ProseMirrorNode): Set<string> {
  const labels = new Set<string>();

  doc.descendants((node) => {
    if (
      node.type.name !== "footnoteReference" &&
      node.type.name !== "footnoteDefinition"
    ) {
      return true;
    }

    const label = normalizeFootnoteLabel(node.attrs.label);
    if (label) {
      labels.add(getFootnoteLabelKey(label));
    }

    return true;
  });

  return labels;
}

function getNextFootnoteLabel(doc: ProseMirrorNode): string {
  const labels = collectUsedFootnoteLabels(doc);
  let next = 1;

  while (labels.has(String(next))) {
    next += 1;
  }

  return String(next);
}

function findFootnoteDefinitionInsertPos(doc: ProseMirrorNode): number {
  let insertPos = doc.content.size;

  doc.forEach((node, offset) => {
    if (node.type.name === "footnoteDefinition") {
      insertPos = offset + node.nodeSize;
    }
  });

  return insertPos;
}

function findFootnoteDefinitionPos(
  doc: ProseMirrorNode,
  label: string,
): number | null {
  const labelKey = getFootnoteLabelKey(label);
  let foundPos: number | null = null;

  doc.forEach((node, offset) => {
    if (
      foundPos === null &&
      node.type.name === "footnoteDefinition" &&
      getFootnoteLabelKey(node.attrs.label) === labelKey
    ) {
      foundPos = offset;
    }
  });

  return foundPos;
}

function findFootnoteDefinitionRange(
  doc: ProseMirrorNode,
  label: string,
): FootnoteNodeRange | null {
  const labelKey = getFootnoteLabelKey(label);
  let range: FootnoteNodeRange | null = null;

  doc.forEach((node, offset) => {
    if (
      range === null &&
      node.type.name === "footnoteDefinition" &&
      getFootnoteLabelKey(node.attrs.label) === labelKey
    ) {
      range = {
        from: offset,
        to: offset + node.nodeSize,
      };
    }
  });

  return range;
}

function collectFootnoteReferenceRanges(
  doc: ProseMirrorNode,
  label: string,
): FootnoteNodeRange[] {
  const labelKey = getFootnoteLabelKey(label);
  const ranges: FootnoteNodeRange[] = [];

  doc.descendants((node, pos) => {
    if (
      node.type.name === "footnoteReference" &&
      getFootnoteLabelKey(node.attrs.label) === labelKey
    ) {
      ranges.push({
        from: pos,
        to: pos + node.nodeSize,
      });
    }

    return true;
  });

  return ranges;
}

function createFootnoteReferenceNode(state: EditorState, label: string) {
  const nodeType = state.schema.nodes.footnoteReference;
  if (!nodeType) return null;
  return nodeType.create({ label });
}

function createFootnoteDefinitionNode(state: EditorState, label: string) {
  const definitionType = state.schema.nodes.footnoteDefinition;
  const paragraphType = state.schema.nodes.paragraph;
  if (!definitionType || !paragraphType) return null;

  return definitionType.create({ label }, [paragraphType.create()]);
}

function setSelectionInsideInsertedFootnote(
  tr: Transaction,
  insertPos: number,
) {
  const targetPos = Math.min(insertPos + 2, tr.doc.content.size);
  tr.setSelection(TextSelection.near(tr.doc.resolve(targetPos), 1));
}

function removeAutoInsertedParagraphAfter(tr: Transaction, afterPos: number) {
  let deleteFrom: number | null = null;
  let deleteTo: number | null = null;

  tr.doc.forEach((node, offset) => {
    if (
      offset === afterPos &&
      node.type.name === "paragraph" &&
      node.content.size === 0
    ) {
      deleteFrom = offset;
      deleteTo = offset + node.nodeSize;
    }
  });

  if (deleteFrom !== null && deleteTo !== null) {
    tr.delete(deleteFrom, deleteTo);
  }
}

function ensureFootnoteDefinition(
  state: EditorState,
  tr: Transaction,
  label: string,
): number | null {
  const existingPos = findFootnoteDefinitionPos(tr.doc, label);
  if (existingPos !== null) {
    return existingPos;
  }

  const definitionNode = createFootnoteDefinitionNode(state, label);
  if (!definitionNode) {
    return null;
  }

  const insertPos = findFootnoteDefinitionInsertPos(tr.doc);
  tr.insert(insertPos, definitionNode);
  removeAutoInsertedParagraphAfter(tr, insertPos + definitionNode.nodeSize);
  return insertPos;
}

function collectMissingFootnoteDefinitionLabels(
  doc: ProseMirrorNode,
): string[] {
  const definedLabels = new Set<string>();
  const queuedLabels = new Set<string>();
  const missingLabels: string[] = [];

  doc.forEach((node) => {
    if (node.type.name !== "footnoteDefinition") {
      return;
    }

    const label = normalizeFootnoteLabel(node.attrs.label);
    if (label) {
      definedLabels.add(getFootnoteLabelKey(label));
    }
  });

  doc.descendants((node) => {
    if (node.type.name !== "footnoteReference") {
      return true;
    }

    const label = normalizeFootnoteLabel(node.attrs.label);
    const labelKey = getFootnoteLabelKey(label);
    if (label && !definedLabels.has(labelKey) && !queuedLabels.has(labelKey)) {
      queuedLabels.add(labelKey);
      missingLabels.push(label);
    }

    return true;
  });

  return missingLabels;
}

function buildEnsureFootnoteDefinitionsTransaction(
  state: EditorState,
): Transaction | null {
  const missingLabels = collectMissingFootnoteDefinitionLabels(state.doc);
  if (missingLabels.length === 0) {
    return null;
  }

  const tr = state.tr;
  for (const label of missingLabels) {
    ensureFootnoteDefinition(state, tr, label);
  }

  return tr.docChanged ? tr : null;
}

function getSelectedFootnoteReferenceLabel(state: EditorState): string | null {
  const { selection } = state;
  if (
    !(selection instanceof NodeSelection) ||
    selection.node.type.name !== "footnoteReference"
  ) {
    return null;
  }

  return normalizeFootnoteLabel(selection.node.attrs.label) || null;
}

function buildNavigateToFootnoteDefinitionTransaction(
  state: EditorState,
  label: string,
): Transaction | null {
  const tr = state.tr;
  const definitionPos = ensureFootnoteDefinition(state, tr, label);
  if (definitionPos === null) {
    return null;
  }

  setSelectionInsideInsertedFootnote(tr, definitionPos);
  tr.scrollIntoView();
  return tr;
}

function ensureNonEmptyDoc(state: EditorState, tr: Transaction) {
  if (tr.doc.childCount > 0) {
    return;
  }

  const paragraphType = state.schema.nodes.paragraph;
  if (paragraphType) {
    tr.insert(0, paragraphType.create());
  }
}

function cleanupDeletedFootnoteArtifacts(
  tr: Transaction,
  deletedDefinition: FootnoteNodeRange | null,
) {
  if (!deletedDefinition || tr.doc.childCount < 2) {
    return;
  }

  const trailingNode = tr.doc.lastChild;
  const previousNode = tr.doc.child(tr.doc.childCount - 2);

  if (
    trailingNode?.type.name === "paragraph" &&
    trailingNode.content.size === 0 &&
    previousNode.type.name !== "footnoteDefinition"
  ) {
    tr.delete(tr.doc.content.size - trailingNode.nodeSize, tr.doc.content.size);
  }
}

function setSelectionNearPos(tr: Transaction, pos: number) {
  const targetPos = Math.min(Math.max(pos, 0), tr.doc.content.size);
  tr.setSelection(TextSelection.near(tr.doc.resolve(targetPos), -1));
}

function deleteRangesDescending(tr: Transaction, ranges: FootnoteNodeRange[]) {
  const orderedRanges = [...ranges].sort(
    (left, right) => right.from - left.from,
  );

  for (const range of orderedRanges) {
    tr.delete(range.from, range.to);
  }
}

function buildDeleteFootnoteByLabelTransaction(
  state: EditorState,
  label: string,
): Transaction | null {
  const definitionRange = findFootnoteDefinitionRange(state.doc, label);
  const ranges = [
    ...collectFootnoteReferenceRanges(state.doc, label),
    ...(definitionRange ? [definitionRange] : []),
  ];

  if (ranges.length === 0) {
    return null;
  }

  const tr = state.tr;
  deleteRangesDescending(tr, ranges);
  ensureNonEmptyDoc(state, tr);
  cleanupDeletedFootnoteArtifacts(tr, definitionRange);
  setSelectionNearPos(tr, ranges[0]?.from ?? 0);
  tr.scrollIntoView();
  return tr;
}

function buildDeleteFootnoteReferenceTransaction(
  state: EditorState,
  referenceRange: FootnoteNodeRange,
): Transaction | null {
  const referenceNode = state.doc.nodeAt(referenceRange.from);
  if (!referenceNode || referenceNode.type.name !== "footnoteReference") {
    return null;
  }

  const label = normalizeFootnoteLabel(referenceNode.attrs.label);
  if (!label) {
    return null;
  }

  const allReferenceRanges = collectFootnoteReferenceRanges(state.doc, label);
  const definitionRange = findFootnoteDefinitionRange(state.doc, label);
  const ranges =
    allReferenceRanges.length <= 1
      ? [referenceRange, ...(definitionRange ? [definitionRange] : [])]
      : [referenceRange];

  const tr = state.tr;
  deleteRangesDescending(tr, ranges);
  ensureNonEmptyDoc(state, tr);
  cleanupDeletedFootnoteArtifacts(
    tr,
    allReferenceRanges.length <= 1 ? definitionRange : null,
  );
  setSelectionNearPos(tr, referenceRange.from);
  tr.scrollIntoView();
  return tr;
}

function findSelectedFootnoteReferenceRange(
  state: EditorState,
  direction: "backward" | "forward",
): FootnoteNodeRange | null {
  const { selection } = state;

  if (selection instanceof NodeSelection) {
    return selection.node.type.name === "footnoteReference"
      ? { from: selection.from, to: selection.to }
      : null;
  }

  if (!selection.empty) {
    return null;
  }

  const { $from } = selection;
  const node = direction === "backward" ? $from.nodeBefore : $from.nodeAfter;

  if (!node || node.type.name !== "footnoteReference") {
    return null;
  }

  const from =
    direction === "backward" ? selection.from - node.nodeSize : selection.from;

  return {
    from,
    to: from + node.nodeSize,
  };
}

function getFootnoteDefinitionSelectionLabel(
  state: EditorState,
): string | null {
  const { selection } = state;

  if (selection instanceof NodeSelection) {
    return selection.node.type.name === "footnoteDefinition"
      ? normalizeFootnoteLabel(selection.node.attrs.label)
      : null;
  }

  if (!selection.empty) {
    return null;
  }

  const { $from } = selection;
  let definitionDepth = -1;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "footnoteDefinition") {
      definitionDepth = depth;
      break;
    }
  }

  if (definitionDepth === -1) {
    return null;
  }

  const isAtDefinitionStart =
    $from.parent.type.name === "paragraph" &&
    $from.parentOffset === 0 &&
    $from.index(definitionDepth) === 0;

  if (!isAtDefinitionStart) {
    return null;
  }

  return normalizeFootnoteLabel($from.node(definitionDepth).attrs.label);
}

function replaceTextWithFootnoteReference(
  state: EditorState,
  label: string,
  trailingText: string,
  from: number,
  to: number,
): boolean {
  const referenceNode = createFootnoteReferenceNode(state, label);
  if (!referenceNode) return false;

  const content: ProseMirrorNode[] = [referenceNode];
  if (trailingText) {
    content.push(state.schema.text(trailingText));
  }

  const tr = state.tr;
  tr.replaceWith(from, to, Fragment.fromArray(content));

  return ensureFootnoteDefinition(state, tr, label) !== null;
}

function replaceTopLevelParagraphWithFootnoteDefinition(
  state: EditorState,
  label: string,
): boolean {
  const definitionNode = createFootnoteDefinitionNode(state, label);
  if (!definitionNode) return false;

  const { $from } = state.selection;
  if ($from.depth !== 1 || $from.parent.type.name !== "paragraph") {
    return false;
  }

  const tr = state.tr.replaceWith(
    $from.before(),
    $from.after(),
    definitionNode,
  );
  removeAutoInsertedParagraphAfter(
    tr,
    $from.before() + definitionNode.nodeSize,
  );
  setSelectionInsideInsertedFootnote(tr, $from.before());
  tr.scrollIntoView();
  return true;
}

function replaceNestedParagraphWithFootnoteDefinition(
  state: EditorState,
  label: string,
): boolean {
  const definitionNode = createFootnoteDefinitionNode(state, label);
  if (!definitionNode) return false;

  const { $from } = state.selection;
  if (
    $from.parent.type.name !== "paragraph" ||
    $from.depth < 2 ||
    $from.node($from.depth - 1).type.name !== "footnoteDefinition"
  ) {
    return false;
  }

  const paragraphDepth = $from.depth;
  const paragraphFrom = $from.before(paragraphDepth);
  const paragraphTo = $from.after(paragraphDepth);
  const footnoteDepth = paragraphDepth - 1;
  const footnoteNode = $from.node(footnoteDepth);
  const footnoteTo = $from.after(footnoteDepth);
  const tr = state.tr;

  if (footnoteNode.childCount === 1) {
    tr.delete(paragraphFrom + 1, paragraphTo - 1);
  } else {
    tr.delete(paragraphFrom, paragraphTo);
  }

  const insertPos = tr.mapping.map(footnoteTo);
  tr.insert(insertPos, definitionNode);
  removeAutoInsertedParagraphAfter(tr, insertPos + definitionNode.nodeSize);
  setSelectionInsideInsertedFootnote(tr, insertPos);
  tr.scrollIntoView();
  return true;
}

function isInFootnoteDefinition(state: EditorState): boolean {
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "footnoteDefinition") {
      return true;
    }
  }

  return false;
}

function getTypedFootnoteReferenceAtParagraphEnd(state: EditorState): {
  label: string;
  from: number;
  to: number;
} | null {
  const { selection } = state;
  const { $from } = selection;

  if (
    !selection.empty ||
    isInFootnoteDefinition(state) ||
    !$from.parent.inlineContent ||
    $from.parent.type.name !== "paragraph" ||
    $from.parentOffset !== $from.parent.content.size
  ) {
    return null;
  }

  const textBeforeCursor = $from.parent.textBetween(
    0,
    $from.parentOffset,
    undefined,
    "\uFFFC",
  );
  const match = textBeforeCursor.match(
    FOOTNOTE_REFERENCE_AT_PARAGRAPH_END_REGEX,
  );
  const label = normalizeFootnoteLabel(match?.[1]);

  if (!match || !label) {
    return null;
  }

  return {
    label,
    from: selection.from - match[0].length,
    to: selection.from,
  };
}

function activateTrailingFootnoteAtParagraphEnd(
  state: EditorState,
): Transaction | null {
  const typedReference = getTypedFootnoteReferenceAtParagraphEnd(state);

  if (typedReference) {
    const referenceNode = createFootnoteReferenceNode(
      state,
      typedReference.label,
    );
    if (!referenceNode) {
      return null;
    }

    const tr = state.tr.replaceWith(
      typedReference.from,
      typedReference.to,
      referenceNode,
    );
    const definitionPos = ensureFootnoteDefinition(
      state,
      tr,
      typedReference.label,
    );
    if (definitionPos === null) {
      return null;
    }

    setSelectionInsideInsertedFootnote(tr, definitionPos);
    tr.scrollIntoView();
    return tr;
  }

  return null;
}

export function createFootnoteInputRules(): InputRule[] {
  return [
    new InputRule({
      find: FOOTNOTE_DEFINITION_INPUT_REGEX,
      handler: ({ state, match }) => {
        const label = normalizeFootnoteLabel(match[1]);
        if (!label) {
          return null;
        }

        const { $from } = state.selection;
        if ($from.depth !== 1 || $from.parent.type.name !== "paragraph") {
          return replaceNestedParagraphWithFootnoteDefinition(state, label)
            ? undefined
            : null;
        }

        return replaceTopLevelParagraphWithFootnoteDefinition(state, label)
          ? undefined
          : null;
      },
    }),
    new InputRule({
      find: FOOTNOTE_REFERENCE_INPUT_REGEX,
      handler: ({ state, range, match }) => {
        const label = normalizeFootnoteLabel(match[1]);
        const trailingText = match[2] ?? "";
        if (!label || !trailingText) {
          return null;
        }

        if (!state.selection.$from.parent.inlineContent) {
          return null;
        }

        return replaceTextWithFootnoteReference(
          state,
          label,
          trailingText,
          range.from,
          range.to,
        )
          ? undefined
          : null;
      },
    }),
  ];
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    footnotes: {
      insertFootnote: () => ReturnType;
    };
  }
}

export const Footnotes = Extension.create({
  name: "footnotes",

  onCreate() {
    const tr = buildEnsureFootnoteDefinitionsTransaction(this.editor.state);
    if (tr) {
      this.editor.view.dispatch(tr);
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }

          return buildEnsureFootnoteDefinitionsTransaction(newState);
        },
        props: {
          handleClickOn: (view, _pos, node, _nodePos, _event, direct) => {
            if (!direct || node.type.name !== "footnoteReference") {
              return false;
            }

            const label = normalizeFootnoteLabel(node.attrs.label);
            if (!label) {
              return false;
            }

            const tr = buildNavigateToFootnoteDefinitionTransaction(
              view.state,
              label,
            );
            if (!tr) {
              return false;
            }

            view.dispatch(tr);
            view.focus();
            return true;
          },
          handleClick: (view, pos) => {
            const $pos = view.state.doc.resolve(pos);
            if (
              $pos.nodeBefore?.type.name !== "footnoteDefinition" ||
              $pos.nodeAfter?.type.name !== "footnoteDefinition"
            ) {
              return false;
            }

            const tr = view.state.tr;
            setSelectionInsideInsertedFootnote(tr, pos);
            view.dispatch(tr.scrollIntoView());
            view.focus();
            return true;
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      insertFootnote:
        () =>
        ({ state, dispatch }) => {
          if (!state.selection.$from.parent.inlineContent) {
            return false;
          }

          const label = getNextFootnoteLabel(state.doc);
          const referenceNode = createFootnoteReferenceNode(state, label);
          const definitionNode = createFootnoteDefinitionNode(state, label);

          if (!referenceNode || !definitionNode) {
            return false;
          }

          const definitionInsertPos = findFootnoteDefinitionInsertPos(
            state.doc,
          );
          const tr = state.tr.replaceSelectionWith(referenceNode, false);
          const mappedInsertPos = tr.mapping.map(definitionInsertPos);

          tr.insert(mappedInsertPos, definitionNode);
          removeAutoInsertedParagraphAfter(
            tr,
            mappedInsertPos + definitionNode.nodeSize,
          );
          setSelectionInsideInsertedFootnote(tr, mappedInsertPos);

          if (dispatch) {
            dispatch(tr.scrollIntoView());
          }

          return true;
        },
    };
  },

  addInputRules() {
    return createFootnoteInputRules();
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const selectedReferenceLabel = getSelectedFootnoteReferenceLabel(
          editor.state,
        );
        if (selectedReferenceLabel) {
          const navigateTr = buildNavigateToFootnoteDefinitionTransaction(
            editor.state,
            selectedReferenceLabel,
          );
          if (!navigateTr) {
            return false;
          }

          editor.view.dispatch(navigateTr);
          return true;
        }

        const tr = activateTrailingFootnoteAtParagraphEnd(editor.state);
        if (!tr) {
          return false;
        }

        editor.view.dispatch(tr);
        return true;
      },
      Backspace: ({ editor }) => {
        const definitionLabel = getFootnoteDefinitionSelectionLabel(
          editor.state,
        );
        if (definitionLabel) {
          const tr = buildDeleteFootnoteByLabelTransaction(
            editor.state,
            definitionLabel,
          );
          if (!tr) {
            return false;
          }

          editor.view.dispatch(tr);
          return true;
        }

        const referenceRange = findSelectedFootnoteReferenceRange(
          editor.state,
          "backward",
        );
        if (!referenceRange) {
          return false;
        }

        const tr = buildDeleteFootnoteReferenceTransaction(
          editor.state,
          referenceRange,
        );
        if (!tr) {
          return false;
        }

        editor.view.dispatch(tr);
        return true;
      },
      Delete: ({ editor }) => {
        const referenceRange = findSelectedFootnoteReferenceRange(
          editor.state,
          "forward",
        );
        if (!referenceRange) {
          return false;
        }

        const tr = buildDeleteFootnoteReferenceTransaction(
          editor.state,
          referenceRange,
        );
        if (!tr) {
          return false;
        }

        editor.view.dispatch(tr);
        return true;
      },
    };
  },
});
