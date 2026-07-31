import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { and, asc, eq } from "drizzle-orm";
import {
  assertSnapshotMeta,
  buildReplaceSql,
  buildSnapshotStorageQuery,
  collectSnapshotObjects,
  enumerateSnapshotObjectFiles,
  getSnapshotBootstrapSite,
  remapSnapshotObjectKey,
  rewriteLegacySnapshotSql,
  rewriteSnapshotSiteIdentifiers,
  validateSnapshotTargetSite,
} from "../../bin/lib/site-snapshot.js";
import {
  getCliSiteResolutionMode,
  resolveCliSite,
} from "../../bin/lib/site-selection.js";
import { resolveDatabaseDialect } from "../../src/db/dialect.js";
import { AUTH_ID_PREFIX, createTypeId } from "../../src/lib/ids.js";
import { hashPassword } from "../../src/lib/password.js";
import { now } from "../../src/lib/time.js";
import {
  applyNodeRuntimeEnvDefaults,
  createNodeBindings,
  migrate,
  resolveDatabasePath,
} from "../../src/node/request-handler.js";
import { createNodeCliRuntime } from "../../src/runtime/node.js";
import { createNavItemService } from "../../src/services/navigation.js";
import { createSettingsService } from "../../src/services/settings.js";
import { createSiteMemberService } from "../../src/services/site-member.js";
import { createSiteService } from "../../src/services/site.js";
import type { Bindings } from "../../src/types/bindings.js";
import {
  DEFAULT_DEV_PASSWORD,
  DEFAULT_SITE_NAME,
  DEV_EMAIL,
} from "./dev-auth-db.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const coreDir = resolve(__dirname, "../..");
const repoRoot = resolve(coreDir, "../..");
const envPath = resolve(coreDir, ".env.node");
const canonicalDir = resolve(repoRoot, "sites/demo-source/canonical/snapshot");
const defaultDataDir = resolve(coreDir, "data");
const defaultPort = "3000";

function readEnvLines() {
  if (!existsSync(envPath)) {
    return [];
  }

  return readFileSync(envPath, "utf8").split(/\r?\n/);
}

