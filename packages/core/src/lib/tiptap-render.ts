/**
 * TipTap JSON → HTML Renderer
 *
 * Renders TipTap JSON using explicit node and mark renderers so Markdown,
 * stored editor content, and summary extraction all share the same HTML rules.
 */

import type { JSONContent } from "@tiptap/core";
import {
  getFootnoteDomId,
  normalizeFootnoteArtifacts,
  normalizeFootnoteLabel,
} from "./footnotes.js";
import { renderEmbedFromAttrs } from "./embed-render.js";
import { escapeHtml } from "./html.js";
import { renderPublishedImageFigure } from "./rich-image.js";
import { sanitizeUrl } from "./url.js";

interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

interface RenderContext {
  renderChildren(content?: TiptapNode[]): string;
  renderNode(node: TiptapNode): string;
  renderText(text: string, marks?: TiptapMark[]): string;
}

type MarkRenderer = (html: string, mark: TiptapMark) => string;
type NodeRenderer = (node: TiptapNode, context: RenderContext) => string;

function getStringAttr(
  attrs: Record<string, unknown> | undefined,
  name: string,
): string {
  const value = attrs?.[name];
  return typeof value === "string" ? value : "";
}

function getNumberAttr(
  attrs: Record<string, unknown> | undefined,
  name: string,
): number | null {
  const value = attrs?.[name];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function renderCodeBlockText(node: TiptapNode): string {
  switch (node.type) {
    case "text":
      return escapeHtml(node.text ?? "");
    case "hardBreak":
      return "\n";
    default:
      return (node.content ?? []).map(renderCodeBlockText).join("");
  }
}

function renderTableCell(
  tagName: "td" | "th",
  node: TiptapNode,
  context: RenderContext,
): string {
  const colspan = getNumberAttr(node.attrs, "colspan");
  const rowspan = getNumberAttr(node.attrs, "rowspan");
  const colspanAttr =
    colspan !== null && colspan !== 1 ? ` colspan="${colspan}"` : "";
  const rowspanAttr =
    rowspan !== null && rowspan !== 1 ? ` rowspan="${rowspan}"` : "";

  return `<${tagName}${colspanAttr}${rowspanAttr}>${context.renderChildren(node.content)}</${tagName}>`;
}

/**
 * Strips wrapping `<p>...</p>` from single-paragraph sidenote bodies
 * so they render cleanly as inline spans.
 */
function stripSingleParagraph(html: string): string {
  const trimmed = html.trim();
  if (
    trimmed.startsWith("<p>") &&
    trimmed.endsWith("</p>") &&
    trimmed.indexOf("<p>", 1) === -1
  ) {
    return trimmed.slice(3, -4);
  }
  return trimmed;
}

/**
 * Module-level definition map populated by the `doc` renderer so that
 * `footnoteReference` nodes can inline sidenote content.
 */
let activeDefinitionMap: Map<string, TiptapNode> | null = null;

function renderSidenoteReference(
  node: TiptapNode,
  context: RenderContext,
): string {
  const label = normalizeFootnoteLabel(getStringAttr(node.attrs, "label"));
  const footnoteId = getFootnoteDomId(label);
  const definitionNode = activeDefinitionMap?.get(label);
  const bodyHtml = definitionNode
    ? stripSingleParagraph(context.renderChildren(definitionNode.content))
    : "";

  // The `footref` / `footref-toggle` classes are not styled by us; they mark the
  // Tufte sidenote trio as an Org-mode-style footnote so HTML-to-Markdown readers
  // (Defuddle, used by Obsidian Web Clipper) recover `[^n]` references instead of
  // silently dropping `span.sidenote`. See docs/internal/markdown-contract.md.
  return (
    `<label for="sn-${escapeHtml(footnoteId)}" class="margin-toggle sidenote-number footref"></label>` +
    `<input type="checkbox" id="sn-${escapeHtml(footnoteId)}" class="margin-toggle footref-toggle"/>` +
    `<span class="sidenote">${bodyHtml}</span>`
  );
}

const MARK_RENDERERS: Record<string, MarkRenderer> = {
  bold: (html) => `<strong>${html}</strong>`,
  italic: (html) => `<em>${html}</em>`,
  strike: (html) => `<s>${html}</s>`,
  code: (html) => `<code>${html}</code>`,
  link: (html, mark) => {
    const href = escapeHtml(sanitizeUrl(getStringAttr(mark.attrs, "href")));
    const target = getStringAttr(mark.attrs, "target");
    const targetAttr = target ? ` target="${escapeHtml(target)}"` : "";
    const relAttr = target ? ' rel="noopener noreferrer"' : "";

    return `<a href="${href}"${targetAttr}${relAttr}>${html}</a>`;
  },
};

const NODE_RENDERERS: Record<string, NodeRenderer> = {
  doc: (node, context) => {
    const content = node.content ?? [];

    // Build definition lookup so footnoteReference can inline sidenotes
    const definitionMap = new Map<string, TiptapNode>();
    for (const child of content) {
      if (child.type === "footnoteDefinition") {
        const label = normalizeFootnoteLabel(
          getStringAttr(child.attrs, "label"),
        );
        if (label) definitionMap.set(label, child);
      }
    }

    activeDefinitionMap = definitionMap.size > 0 ? definitionMap : null;
    try {
      const bodyNodes = content.filter(
        (child) => child.type !== "footnoteDefinition",
      );
      return context.renderChildren(bodyNodes);
    } finally {
      activeDefinitionMap = null;
    }
  },
  paragraph: (node, context) =>
    `<p>${context.renderChildren(node.content)}</p>`,
  heading: (node, context) => {
    const level = Math.min(
      Math.max(getNumberAttr(node.attrs, "level") ?? 1, 1),
      6,
    );
    return `<h${level}>${context.renderChildren(node.content)}</h${level}>`;
  },
  text: (node, context) => context.renderText(node.text ?? "", node.marks),
  bulletList: (node, context) =>
    `<ul>${context.renderChildren(node.content)}</ul>`,
  orderedList: (node, context) => {
    const start = getNumberAttr(node.attrs, "start");
    const startAttr = start !== null && start !== 1 ? ` start="${start}"` : "";
    return `<ol${startAttr}>${context.renderChildren(node.content)}</ol>`;
  },
  listItem: (node, context) =>
    `<li>${context.renderChildren(node.content)}</li>`,
  blockquote: (node, context) =>
    `<blockquote>${context.renderChildren(node.content)}</blockquote>`,
  codeBlock: (node) => {
    const language = getStringAttr(node.attrs, "language");
    const languageAttr = language
      ? ` class="language-${escapeHtml(language)}"`
      : "";
    return `<pre><code${languageAttr}>${renderCodeBlockText(node)}</code></pre>`;
  },
  table: (node, context) =>
    `<table>${context.renderChildren(node.content)}</table>`,
  tableRow: (node, context) =>
    `<tr>${context.renderChildren(node.content)}</tr>`,
  tableCell: (node, context) => renderTableCell("td", node, context),
  tableHeader: (node, context) => renderTableCell("th", node, context),
  horizontalRule: () => "<hr>",
  hardBreak: () => "<br>",
  image: (node) => renderPublishedImageFigure(node.attrs ?? {}),
  embed: (node) => renderEmbedFromAttrs(node.attrs),
  // htmlBlock: deliberately raw output. The author is the only writer in
  // Jant's single-author model, this node is admin-only via the editor UI,
  // and the value is round-tripped through markdown unchanged. This is a
  // documented exception to the "every dynamic string must be escaped" rule
  // in CLAUDE.md — see also `dangerouslySetInnerHTML` for `customCSS`.
  htmlBlock: (node) => {
    const html = getStringAttr(node.attrs, "html");
    if (!html) return "";
    return `<div class="tiptap-html-block">${html}</div>`;
  },
  moreBreak: () => "<!--more-->",
  footnoteReference: (node, context) => renderSidenoteReference(node, context),
  footnoteDefinition: () => "",
};

function renderText(text: string, marks: TiptapMark[] = []): string {
  let html = escapeHtml(text);

  for (const mark of marks) {
    const renderMark = MARK_RENDERERS[mark.type];
    if (renderMark) {
      html = renderMark(html, mark);
    }
  }

  return html;
}

function renderChildren(content: TiptapNode[] = []): string {
  return content.map(renderNode).join("");
}

function renderUnknownNode(node: TiptapNode, context: RenderContext): string {
  return node.content ? context.renderChildren(node.content) : "";
}

function renderNode(node: TiptapNode): string {
  const renderNodeType = NODE_RENDERERS[node.type] ?? renderUnknownNode;
  return renderNodeType(node, RENDER_CONTEXT);
}

const RENDER_CONTEXT: RenderContext = {
  renderChildren,
  renderNode,
  renderText,
};

/**
 * Renders a parsed TipTap document to HTML.
 *
 * @param doc - Parsed TipTap document
 * @returns HTML string
 */
export function renderTiptapDocument(doc: JSONContent): string {
  if (doc.type !== "doc") return "";
  return renderNode(normalizeFootnoteArtifacts(doc) as TiptapNode);
}

/**
 * Renders a Tiptap JSON document to an HTML string.
 *
 * @param json - Tiptap JSON string or parsed document object
 * @returns HTML string
 *
 * @example
 * ```ts
 * const html = renderTiptapJson('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]}');
 * // "<p>Hello</p>"
 * ```
 */
export function renderTiptapJson(json: string): string {
  try {
    const doc = JSON.parse(json) as JSONContent;
    return renderTiptapDocument(doc);
  } catch {
    return "";
  }
}

/**
 * Returns true if a TipTap node is an empty block — a paragraph (or heading)
 * with no meaningful content (no text, no images, no other inline nodes).
 * Whitespace-only text nodes are treated as empty.
 */
function isEmptyBlock(node: JSONContent): boolean {
  if (node.type !== "paragraph" && node.type !== "heading") return false;
  if (!node.content || node.content.length === 0) return true;
  return node.content.every(
    (child) =>
      child.type === "text" && (!child.text || child.text.trim() === ""),
  );
}

/**
 * Strips leading and trailing empty paragraphs/headings from a TipTap JSON
 * document string. Returns `null` if the entire document becomes empty after
 * trimming.
 *
 * @param json - TipTap JSON string
 * @returns Trimmed JSON string, or `null` if nothing remains
 *
 * @example
 * ```ts
 * // Removes trailing empty paragraphs
 * trimTiptapBody('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]},{"type":"paragraph"}]}');
 * // '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]}'
 * ```
 */
export function trimTiptapBody(json: string): string | null {
  let doc: JSONContent;
  try {
    doc = JSON.parse(json) as JSONContent;
  } catch {
    return json;
  }
  if (doc.type !== "doc" || !doc.content) return json;

  let start = 0;
  let end = doc.content.length;
  const content = doc.content;
  while (start < end && isEmptyBlock(content[start] as JSONContent)) start++;
  while (end > start && isEmptyBlock(content[end - 1] as JSONContent)) end--;

  if (start >= end) return null;
  if (start === 0 && end === doc.content.length) return json;

  return JSON.stringify({ ...doc, content: doc.content.slice(start, end) });
}
