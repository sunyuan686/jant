import { parseArgs } from "node:util";
import { autoloadNodeEnv } from "../../lib/node-env.js";

const TELEGRAM_API_BASE = "https://api.telegram.org";

async function callTelegram(token, method, body) {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(payload.description ?? `Telegram ${method} failed`);
  }
  return payload.result;
}

export async function run(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      "base-url": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help || !values["base-url"]) {
    console.log(
      "Usage: jant telegram register-webhooks --base-url <public-url>",
    );
    console.log("");
    console.log(
      "Registers a webhook for every bot in TELEGRAM_BOT_TOKENS, pointing at",
    );
    console.log("<base-url>/api/telegram/webhook/<bot_id> with the shared");
    console.log(
      "TELEGRAM_WEBHOOK_SECRET. Run once after configuring the pool.",
    );
    console.log("");
    console.log("Environment (also read from .env.node):");
    console.log(
      "  TELEGRAM_BOT_TOKENS      Comma-separated <bot_id>:<secret> tokens",
    );
    console.log(
      "  TELEGRAM_WEBHOOK_SECRET  Shared secret_token for the webhooks",
    );
    process.exit(values.help ? 0 : 1);
  }

  autoloadNodeEnv();

  const rawTokens = process.env.TELEGRAM_BOT_TOKENS ?? "";
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!rawTokens.trim()) {
    console.error("TELEGRAM_BOT_TOKENS is not set.");
    process.exit(1);
  }
  if (!secret.trim()) {
    console.error("TELEGRAM_WEBHOOK_SECRET is not set.");
    process.exit(1);
  }

  const baseUrl = values["base-url"].replace(/\/+$/, "");
  const tokens = rawTokens
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  let failures = 0;
  for (const token of tokens) {
    const botId = token.split(":")[0]?.trim() ?? "";
    if (!/^\d+$/.test(botId)) {
      console.error(`Skipping malformed token (no numeric bot id).`);
      failures += 1;
      continue;
    }
    const webhookUrl = `${baseUrl}/api/telegram/webhook/${botId}`;
    try {
      const identity = await callTelegram(token, "getMe");
      await callTelegram(token, "setWebhook", {
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ["message", "callback_query"],
      });
      console.log(`@${identity.username} (${botId}) -> ${webhookUrl}`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`Bot ${botId} failed: ${detail}`);
      failures += 1;
    }
  }

  if (failures > 0) {
    console.error(`${failures} bot(s) failed to register.`);
    process.exit(1);
  }
  console.log(`Registered ${tokens.length} webhook(s).`);
}
