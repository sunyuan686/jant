import SITE_SKILL_TEMPLATE from "../../../../docs/skill.md?raw";
import { normalizeSiteUrl } from "./url.js";

const INTRODUCTION =
  "This page is written for AI assistants working with one Jant site. Use it when the user asks you to read, publish, edit, organize, search, or migrate site content through Jant's HTTP API or MCP interface.";
const GENERIC_SITE_URL = "https://example.com";
const GENERIC_SITE_CONFIRMATION = `- The Jant site URL (e.g. \`${GENERIC_SITE_URL}\`).`;
const GENERIC_SITE_EXPORT = `export JANT_SITE=${GENERIC_SITE_URL}\n`;
const GENERIC_SITE_MARKERS = [
  GENERIC_SITE_CONFIRMATION,
  GENERIC_SITE_EXPORT,
  "<site>",
  "$JANT_SITE",
];

function replaceLiteral(
  content: string,
  search: string,
  replacement: string,
): string {
  return content.replaceAll(search, () => replacement);
}

/**
 * Render the Agent skill for one concrete Jant site.
 *
 * @param siteUrl - Resolved public site URL, including any path prefix
 * @returns Markdown with every target-site placeholder bound to `siteUrl`
 * @example
 * ```ts
 * renderSiteSkill("https://example.com/blog");
 * ```
 */
export function renderSiteSkill(siteUrl: string): string {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  if (!normalizedSiteUrl) {
    throw new Error("A public site URL is required to render /skill.md");
  }

  const targetSiteUrl = normalizedSiteUrl.replace(/\/$/, "");
  if (!SITE_SKILL_TEMPLATE.includes(INTRODUCTION)) {
    throw new Error("The site skill template introduction could not be found");
  }
  const missingMarker = GENERIC_SITE_MARKERS.find(
    (marker) => !SITE_SKILL_TEMPLATE.includes(marker),
  );
  if (missingMarker) {
    throw new Error(
      `The site skill template target marker could not be found: ${missingMarker}`,
    );
  }

  let content = SITE_SKILL_TEMPLATE;
  content = replaceLiteral(content, GENERIC_SITE_EXPORT, "");
  content = replaceLiteral(
    content,
    GENERIC_SITE_CONFIRMATION,
    `- That the target Jant site is \`${targetSiteUrl}\`.`,
  );
  content = replaceLiteral(content, "<site>", targetSiteUrl);
  content = replaceLiteral(content, "$JANT_SITE", targetSiteUrl);
  content = replaceLiteral(
    content,
    INTRODUCTION,
    `${INTRODUCTION}\n\nThis site-scoped copy is bound to <${targetSiteUrl}>. Send every API request in this guide to this exact base URL. Do not substitute another target without the user's confirmation.`,
  );

  const unresolvedMarker = ["<site>", "$JANT_SITE"].find((marker) =>
    content.includes(marker),
  );
  if (unresolvedMarker) {
    throw new Error(
      `The site skill template contains an unresolved target marker: ${unresolvedMarker}`,
    );
  }

  return content;
}
