import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";

import { promoteLeadingH1Title } from "../compose-title-from-heading.js";

function doc(...content: JSONContent[]): JSONContent {
  return { type: "doc", content };
}

function paragraph(text = ""): JSONContent {
  return text
    ? { type: "paragraph", content: [{ type: "text", text }] }
    : { type: "paragraph" };
}

function heading(level: number, text = ""): JSONContent {
  return text
    ? {
        type: "heading",
        attrs: { level },
        content: [{ type: "text", text }],
      }
    : { type: "heading", attrs: { level } };
}

describe("promoteLeadingH1Title", () => {
  it("extracts the first non-empty H1 and removes it from the body", () => {
    const result = promoteLeadingH1Title(
      doc(paragraph(), heading(1, "  My   Title  "), paragraph("Body")),
    );

    expect(result?.title).toBe("My Title");
    expect(result?.headingIndex).toBe(1);
    expect(result?.bodyJson).toEqual(doc(paragraph("Body")));
  });

  it("returns null when the first non-empty block is not an H1", () => {
    const result = promoteLeadingH1Title(
      doc(paragraph("Intro"), heading(1, "Title")),
    );

    expect(result).toBeNull();
  });

  it("returns null for empty H1 blocks", () => {
    const result = promoteLeadingH1Title(doc(heading(1), paragraph("Body")));

    expect(result).toBeNull();
  });

  it("returns a null body when the promoted H1 is the only content", () => {
    const result = promoteLeadingH1Title(doc(heading(1, "Only title")));

    expect(result?.title).toBe("Only title");
    expect(result?.bodyJson).toBeNull();
  });
});
