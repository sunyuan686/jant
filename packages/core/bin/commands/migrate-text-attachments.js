import { parseArgs } from "node:util";
import { resolveSiteUrl } from "../lib/site-url.js";

const INTERNAL_ADMIN_TOKEN_ENV_VAR = "INTERNAL_ADMIN_TOKEN";
const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 500;

function normalizeBaseUrl(value) {
  const trimmed = value.trim();
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function buildMigrationUrl(siteUrl) {
  return new URL(
    "api/internal/text-attachments/migrate-envelopes",
    normalizeBaseUrl(siteUrl),
  ).toString();
}

function parseBatchSize(rawLimit) {
  if (rawLimit === undefined) {
    return DEFAULT_BATCH_SIZE;
  }

  const limit = Number.parseInt(rawLimit, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BATCH_SIZE) {
    throw new Error(
      `Batch size must be an integer between 1 and ${MAX_BATCH_SIZE}.`,
    );
  }
  return limit;
}

async function requestBatch(url, token, limit) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ limit }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
  }

  return response.json();
}

function logBatchResult(batchIndex, result) {
  console.log(
    `  batch ${batchIndex}: migrated=${result.migrated} failed=${result.failed} remaining=${result.remaining}`,
  );
  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.error(`    ! ${err.mediaId}: ${err.message}`);
    }
  }
}

export async function run(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      config: { type: "string" },
      env: { type: "string" },
      help: { type: "boolean", short: "h" },
      limit: { type: "string" },
      once: { type: "boolean", default: false },
      token: { type: "string" },
      url: { type: "string" },
    },
  });

  if (values.help) {
    console.log("Usage: jant migrate-text-attachments [--url <url>] [options]");
    console.log("");
    console.log("Convert legacy text attachments to the current markdown-only");
    console.log("storage format. Handles both prior layouts:");
    console.log("  - envelope era (text/x-tiptap+json single blob)");
    console.log("  - split era (text/html; charset=utf-8 + .json sibling)");
    console.log("");
    console.log(
      "Idempotent — current markdown rows are detected by MIME and skipped",
    );
    console.log("on re-run.");
    console.log("");
    console.log("Options:");
    console.log("  --url           Target site URL");
    console.log(
      `  --limit         Batch size per request (default: ${DEFAULT_BATCH_SIZE}, max: ${MAX_BATCH_SIZE})`,
    );
    console.log(
      "  --once          Run a single batch and exit (default: loop until drained)",
    );
    console.log("  --token         Internal admin token");
    console.log(
      "  --config        Wrangler config file (default: wrangler.toml)",
    );
    console.log("  --env           Wrangler environment name");
    console.log("");
    console.log("Authentication:");
    console.log(
      `  export ${INTERNAL_ADMIN_TOKEN_ENV_VAR}=your-internal-admin-token`,
    );
    console.log(
      "  jant migrate-text-attachments --url https://your-site.example",
    );
    console.log("");
    console.log(
      "If --url is omitted, uses SITE_ORIGIN + SITE_PATH_PREFIX from env or wrangler.toml.",
    );
    process.exit(0);
  }

  const siteUrl = resolveSiteUrl({
    url: values.url,
    config: values.config,
    env: values.env,
  });
  if (!siteUrl) {
    console.error(
      "Error: migration requires --url or SITE_ORIGIN in the environment or wrangler.toml.",
    );
    process.exit(1);
  }

  const token =
    values.token?.trim() || process.env[INTERNAL_ADMIN_TOKEN_ENV_VAR]?.trim();
  if (!token) {
    console.error(
      `Error: migration requires --token or ${INTERNAL_ADMIN_TOKEN_ENV_VAR}.`,
    );
    process.exit(1);
  }

  const batchSize = parseBatchSize(values.limit);
  const migrationUrl = buildMigrationUrl(siteUrl);

  console.log(`Migrating legacy text attachments for ${siteUrl}`);
  console.log(
    `  batch size: ${batchSize}${values.once ? " (single batch)" : ""}`,
  );

  let totalMigrated = 0;
  let totalFailed = 0;
  let batchIndex = 0;

  for (;;) {
    batchIndex += 1;
    const result = await requestBatch(migrationUrl, token, batchSize);
    logBatchResult(batchIndex, result);

    totalMigrated += result.migrated;
    totalFailed += result.failed;

    if (values.once) break;

    // Stop when the server reports nothing remaining, or when we made no
    // progress on a full batch (prevents infinite loops if every record
    // keeps failing for the same reason).
    if (result.remaining === 0) break;
    if (result.migrated === 0 && result.failed > 0) {
      console.error(
        "No records could be migrated in this batch; aborting to avoid an infinite loop.",
      );
      break;
    }
  }

  console.log("");
  console.log(
    `Done. migrated=${totalMigrated} failed=${totalFailed} batches=${batchIndex}`,
  );

  if (totalFailed > 0) {
    process.exit(1);
  }
}
