import { parseArgs } from "node:util";
import { resolveSiteUrl } from "../../lib/site-url.js";

const INTERNAL_ADMIN_TOKEN_ENV_VAR = "INTERNAL_ADMIN_TOKEN";
const DEFAULT_LIMIT = 20;

function normalizeBaseUrl(value) {
  const trimmed = value.trim();
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function buildCleanupUrl(siteUrl) {
  return new URL(
    "api/internal/uploads/cleanup",
    normalizeBaseUrl(siteUrl),
  ).toString();
}

function parseLimit(rawLimit) {
  if (rawLimit === undefined) {
    return DEFAULT_LIMIT;
  }

  const limit = Number.parseInt(rawLimit, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("Cleanup limit must be an integer between 1 and 500.");
  }

  return limit;
}

async function requestCleanup(url, token, limit) {
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

export async function run(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      config: { type: "string" },
      env: { type: "string" },
      help: { type: "boolean", short: "h" },
      limit: { type: "string" },
      token: { type: "string" },
      url: { type: "string" },
    },
  });

  if (values.help) {
    console.log("Usage: jant uploads cleanup [--url <url>] [options]");
    console.log("");
    console.log("Clean up expired temporary upload sessions.");
    console.log("");
    console.log("Options:");
    console.log("  --url           Target site URL");
    console.log("  --limit         Cleanup batch size (default: 20, max: 500)");
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
      "  jant uploads cleanup --url https://your-site.example --limit 50",
    );
    console.log("");
    console.log(
      "If --url is omitted, the command uses SITE_ORIGIN + SITE_PATH_PREFIX from the environment or wrangler.toml.",
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
      "Error: upload cleanup requires --url or SITE_ORIGIN in the environment or wrangler.toml.",
    );
    process.exit(1);
  }

  const token =
    values.token?.trim() || process.env[INTERNAL_ADMIN_TOKEN_ENV_VAR]?.trim();
  if (!token) {
    console.error(
      `Error: upload cleanup requires --token or ${INTERNAL_ADMIN_TOKEN_ENV_VAR}.`,
    );
    process.exit(1);
  }

  const limit = parseLimit(values.limit);
  const cleanupUrl = buildCleanupUrl(siteUrl);

  console.log(`Cleaning expired uploads for ${siteUrl}...`);
  const result = await requestCleanup(cleanupUrl, token, limit);
  console.log(`Deleted sessions: ${result.deletedSessions}`);
  console.log(`Aborted multipart uploads: ${result.abortedMultipartUploads}`);
  console.log(`Orphaned media deleted: ${result.deletedOrphanMedia}`);
  console.log(`Purged storage objects: ${result.purgedStorageObjects ?? 0}`);
}
