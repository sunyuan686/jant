#!/usr/bin/env node
/**
 * Compute dashboard-settings translation coverage from .po files.
 *
 * Reads `src/i18n/locales/settings/*.po`, counts non-empty msgstr entries,
 * and emits `src/i18n/coverage.generated.ts` containing a ratio per locale.
 *
 * Run via `pnpm i18n:coverage` (also chained from `pnpm i18n:build`).
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const PO_DIR = join(ROOT, "src/i18n/locales/settings");
const OUT_FILE = join(ROOT, "src/i18n/coverage.generated.ts");

/**
 * Parse a `.po` file and return `{ total, translated }` counts.
 *
 * Rules:
 * - Skips the empty-msgid header block.
 * - Treats `#, fuzzy` flagged entries as untranslated.
 * - Plural entries count as translated when any `msgstr[N]` is non-empty.
 */
function countCoverage(content) {
  const lines = content.split("\n");
  let total = 0;
  let translated = 0;
  let i = 0;

  while (i < lines.length) {
    let fuzzy = false;

    // Walk through comments / flags up to the next msgid.
    while (i < lines.length && !lines[i].startsWith("msgid")) {
      if (lines[i].startsWith("#,") && /\bfuzzy\b/.test(lines[i])) {
        fuzzy = true;
      }
      i++;
    }
    if (i >= lines.length) break;

    const msgid = readQuotedBlock(lines, i, "msgid");
    i = msgid.next;

    if (i < lines.length && lines[i].startsWith("msgid_plural")) {
      i = readQuotedBlock(lines, i, "msgid_plural").next;
    }

    let strValue = "";
    while (i < lines.length && lines[i].startsWith("msgstr")) {
      const prefixMatch = lines[i].match(/^msgstr(\[\d+\])?/);
      if (!prefixMatch) break;
      const block = readQuotedBlock(lines, i, prefixMatch[0]);
      strValue += block.value;
      i = block.next;
    }

    while (i < lines.length && lines[i].trim() === "") i++;

    // The header has empty msgid; skip it.
    if (msgid.value === "") continue;

    total++;
    if (!fuzzy && strValue.length > 0) translated++;
  }

  return { total, translated };
}

/**
 * Read a `prefix "..."` block plus any continuation `"..."` lines.
 * Returns the concatenated raw string contents (escape sequences preserved
 * literally — sufficient for emptiness checks).
 */
function readQuotedBlock(lines, start, prefix) {
  let value = "";
  const firstMatch = lines[start].match(
    /^(?:msgid|msgid_plural|msgstr(?:\[\d+\])?)\s+"((?:[^"\\]|\\.)*)"\s*$/,
  );
  if (firstMatch) value += firstMatch[1];

  let i = start + 1;
  while (i < lines.length) {
    const m = lines[i].match(/^"((?:[^"\\]|\\.)*)"\s*$/);
    if (!m) break;
    value += m[1];
    i++;
  }
  return { value, next: i };
}

const files = readdirSync(PO_DIR)
  .filter((f) => f.endsWith(".po"))
  .sort();

if (files.length === 0) {
  console.error(`No .po files found in ${PO_DIR}`);
  process.exit(1);
}

const coverage = {};
for (const file of files) {
  const locale = file.replace(/\.po$/, "");
  const content = readFileSync(join(PO_DIR, file), "utf8");
  const { total, translated } = countCoverage(content);
  if (locale === "en") {
    // English is the source catalog, not a translation; pin to 1.
    coverage[locale] = 1;
  } else {
    coverage[locale] = total === 0 ? 0 : translated / total;
  }
}

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const formatKey = (key) => (IDENT_RE.test(key) ? key : JSON.stringify(key));
const entries = Object.entries(coverage)
  .map(([locale, ratio]) => `  ${formatKey(locale)}: ${ratio},`)
  .join("\n");

const output = `/**
 * AUTO-GENERATED. Do not edit by hand.
 *
 * Dashboard-settings translation completeness, computed at build time from
 * \`src/i18n/locales/settings/*.po\`. Run \`pnpm i18n:coverage\` to regenerate
 * after updating translations.
 *
 * Each value is in [0, 1]. \`en\` is the source language and is fixed at 1.
 */

import type { Locale } from "./locales.js";

export const SETTINGS_TRANSLATION_COVERAGE: Record<Locale, number> = {
${entries}
} as const;
`;

if (existsSync(OUT_FILE) && readFileSync(OUT_FILE, "utf8") === output) {
  console.log(`Unchanged ${OUT_FILE}`);
} else {
  writeFileSync(OUT_FILE, output);
  console.log(`Wrote ${OUT_FILE}`);
}

for (const [locale, ratio] of Object.entries(coverage)) {
  console.log(`  ${locale}: ${(ratio * 100).toFixed(1)}%`);
}
