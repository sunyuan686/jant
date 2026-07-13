import { Extension, InputRule } from "@tiptap/core";
import { sanitizeUrl } from "../../lib/url.js";
import { moveSelectionAfterBlockInsertion } from "./block-insertion.js";

// Keep the URL group aligned with link-input-rules: single-character
// alternatives avoid catastrophic backtracking on failed Markdown matches.
const MARKDOWN_IMAGE_INPUT_REGEX =
  /!\[([^\]\n]*)\]\(((?:[^()\s"]|\([^()\s"]*\))+)(?:\s*"([^"\n]*)")?\)$/;

function sanitizeImageSrc(src: string): string {
  const sanitized = sanitizeUrl(src.trim());
  if (!sanitized || /^mailto:/i.test(sanitized)) return "";
  return sanitized;
}

export const ImageInputRules = Extension.create({
  name: "imageInputRules",

  // Runs before LinkInputRules so `![alt](url)` is handled as an image rather
  // than the inner `[alt](url)` being converted to a link.
  priority: 1000,

  addInputRules() {
    const imageType = this.editor.schema.nodes.image;
    if (!imageType) return [];

    return [
      new InputRule({
        find: MARKDOWN_IMAGE_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const src = sanitizeImageSrc(match[2] ?? "");
          if (!src) return null;

          state.tr.replaceRangeWith(
            range.from,
            range.to,
            imageType.create({
              src,
              alt: match[1] ?? "",
              title: match[3] ?? "",
            }),
          );
          moveSelectionAfterBlockInsertion(state.tr, state.schema);
        },
      }),
    ];
  },
});
