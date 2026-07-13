import type { JSONContent } from "@tiptap/core";

export interface LeadingH1TitlePromotion {
  title: string;
  bodyJson: JSONContent | null;
  headingIndex: number;
}

function textFromNode(node: JSONContent): string {
  if (typeof node.text === "string") return node.text;
  if (!node.content) return node.type === "hardBreak" ? " " : "";
  return node.content.map(textFromNode).join("");
}

function hasOnlyEmptyInlineContent(node: JSONContent): boolean {
  if (!node.content || node.content.length === 0) return true;
  return node.content.every((child) => {
    if (child.type === "text") return !child.text?.trim();
    if (child.type === "hardBreak") return true;
    return false;
  });
}

function isIgnorableLeadingBlock(node: JSONContent): boolean {
  return (
    (node.type === "paragraph" || node.type === "heading") &&
    hasOnlyEmptyInlineContent(node)
  );
}

function normalizeTitleText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function promoteLeadingH1Title(
  bodyJson: JSONContent | null,
): LeadingH1TitlePromotion | null {
  const content = bodyJson?.content;
  if (!bodyJson || !content?.length) return null;

  const headingIndex = content.findIndex((node) => {
    return !isIgnorableLeadingBlock(node);
  });

  if (headingIndex < 0) return null;

  const heading = content[headingIndex];
  if (heading?.type !== "heading" || heading.attrs?.level !== 1) return null;

  const title = normalizeTitleText(textFromNode(heading));
  if (!title) return null;

  const nextContent = content.slice(headingIndex + 1);
  if (nextContent.length === 0) {
    return { title, bodyJson: null, headingIndex };
  }

  return {
    title,
    bodyJson: {
      ...bodyJson,
      content: nextContent,
    },
    headingIndex,
  };
}
