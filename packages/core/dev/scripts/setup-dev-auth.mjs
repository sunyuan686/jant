import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import {
  DEFAULT_DEV_PASSWORD,
  DEFAULT_SITE_NAME,
  DEV_EMAIL,
  ensureLocalDevSetup,
} from "./dev-auth-db.mjs";

const ENV_PATH = new URL("../../.dev.vars", import.meta.url);

function readEnvLines() {
  if (!existsSync(ENV_PATH)) {
    return [];
  }

  return readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
}

function readEnvValue(lines, key) {
  const prefix = `${key}=`;
  const line = lines.find((entry) => entry.startsWith(prefix));
  return line ? line.slice(prefix.length) : "";
}

function upsertEnvValue(lines, key, value) {
  const prefix = `${key}=`;
  const nextLines = [];
  let updated = false;

  for (const line of lines) {
    if (line.startsWith(prefix)) {
      nextLines.push(`${key}=${value}`);
      updated = true;
      continue;
    }

    nextLines.push(line);
  }

  if (!updated) {
    if (nextLines.length > 0 && nextLines.at(-1) !== "") {
      nextLines.push("");
    }
    nextLines.push(`${key}=${value}`);
  }

  return nextLines;
}

const cliPassword = process.argv.find(
  (arg) =>
    !arg.startsWith("-") && arg !== process.argv[0] && arg !== process.argv[1],
);
const debugPort = Number(process.env.DEBUG_PORT || "19020");
const localPort = Number(process.env.PORT || "3000");
const localBaseUrl = `http://localhost:${localPort}`;
const debugBaseUrl = `http://localhost:${debugPort}`;
const localtestBaseUrl = `http://jant.localtest.me:${localPort}`;
const localtestDebugBaseUrl = `http://jant.localtest.me:${debugPort}`;

let lines = readEnvLines();

const password =
  cliPassword?.trim() ||
  process.env.DEMO_PASSWORD?.trim() ||
  readEnvValue(lines, "DEMO_PASSWORD").trim() ||
  DEFAULT_DEV_PASSWORD;

const authSecret =
  readEnvValue(lines, "AUTH_SECRET") || randomBytes(32).toString("base64");
const devApiToken =
  readEnvValue(lines, "DEV_API_TOKEN") ||
  `jnt_dev_${randomBytes(16).toString("hex")}`;

lines = upsertEnvValue(lines, "AUTH_SECRET", authSecret);
lines = upsertEnvValue(lines, "DEV_API_TOKEN", devApiToken);
lines = upsertEnvValue(lines, "DEMO_EMAIL", DEV_EMAIL);
lines = upsertEnvValue(lines, "DEMO_PASSWORD", password);

writeFileSync(
  ENV_PATH,
  `${lines.join("\n").replace(/\n+$/u, "").trimEnd()}\n`,
  "utf8",
);

const ensured = await ensureLocalDevSetup({
  password,
  flag: "--local",
  siteName: DEFAULT_SITE_NAME,
});

console.log("");
console.log("Local dev auth is ready.");
console.log(`  File:      ${ENV_PATH.pathname}`);
console.log(`  Email:     ${DEV_EMAIL}`);
console.log(`  Password:  ${password}`);
console.log(`  Dev token: ${devApiToken}`);
if (ensured.createdCredentialUser) {
  console.log("  Account:   created local credential user");
}
if (ensured.promotedToAdmin) {
  console.log("  Role:      normalized to admin");
}
if (ensured.completedOnboarding) {
  console.log("  Setup:     marked onboarding complete");
}
if (ensured.seededNavigation) {
  console.log("  Nav:       seeded default navigation");
}
console.log("");
console.log("Browser sign-in:");
console.log(`  ${localBaseUrl}/signin`);
console.log(`  ${debugBaseUrl}/signin`);
console.log("");
console.log("Auto-login:");
console.log(
  `  ${localBaseUrl}/__dev/login?token=${devApiToken}&redirect=/settings`,
);
console.log(
  `  ${debugBaseUrl}/__dev/login?token=${devApiToken}&redirect=/settings`,
);
console.log("");
console.log("Other local hostnames accepted by /__dev/login:");
console.log(`  ${localtestBaseUrl}/signin`);
console.log(`  ${localtestDebugBaseUrl}/signin`);
console.log(
  `  ${localtestBaseUrl}/__dev/login?token=${devApiToken}&redirect=/settings`,
);
console.log(
  `  ${localtestDebugBaseUrl}/__dev/login?token=${devApiToken}&redirect=/settings`,
);
console.log(
  "  Prefer localhost in browsers to avoid HTTPS upgrades on *.localtest.me.",
);
console.log("");
console.log("HTTP agent flow:");
console.log(
  "  Request the /__dev/login URL directly, capture Set-Cookie, then reuse it.",
);
