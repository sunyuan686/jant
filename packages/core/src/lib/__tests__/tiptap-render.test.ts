import { describe, expect, it } from "vitest";
import {
  renderTiptapDocument,
  renderTiptapJson,
  trimTiptapBody,
} from "../tiptap-render.js";

function doc(...content: Record<string, unknown>[]) {
  return { type: "doc", content };
}

function p(...content: Record<string, unknown>[]) {
  return { type: "paragraph", content };
}

function text(value: string, marks?: Record<string, unknown>[]) {
  return marks
    ? { type: "text", text: value, marks }
    : { type: "text", text: value };
}

describe("renderTiptapDocument", () => {
  it("renders parsed document objects directly", () => {
    expect(renderTiptapDocument(doc(p(text("Hello world"))))).toBe(
      "<p>Hello world</p>",
    );
  });

  it("renders links with safe target attributes when present", () => {
    const html = renderTiptapDocument(
      doc(
        p(
          text("OpenAI", [
            {
              type: "link",
              attrs: {
                href: "https://openai.com",
                target: "_blank",
              },
            },
          ]),
        ),
      ),
    );

    expect(html).toBe(
      '<p><a href="https://openai.com" target="_blank" rel="noopener noreferrer">OpenAI</a></p>',
    );
  });

  it("renders rich image figures consistently", () => {
    const html = renderTiptapDocument(
      doc({
        type: "image",
        attrs: {
          src: "https://example.com/img.png",
          alt: "Alt",
          title: "Title",
          caption: "Caption",
          href: "https://example.com/source",
          layout: "wide",
        },
      }),
    );

    expect(html).toBe(
      '<figure data-layout="wide"><a href="https://example.com/source"><img src="https://example.com/img.png" alt="Alt" title="Title"></a><figcaption>Caption</figcaption></figure>',
    );
  });

  it("renders footnote references as inline sidenotes", () => {
    const html = renderTiptapDocument(
      doc(
        p(text("Body copy"), {
          type: "footnoteReference",
          attrs: { label: "1" },
        }),
        {
          type: "footnoteDefinition",
          attrs: { label: "1" },
          content: [p(text("Footnote body"))],
        },
      ),
    );

    expect(html).toBe(
      '<p>Body copy<label for="sn-1" class="margin-toggle sidenote-number footref"></label>' +
        '<input type="checkbox" id="sn-1" class="margin-toggle footref-toggle"/>' +
        '<span class="sidenote">Footnote body</span></p>',
    );
  });

  it("renders footnote reference without definition gracefully", () => {
    const html = renderTiptapDocument(
      doc(
        p(text("Body copy"), {
          type: "footnoteReference",
          attrs: { label: "1" },
        }),
      ),
    );

    expect(html).toBe(
      '<p>Body copy<label for="sn-1" class="margin-toggle sidenote-number footref"></label>' +
        '<input type="checkbox" id="sn-1" class="margin-toggle footref-toggle"/>' +
        '<span class="sidenote"></span></p>',
    );
  });

  it("renders code blocks as escaped text, not nested inline markup", () => {
    const html = renderTiptapDocument(
      doc({
        type: "codeBlock",
        attrs: { language: "ts" },
        content: [{ type: "text", text: "const x = `<div>`;" }],
      }),
    );

    expect(html).toBe(
      '<pre><code class="language-ts">const x = `&lt;div&gt;`;</code></pre>',
    );
  });

  it("falls back to rendering children for unknown nodes", () => {
    const html = renderTiptapDocument(
      doc({
        type: "unknownWrapper",
        content: [p(text("Still visible"))],
      }),
    );

    expect(html).toBe("<p>Still visible</p>");
  });
});

describe("renderTiptapJson", () => {
  it("returns an empty string for invalid JSON", () => {
    expect(renderTiptapJson("not json")).toBe("");
  });

  it("returns an empty string for non-doc JSON", () => {
    expect(renderTiptapDocument({ type: "paragraph" })).toBe("");
  });
});

describe("trimTiptapBody", () => {
  it("removes leading empty paragraphs", () => {
    const input = JSON.stringify(doc(p(), p(text("Hello"))));
    const expected = JSON.stringify(doc(p(text("Hello"))));
    expect(trimTiptapBody(input)).toBe(expected);
  });

  it("removes trailing empty paragraphs", () => {
    const input = JSON.stringify(doc(p(text("Hello")), p(), p()));
    const expected = JSON.stringify(doc(p(text("Hello"))));
    expect(trimTiptapBody(input)).toBe(expected);
  });

  it("removes both leading and trailing empty paragraphs", () => {
    const input = JSON.stringify(doc(p(), p(text("Hello")), p()));
    const expected = JSON.stringify(doc(p(text("Hello"))));
    expect(trimTiptapBody(input)).toBe(expected);
  });

  it("preserves inner empty paragraphs", () => {
    const input = JSON.stringify(doc(p(text("A")), p(), p(text("B"))));
    expect(trimTiptapBody(input)).toBe(input);
  });

  it("returns null when all paragraphs are empty", () => {
    const input = JSON.stringify(doc(p(), p()));
    expect(trimTiptapBody(input)).toBeNull();
  });

  it("returns the original string when no trimming needed", () => {
    const input = JSON.stringify(doc(p(text("Hello"))));
    expect(trimTiptapBody(input)).toBe(input);
  });

  it("treats whitespace-only text as empty", () => {
    const input = JSON.stringify(
      doc(p(text("  ")), p(text("Hello")), p(text("\n"))),
    );
    const expected = JSON.stringify(doc(p(text("Hello"))));
    expect(trimTiptapBody(input)).toBe(expected);
  });

  it("does not strip paragraphs with images", () => {
    const imgParagraph = {
      type: "paragraph",
      content: [{ type: "image", attrs: { src: "test.png" } }],
    };
    const input = JSON.stringify(doc(imgParagraph, p()));
    const expected = JSON.stringify(doc(imgParagraph));
    expect(trimTiptapBody(input)).toBe(expected);
  });

  it("does not strip non-paragraph blocks like headings with content", () => {
    const heading = {
      type: "heading",
      attrs: { level: 1 },
      content: [text("Title")],
    };
    const input = JSON.stringify(doc(p(), heading, p()));
    const expected = JSON.stringify(doc(heading));
    expect(trimTiptapBody(input)).toBe(expected);
  });

  it("strips empty headings", () => {
    const emptyHeading = { type: "heading", attrs: { level: 1 } };
    const input = JSON.stringify(doc(emptyHeading, p(text("Hello"))));
    const expected = JSON.stringify(doc(p(text("Hello"))));
    expect(trimTiptapBody(input)).toBe(expected);
  });

  it("returns original string for invalid JSON", () => {
    expect(trimTiptapBody("not json")).toBe("not json");
  });

  it("returns original string for non-doc JSON", () => {
    const input = JSON.stringify({ type: "paragraph" });
    expect(trimTiptapBody(input)).toBe(input);
  });
});
