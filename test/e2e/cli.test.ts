import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Layer 4 — E2E. Spawns the REAL built bin (`dist/cli.js`) as a separate process
 * against a fixture project. This is the only layer that exercises the true
 * dual-bundle boundary end-to-end (globalThis registry + cross-bundle error
 * brand) plus real process exit codes.
 */

const here = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(here, "../../dist/cli.js");
const DIST_INDEX = resolve(here, "../../dist/index.js");

const SCHEMA = `
import { defineEnv, str, port, bool, oneOf } from ${JSON.stringify(DIST_INDEX)};
export const env = defineEnv({
  NODE_ENV: oneOf(["development","production","test"]).default("development"),
  PORT: port().default(3000),
  DATABASE_URL: str().desc("Postgres connection string"),
  STRIPE_KEY: str().secret().startsWith("sk_"),
  DEBUG: bool().default(false),
});
`;

const dirs: string[] = [];
function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "envguard-e2e-"));
  writeFileSync(join(dir, "env.ts"), SCHEMA);
  dirs.push(dir);
  return dir;
}

function cli(cwd: string, args: string[], env: Record<string, string> = {}) {
  const res = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", ...env },
  });
  return { code: res.status, out: res.stdout ?? "", err: res.stderr ?? "" };
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("e2e: real bin", () => {
  it("--help exits 0", () => {
    const r = cli(fixture(), ["--help"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("Usage:");
  });

  it("example writes .env.example (exit 0)", () => {
    const dir = fixture();
    const r = cli(dir, ["example"]);
    expect(r.code).toBe(0);
    expect(existsSync(join(dir, ".env.example"))).toBe(true);
  });

  it("sync is clean right after example (exit 0), drift after edit (exit 1)", () => {
    const dir = fixture();
    cli(dir, ["example"]);
    expect(cli(dir, ["sync"]).code).toBe(0);
    writeFileSync(join(dir, ".env.example"), "ONLY_ORPHAN=1\n");
    expect(cli(dir, ["sync"]).code).toBe(1);
  });

  it("doctor fails on incomplete env (exit 1) and passes when complete (exit 0)", () => {
    const dir = fixture();
    const bad = cli(dir, ["doctor"]);
    expect(bad.code).toBe(1);
    expect(bad.out).toContain("failed validation");

    const good = cli(dir, ["doctor"], {
      DATABASE_URL: "postgres://localhost/db",
      STRIPE_KEY: "sk_live_1",
    });
    expect(good.code).toBe(0);
    expect(good.out).toContain("valid");
  });

  it("doctor redacts secrets in its report (no leak)", () => {
    const r = cli(fixture(), ["doctor"], { STRIPE_KEY: "pk_leak_me_e2e" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("***");
    expect(r.out).not.toContain("leak_me_e2e");
  });
});
