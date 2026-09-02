import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { run, type RunIO } from "../src/cli/run";

const here = dirname(fileURLToPath(import.meta.url));
const DIST_INDEX = resolve(here, "../dist/index.js");

const SCHEMA_BODY = `
import { defineEnv, str, port, bool, oneOf } from ${JSON.stringify(DIST_INDEX)};
export const env = defineEnv({
  NODE_ENV: oneOf(["development", "production", "test"]).default("development"),
  PORT: port().default(3000),
  DATABASE_URL: str().desc("Postgres connection string"),
  STRIPE_KEY: str().secret().startsWith("sk_"),
  DEBUG: bool().default(false),
});
`;

const dirs: string[] = [];
function fixture(body = SCHEMA_BODY): string {
  const dir = mkdtempSync(join(tmpdir(), "prahari-cli-"));
  writeFileSync(join(dir, "env.ts"), body);
  dirs.push(dir);
  return dir;
}

function capture(cwd: string, env?: Record<string, string | undefined>) {
  const out: string[] = [];
  const err: string[] = [];
  const io: RunIO = {
    cwd,
    env,
    stdout: (s) => out.push(s),
    stderr: (s) => err.push(s),
  };
  return { io, out: () => out.join(""), err: () => err.join("") };
}

beforeEach(() => {
  delete process.env.PRAHARI_SKIP_VALIDATION;
});
afterEach(() => {
  delete process.env.PRAHARI_SKIP_VALIDATION;
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("run — help & routing", () => {
  it("prints help with --help (exit 0)", async () => {
    const c = capture(process.cwd());
    expect(await run(["--help"], c.io)).toBe(0);
    expect(c.out()).toContain("Usage:");
  });
  it("prints help and exits 1 with no command", async () => {
    const c = capture(process.cwd());
    expect(await run([], c.io)).toBe(1);
    expect(c.out()).toContain("Commands:");
  });
  it("errors on an unknown command (exit 1)", async () => {
    const c = capture(process.cwd());
    expect(await run(["frobnicate"], c.io)).toBe(1);
    expect(c.err()).toContain("unknown command");
  });
  it("errors on an unknown option (exit 1)", async () => {
    const c = capture(fixture());
    expect(await run(["example", "--nope"], c.io)).toBe(1);
    expect(c.err()).toContain("Usage:");
  });
});

describe("run — config resolution", () => {
  it("fails clearly when no config is found", async () => {
    const c = capture(mkdtempSync(join(tmpdir(), "prahari-empty-")));
    expect(await run(["example"], c.io)).toBe(1);
    expect(c.err()).toContain("no env config found");
  });
  it("fails when the config registers no schema", async () => {
    const c = capture(fixture("export const nothing = 1;\n"));
    expect(await run(["example"], c.io)).toBe(1);
    expect(c.err()).toContain("no schema was registered");
  });
  it("fails when the config throws on load", async () => {
    const c = capture(fixture("throw new Error('boom');\n"));
    expect(await run(["example"], c.io)).toBe(1);
    expect(c.err()).toContain("failed to load");
  });
});

describe("run — example", () => {
  it("writes a .env.example (exit 0, secrets blank)", async () => {
    const dir = fixture();
    const c = capture(dir);
    expect(await run(["example"], c.io)).toBe(0);
    expect(c.out()).toContain("wrote 5 variable(s)");
    const content = readFileSync(join(dir, ".env.example"), "utf8");
    expect(content).toContain("DATABASE_URL=");
    expect(content).toContain("# Postgres connection string");
    expect(content).toMatch(/STRIPE_KEY=\n/); // secret value left blank
    expect(content).toContain("NODE_ENV=development");
  });
  it("prints to stdout with --stdout and writes no file", async () => {
    const dir = fixture();
    const c = capture(dir);
    expect(await run(["example", "--stdout"], c.io)).toBe(0);
    expect(c.out()).toContain("PORT=3000");
    expect(existsSync(join(dir, ".env.example"))).toBe(false);
  });
  it("honors --out", async () => {
    const dir = fixture();
    const c = capture(dir);
    expect(await run(["example", "--out", "custom.env"], c.io)).toBe(0);
    expect(existsSync(join(dir, "custom.env"))).toBe(true);
  });
});

describe("run — sync", () => {
  it("reports in-sync (exit 0) right after example", async () => {
    const dir = fixture();
    await run(["example"], capture(dir).io);
    const c = capture(dir);
    expect(await run(["sync"], c.io)).toBe(0);
    expect(c.out()).toContain("in sync");
  });
  it("reports drift (exit 1) with missing and unknown keys", async () => {
    const dir = fixture();
    writeFileSync(join(dir, ".env.example"), "NODE_ENV=development\nORPHAN=1\n");
    const c = capture(dir);
    expect(await run(["sync"], c.io)).toBe(1);
    expect(c.out()).toContain("drifted");
    expect(c.out()).toContain("PORT");
    expect(c.out()).toContain("ORPHAN");
  });
  it("errors when the target file is missing (exit 1)", async () => {
    const c = capture(fixture());
    expect(await run(["sync"], c.io)).toBe(1);
    expect(c.err()).toContain("does not exist");
  });
});

describe("run — docs", () => {
  it("prints a Markdown table to stdout (exit 0)", async () => {
    const c = capture(fixture());
    expect(await run(["docs"], c.io)).toBe(0);
    expect(c.out()).toContain("| Variable | Type | Required | Default | Description |");
    expect(c.out()).toContain("`DATABASE_URL`");
  });
  it("writes to a file with --out", async () => {
    const dir = fixture();
    const c = capture(dir);
    expect(await run(["docs", "--out", "ENV.md"], c.io)).toBe(0);
    expect(c.out()).toContain("wrote docs for");
    expect(readFileSync(join(dir, "ENV.md"), "utf8")).toContain("| Variable |");
  });
});

describe("run — doctor", () => {
  const validEnv = {
    DATABASE_URL: "postgres://localhost/db",
    STRIPE_KEY: "sk_live_123",
  };

  it("passes with a valid environment (exit 0)", async () => {
    const c = capture(fixture(), validEnv);
    expect(await run(["doctor"], c.io)).toBe(0);
    expect(c.out()).toContain("All 5 variable(s) valid");
  });
  it("fails and reports missing/invalid, redacting secrets (exit 1)", async () => {
    const c = capture(fixture(), { STRIPE_KEY: "pk_leak_me" });
    expect(await run(["doctor"], c.io)).toBe(1);
    const out = c.out();
    expect(out).toContain("failed validation");
    expect(out).toContain("DATABASE_URL");
    expect(out).toContain("***");
    expect(out).not.toContain("leak_me"); // secret never printed
  });
});

describe("doctor --env-file", () => {
  it("validates against the file plus the current environment", async () => {
    const dir = fixture();
    writeFileSync(join(dir, ".env"), "DATABASE_URL=postgres://localhost\nSTRIPE_KEY=sk_live_1\n");
    const { io, out } = capture(dir, {});
    const code = await run(["doctor", "--env-file", ".env"], io);
    expect(code).toBe(0);
    expect(out()).toContain("against .env + the current environment");
    expect(out()).toMatch(/All 5 variable\(s\) valid\./);
  });

  it("still lets the real environment win over the file", async () => {
    const dir = fixture();
    writeFileSync(join(dir, ".env"), "DATABASE_URL=postgres://localhost\nSTRIPE_KEY=nope\n");
    // The shell value is valid; the file's is not — the shell must win.
    const { io } = capture(dir, { STRIPE_KEY: "sk_live_shell" });
    expect(await run(["doctor", "--env-file", ".env"], io)).toBe(0);
  });

  it("reports what the file is still missing", async () => {
    const dir = fixture();
    writeFileSync(join(dir, ".env"), "DATABASE_URL=postgres://localhost\n");
    const { io, out } = capture(dir, {});
    expect(await run(["doctor", "--env-file", ".env"], io)).toBe(1);
    expect(out()).toContain("STRIPE_KEY");
  });

  it("fails clearly when the env file does not exist", async () => {
    const dir = fixture();
    const { io, err } = capture(dir, {});
    expect(await run(["doctor", "--env-file", "nope.env"], io)).toBe(1);
    expect(err()).toContain("env file not found");
  });
});

describe("PRAHARI_SKIP_VALIDATION does not leak out of loadSchema", () => {
  it("is cleared after the config is loaded, so later validation still runs", async () => {
    const dir = fixture();
    const { io } = capture(dir, {});
    await run(["docs"], io);
    // Left set, every later defineEnv/safeParse in this process would silently
    // no-op — including the one `doctor` uses to validate.
    expect(process.env.PRAHARI_SKIP_VALIDATION).toBeUndefined();
  });

  it("doctor still detects an invalid environment after a load", async () => {
    const dir = fixture();
    const { io, out } = capture(dir, {});
    expect(await run(["doctor"], io)).toBe(1);
    expect(out()).toContain("DATABASE_URL");
  });
});

describe("doctor colourises its report", () => {
  const ANSI = /\x1b\[/; // eslint-disable-line no-control-regex

  it("paints the failure table when colour is enabled", async () => {
    const dir = fixture();
    const { io, out } = capture(dir, {});
    process.env.FORCE_COLOR = "1";
    try {
      expect(await run(["doctor"], io)).toBe(1);
    } finally {
      delete process.env.FORCE_COLOR;
    }
    expect(out()).toMatch(ANSI);
    expect(out()).toContain("DATABASE_URL");
  });

  it("stays plain when NO_COLOR is set", async () => {
    const dir = fixture();
    const { io, out } = capture(dir, {});
    process.env.NO_COLOR = "1";
    try {
      await run(["doctor"], io);
    } finally {
      delete process.env.NO_COLOR;
    }
    expect(out()).not.toMatch(ANSI);
  });

  it("never colours the --json payload", async () => {
    const dir = fixture();
    const { io, out } = capture(dir, {});
    process.env.FORCE_COLOR = "1";
    try {
      await run(["doctor", "--json"], io);
    } finally {
      delete process.env.FORCE_COLOR;
    }
    expect(out()).not.toMatch(ANSI);
    expect(() => JSON.parse(out())).not.toThrow();
  });
});