function parseEnvFile(lines: string[]) {
  const values: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function upsertEnvValue(lines: string[], key: string, value: string) {
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

function resolvePassword(cliPassword: string | undefined) {
  if (cliPassword) {
    return cliPassword;
  }

  const fromProcess = process.env.DEMO_PASSWORD?.trim();
  if (fromProcess) {
    return fromProcess;
  }

  const fromFile = parseEnvFile(readEnvLines()).DEMO_PASSWORD?.trim();
  if (fromFile) {
    return fromFile;
  }

  return DEFAULT_DEV_PASSWORD;
}

function buildRuntimeEnv(password: string, checkOnly: boolean) {
  let lines = readEnvLines();
  const envFileValues = parseEnvFile(lines);
  const merged = {
    ...envFileValues,
    ...process.env,
  };

  const authSecret =
    merged.AUTH_SECRET || randomBytes(32).toString("base64url");
  const devApiToken =
    merged.DEV_API_TOKEN || `jnt_dev_${randomBytes(16).toString("hex")}`;

  const nextEnv = {
    ...merged,
    AUTH_SECRET: authSecret,
    DEMO_EMAIL: DEV_EMAIL,
    DEMO_PASSWORD: password,
    DEV_API_TOKEN: devApiToken,
  } as Bindings;

  if (!checkOnly) {
    lines = upsertEnvValue(lines, "AUTH_SECRET", authSecret);
    lines = upsertEnvValue(lines, "DEV_API_TOKEN", devApiToken);
    lines = upsertEnvValue(lines, "DEMO_EMAIL", DEV_EMAIL);
    lines = upsertEnvValue(lines, "DEMO_PASSWORD", password);
    writeFileSync(
      envPath,
      `${lines.join("\n").replace(/\n+$/u, "").trimEnd()}\n`,
      "utf8",
    );
  }

  applyNodeRuntimeEnvDefaults(nextEnv, {
    cwd: coreDir,
    defaultDataDir,
  });

  return {
    authSecret,
    devApiToken,
    env: nextEnv,
  };
}

function resolveLocalPath(pathValue: unknown, cwd: string) {
  if (!pathValue) {
    return null;
  }

  const normalized = String(pathValue).trim();
  if (!normalized) {
    return null;
  }

  return isAbsolute(normalized) ? normalized : resolve(cwd, normalized);
}

function assertLocalResetConfig(env: Bindings) {
  if (getCliSiteResolutionMode(env) !== "single-site") {
    throw new Error(
      "db-node-rebuild-demo only supports single-site local development. Set SITE_RESOLUTION_MODE=single-site for this workflow.",
    );
  }

  const dialect = resolveDatabaseDialect(env.DATABASE_URL ?? "");
  if (dialect !== "sqlite") {
    throw new Error(
      "db-node-rebuild-demo only supports Node SQLite development databases.",
    );
  }

  const databasePath = resolveDatabasePath(env.DATABASE_URL ?? "", coreDir);
  if (databasePath === ":memory:") {
    throw new Error(
      "db-node-rebuild-demo cannot target an in-memory SQLite database.",
    );
  }

  const storageDriver = String(env.STORAGE_DRIVER ?? "").trim();
  if (storageDriver && storageDriver !== "local") {
    throw new Error(
      "db-node-rebuild-demo only supports STORAGE_DRIVER=local or an unset storage driver.",
    );
  }

  return {
    databasePath,
    localStoragePath: resolveLocalPath(env.LOCAL_STORAGE_PATH, coreDir),
  };
}

async function assertCanonicalSnapshot() {
  if (!existsSync(resolve(canonicalDir, "meta.json"))) {
    throw new Error(
      [
        "Missing canonical demo snapshot at sites/demo-source/canonical/snapshot.",
        "Run `mise run demo-source-export-canonical` first.",
      ].join("\n"),
    );
  }

  const meta = JSON.parse(
    await readFile(resolve(canonicalDir, "meta.json"), "utf8"),
  );

  assertSnapshotMeta(meta);

  return { meta };
}

async function resetLocalFilesystem(paths: {
  databasePath: string;
  localStoragePath: string | null;
}) {
  await rm(paths.databasePath, { force: true });
  await rm(`${paths.databasePath}-shm`, { force: true });
  await rm(`${paths.databasePath}-wal`, { force: true });

  if (paths.localStoragePath) {
    await rm(paths.localStoragePath, { recursive: true, force: true });
  }
}

async function openNodeDatabase(env: Bindings) {
  const { bindings, close } = await createNodeBindings(env);
  const nodeDatabase = bindings.NODE_DATABASE;
  if (!nodeDatabase) {
    await close();
    throw new Error("Node database binding is missing.");
  }

  return {
    bindings,
    close,
    async execute(sql: string) {
      if (bindings.NODE_SQLITE) {
        bindings.NODE_SQLITE.exec(sql);
        return;
      }

      const database = nodeDatabase.db as {
        execute?: (statement: string) => Promise<unknown>;
        run?: (statement: string) => Promise<unknown>;
      };

      if (typeof database.execute === "function") {
        await database.execute(sql);
        return;
      }

      if (typeof database.run === "function") {
        await database.run(sql);
        return;
      }

      throw new Error("Node database binding does not support raw execution.");
    },
    async query<T extends Record<string, unknown>>(sql: string) {
      const result = await nodeDatabase.rawQuery.prepare(sql).all<T>();
      return result.results;
    },
  };
}

async function ensureLocalDevShell(
  bindings: Bindings,
  password: string,
  siteName: string,
) {
  const nodeDatabase = bindings.NODE_DATABASE;
  if (!nodeDatabase) {
    throw new Error("Node database binding is missing.");
  }

  const { db, schema } = nodeDatabase;
  const timestamp = now();
  const authTimestamp = new Date(timestamp * 1000);
  const hashedPassword = await hashPassword(password);
  const credentialUsers = await db
    .select({
      accountRowId: schema.account.id,
      role: schema.user.role,
      userId: schema.user.id,
    })
    .from(schema.user)
    .innerJoin(
      schema.account,
      and(
        eq(schema.account.userId, schema.user.id),
        eq(schema.account.providerId, "credential"),
      ),
    )
    .orderBy(asc(schema.user.createdAt))
    .limit(1);

  let createdCredentialUser = false;
  let promotedToAdmin = false;
  let ownerUserId = credentialUsers[0]?.userId ?? null;

  if (!ownerUserId) {
    ownerUserId = createTypeId(AUTH_ID_PREFIX.user);
    const accountId = createTypeId(AUTH_ID_PREFIX.account);

    await db.insert(schema.user).values({
      createdAt: authTimestamp,
      email: DEV_EMAIL,
      emailVerified: false,
      id: ownerUserId,
      image: null,
      name: siteName,
      role: "admin",
      updatedAt: authTimestamp,
    });
    await db.insert(schema.account).values({
      accessToken: null,
      accountId: ownerUserId,
      accessTokenExpiresAt: null,
      createdAt: authTimestamp,
      id: accountId,
      idToken: null,
      password: hashedPassword,
      providerId: "credential",
      refreshToken: null,
      refreshTokenExpiresAt: null,
      scope: null,
      updatedAt: authTimestamp,
      userId: ownerUserId,
    });

    createdCredentialUser = true;
    promotedToAdmin = true;
  } else {
    promotedToAdmin = credentialUsers[0]?.role !== "admin";

    await db
      .update(schema.user)
      .set({
        email: DEV_EMAIL,
        role: "admin",
        updatedAt: authTimestamp,
      })
      .where(eq(schema.user.id, ownerUserId));
    await db
      .update(schema.account)
      .set({
        password: hashedPassword,
        updatedAt: authTimestamp,
      })
      .where(eq(schema.account.id, credentialUsers[0].accountRowId));
  }

  const siteService = createSiteService(db, schema);
  const existingSite = await siteService.getOnlySite();
  const { site } = await siteService.ensureSingleSite();

  const siteMembers = createSiteMemberService(db, schema);
  const navItems = createNavItemService(db, site.id, schema);
  const settings = createSettingsService(db, site.id, schema);

  const navCountBefore = (await navItems.list()).length;
  const existingSiteName = await settings.get("SITE_NAME");
  const existingLanguage = await settings.get("SITE_LANGUAGE");
  const onboardingComplete = await settings.isOnboardingComplete();

  await siteMembers.ensure(site.id, ownerUserId, "owner");
  if (!onboardingComplete) {
    await navItems.materializeDefaultNavigation();
  }

  if (!existingSiteName) {
    await settings.set("SITE_NAME", siteName);
  }

  if (!existingLanguage) {
    await settings.set("SITE_LANGUAGE", "en");
  }

  if (!onboardingComplete) {
    await settings.completeOnboarding();
  }

  return {
    completedOnboarding: !onboardingComplete,
    createdCredentialUser,
    createdSite: !existingSite,
    promotedToAdmin,
    seededNavigation: (await navItems.list()).length > navCountBefore,
  };
}

async function importCanonicalSnapshot(bindings: Bindings) {
  const opened = await openNodeDatabase(bindings);

  try {
    const runtime = await createNodeCliRuntime(opened.bindings);
    if (!runtime.storage) {
      throw new Error("Snapshot import requires configured local storage.");
    }

    const meta = JSON.parse(
      await readFile(resolve(canonicalDir, "meta.json"), "utf8"),
    );

    assertSnapshotMeta(meta);

    const explicitRemap = true;
    const snapshotSite = getSnapshotBootstrapSite(meta);
    const resolutionMode = getCliSiteResolutionMode(opened.bindings);
    const { site: targetSite } = await resolveCliSite(opened, {
      createIfMissing: false,
      env: opened.bindings,
    });

    const autoRemapSingleSite =
      !explicitRemap &&
      resolutionMode === "single-site" &&
      !!snapshotSite &&
      snapshotSite.id !== targetSite.id;
    const shouldRemapSite = explicitRemap || autoRemapSingleSite;

    if (shouldRemapSite) {
      if (!snapshotSite) {
        throw new Error(
          "--remap-site requires a snapshot with embedded site metadata.",
        );
      }
    } else {
      validateSnapshotTargetSite(meta, targetSite);
    }

    const sourceSiteId = shouldRemapSite ? (snapshotSite?.id ?? "") : "";
    const objectFiles = await enumerateSnapshotObjectFiles(canonicalDir);
    const snapshotObjects = objectFiles.map((entry) => ({
      filePath: entry.filePath,
      contentType: entry.contentType,
      key: shouldRemapSite
        ? remapSnapshotObjectKey(entry.key, sourceSiteId, targetSite.id)
        : entry.key,
    }));
    const snapshotKeys = new Set(snapshotObjects.map((object) => object.key));

    const currentObjectRows = await opened.query(
      buildSnapshotStorageQuery(targetSite.id),
    );
    const currentKeys = new Set(
      collectSnapshotObjects(currentObjectRows).map((object: { key: string }) =>
        String(object.key),
      ),
    );

    for (const object of snapshotObjects) {
      const bytes = new Uint8Array(await readFile(object.filePath));
      await runtime.storage.put(object.key, bytes, {
        contentType: object.contentType || undefined,
      });
    }

    const rawDbSql = await readFile(resolve(canonicalDir, "db.sql"), "utf8");
    const dbSql = snapshotSite
      ? shouldRemapSite
        ? rewriteSnapshotSiteIdentifiers(
            rawDbSql,
            snapshotSite.id,
            targetSite.id,
          )
        : rawDbSql
      : rewriteLegacySnapshotSql(rawDbSql, targetSite.id);
    await opened.execute(`${buildReplaceSql(targetSite.id)}\n${dbSql}`);

    const keysToDelete = [...currentKeys].filter(
      (key) => !snapshotKeys.has(key),
    );
    for (const key of keysToDelete) {
      await runtime.storage.delete(key);
    }
  } finally {
    await opened.close();
  }
}

function printHelp() {
  console.log("Usage: reset-node-dev.ts [password] [--check]");
  console.log("");
  console.log(
    "Reset the local Node SQLite development database, bootstrap local auth, and load the canonical demo snapshot.",
  );
  console.log("");
  console.log("This workflow only supports single-site Node development with");
  console.log("SQLite and local filesystem storage.");
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      check: { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    printHelp();
    return;
  }

  const password = resolvePassword(positionals[0]);
  const checkOnly = values.check;
  const { authSecret, devApiToken, env } = buildRuntimeEnv(password, checkOnly);
  const paths = assertLocalResetConfig(env);
  await assertCanonicalSnapshot();

  if (checkOnly) {
    console.log("Node reset prerequisites look good.");
    console.log(`  Env file:   ${envPath}`);
    console.log(`  Snapshot:   ${canonicalDir}`);
    console.log(`  SQLite DB:  ${paths.databasePath}`);
    if (paths.localStoragePath) {
      console.log(`  Media dir:  ${paths.localStoragePath}`);
    }
    console.log(`  Auth secret present: ${authSecret ? "yes" : "no"}`);
    console.log(`  Dev token present:   ${devApiToken ? "yes" : "no"}`);
    return;
  }

  console.log("Resetting Node development database...");
  await resetLocalFilesystem(paths);

  console.log("Running Node migrations...");
  await migrate(env);

  const opened = await openNodeDatabase(env);
  let bootstrapResult;
  try {
    console.log("Bootstrapping local development shell...");
    bootstrapResult = await ensureLocalDevShell(
      opened.bindings,
      password,
      DEFAULT_SITE_NAME,
    );
  } finally {
    await opened.close();
  }

  console.log("Loading canonical demo snapshot...");
  await importCanonicalSnapshot(env);

  console.log("");
  console.log("Local Node auth is ready.");
  console.log(`  File:      ${envPath}`);
  console.log(`  Email:     ${DEV_EMAIL}`);
  console.log(`  Password:  ${password}`);
  console.log(`  Dev token: ${devApiToken}`);
  console.log(`  SQLite DB: ${paths.databasePath}`);
  if (paths.localStoragePath) {
    console.log(`  Media dir: ${paths.localStoragePath}`);
  }
  if (bootstrapResult.createdCredentialUser) {
    console.log("  Account:   created local credential user");
  }
  if (bootstrapResult.promotedToAdmin) {
    console.log("  Role:      normalized to admin");
  }
  if (bootstrapResult.completedOnboarding) {
    console.log("  Setup:     marked onboarding complete");
  }
  if (bootstrapResult.seededNavigation) {
    console.log("  Nav:       seeded default navigation");
  }
  console.log("");
  console.log("Browser sign-in:");
  console.log(`  http://localhost:${env.PORT || defaultPort}/signin`);
  console.log("");
  console.log("Auto-login:");
  console.log(
    `  http://localhost:${env.PORT || defaultPort}/__dev/login?token=${devApiToken}&redirect=/settings`,
  );
}

await main();
