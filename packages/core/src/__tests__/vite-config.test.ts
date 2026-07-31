import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveWorkerDevProcessOptions } from "../../vite.config.js";

describe("worker Vite config", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createEnvDir(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), "jant-vite-env-"));
    tempDirs.push(dir);

    for (const [name, contents] of Object.entries(files)) {
      writeFileSync(join(dir, name), contents);
    }

    return dir;
  }

  it("loads the worker dev port from .env", () => {
    vi.stubEnv("PORT", undefined);
    const envDir = createEnvDir({ ".env": "PORT=3012\n" });

    expect(resolveWorkerDevProcessOptions("development", envDir).port).toBe(
      3012,
    );
  });

  it("lets the shell environment override .env", () => {
    const envDir = createEnvDir({ ".env": "PORT=3012\n" });
    vi.stubEnv("PORT", "4012");

    expect(resolveWorkerDevProcessOptions("development", envDir).port).toBe(
      4012,
    );
  });
});
