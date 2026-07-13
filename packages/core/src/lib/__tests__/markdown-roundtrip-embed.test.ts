import { describe, expect, it } from "vitest";
import {
  parseMarkdownDocument,
  serializeMarkdownDocument,
} from "../markdown-manager.js";

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

function findNode(node: TiptapNode, type: string): TiptapNode | null {
  if (node.type === type) return node;
  for (const child of node.content ?? []) {
    const found = findNode(child, type);
    if (found) return found;
  }
  return null;
}

describe("markdown round-trip: embed", () => {
  it("parses a ```jant-embed fenced block into an embed node", () => {
    const md =
      "```jant-embed\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ\n```";
    const doc = parseMarkdownDocument(md) as TiptapNode;
    const embed = findNode(doc, "embed");
    expect(embed).not.toBeNull();
    expect(embed?.attrs?.url).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });

  it("parses optional caption=value lines", () => {
    const md = [
      "```jant-embed",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "caption=Rickroll",
      "```",
    ].join("\n");
    const doc = parseMarkdownDocument(md) as TiptapNode;
    const embed = findNode(doc, "embed");
    expect(embed?.attrs?.caption).toBe("Rickroll");
  });

  it("serializes an embed node back to a fenced block", () => {
    const md = "```jant-embed\nhttps://vimeo.com/123456789\n```";
    const doc = parseMarkdownDocument(md);
    const out = serializeMarkdownDocument(doc).trim();
    expect(out).toContain("```jant-embed");
    expect(out).toContain("https://vimeo.com/123456789");
    expect(out.trim().endsWith("```")).toBe(true);
  });

  it("preserves caption through a round-trip", () => {
    const md = [
      "```jant-embed",
      "https://vimeo.com/123456789",
      "caption=Trip",
      "```",
    ].join("\n");
    const out = serializeMarkdownDocument(parseMarkdownDocument(md)).trim();
    expect(out).toContain("caption=Trip");
  });
});

describe("markdown round-trip: htmlBlock", () => {
  it("parses a ```jant-html fenced block into a htmlBlock node", () => {
    const md = [
      "```jant-html",
      '<script src="https://letterbird.co/embed/v1.js"></script>',
      "```",
    ].join("\n");
    const doc = parseMarkdownDocument(md) as TiptapNode;
    const block = findNode(doc, "htmlBlock");
    expect(block).not.toBeNull();
    expect(block?.attrs?.html).toContain("letterbird.co/embed/v1.js");
  });

  it("preserves raw HTML verbatim through a round-trip", () => {
    const inner =
      '<script data-letterbirduser="you" src="https://letterbird.co/embed/v1.js"></script>';
    const md = ["```jant-html", inner, "```"].join("\n");
    const out = serializeMarkdownDocument(parseMarkdownDocument(md)).trim();
    expect(out).toContain("```jant-html");
    expect(out).toContain(inner);
  });
});

describe("markdown manager integration", () => {
  it("round-trips ordered-list numbering and nested inline formatting", () => {
    const markdown = [
      "5. **Five**",
      "6. Six",
      "   1. *Nested one*",
      "   2. Nested two",
    ].join("\n");

    const parsed = parseMarkdownDocument(markdown) as TiptapNode;
    const outerList = findNode(parsed, "orderedList");
    expect(outerList?.attrs?.start).toBe(5);
    expect(outerList?.content).toHaveLength(2);
    const nestedList = findNode(
      outerList?.content?.[1] ?? parsed,
      "orderedList",
    );
    expect(nestedList?.attrs?.start ?? 1).toBe(1);
    expect(nestedList?.content).toHaveLength(2);

    const serialized = serializeMarkdownDocument(parsed);
    expect(serialized).toContain("5. **Five**");
    expect(serialized).toContain("6. Six");
    expect(parseMarkdownDocument(serialized)).toEqual(parsed);
  });

  it("round-trips table, image, link, and footnote integrations", () => {
    const markdown = [
      "[Source](https://example.com)",
      "",
      "| Name | Value |",
      "| --- | --- |",
      "| Jant | 1 |",
      "",
      '![Alt text](https://example.com/image.png "Title")',
      "",
      "Body[^note]",
      "",
      "[^note]: Footnote body",
    ].join("\n");

    const parsed = parseMarkdownDocument(markdown) as TiptapNode;
    expect(findNode(parsed, "table")).not.toBeNull();
    expect(findNode(parsed, "image")?.attrs).toMatchObject({
      src: "https://example.com/image.png",
      alt: "Alt text",
      title: "Title",
    });
    expect(findNode(parsed, "footnoteReference")?.attrs?.label).toBe("note");
    expect(findNode(parsed, "footnoteDefinition")?.attrs?.label).toBe("note");
    const linkedText = findNode(parsed, "text");
    expect(linkedText?.marks?.[0]?.type).toBe("link");
    expect(linkedText?.marks?.[0]?.attrs?.href).toBe("https://example.com");

    const serialized = serializeMarkdownDocument(parsed);
    expect(parseMarkdownDocument(serialized)).toEqual(parsed);
  });
});
