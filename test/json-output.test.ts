import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { renderDoctorJson, runDoctor, type DoctorJson } from "../src/cli/doctor";
import { computeDrift, parseEnvKeys, renderSyncJson, type SyncJson } from "../src/cli/sync";
import { run, type RunIO } from "../src/cli/run";
import { port, safeParse, str, url } from "../src/index";
import { z } from "zod";
import * as v from "valibot";
import { clearRegistry } from "../src/registry";

/** #29 — machine-readable output for CI. */

const here = dirname(fileURLToPath(import.meta.url));
const DIST_INDEX = resolve(here, "../dist/index.js");

const dirs: string[] = [];
function fixture(body: string, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "prahari-json-"));
  writeFileSync(join(dir, "env.ts"), body);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  dirs.push(dir);
  return dir;
}

function capture(cwd: string, env?: Record<string, string | undefined>) {
  const out: string[] = [];
  const err: string[] = [];
  const io: RunIO = { cwd, env, stdout: (s) => out.push(s), stderr: (s) => err.push(s) };
  return { io, out: () => out.join(""), err: () => err.join("") };
}

beforeEach(() => {
  clearRegistry();
  delete process.env.PRAHARI_SKIP_VALIDATION;
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("renderDoctorJson", () => {
  const schema = {
    PORT: port(),
    TOKEN: str().secret(),
    API_URL: url(),
  };

  it("reports every variable in schema order, ok:true when all valid", () => {
    const result = runDoctor(schema, {
      PORT: "8080",
      TOKEN: "sk_live",
      API_URL: "https://api.example",
    });
    const payload = JSON.parse(renderDoctorJson(schema, result)) as DoctorJson;
    expect(payload.ok).toBe(true);
    expect(payload.variables).toEqual([
      { key: "PORT", status: "ok" },
      { key: "TOKEN", status: "ok" },
      { key: "API_URL", status: "ok" },
    ]);
    expect(payload.warnings).toEqual([]);
  });

  it("carries reason, expected and received for a failure", () => {
    const result = runDoctor(schema, { PORT: "not-a-port", API_URL: "https://api.example" });
    const payload = JSON.parse(renderDoctorJson(schema, result)) as DoctorJson;
    expect(payload.ok).toBe(false);
    expect(payload.variables[0]).toEqual({
      key: "PORT",
      status: "invalid",
      reason: "must be a number",
      expected: "port",
      received: "not-a-port",
    });
    // An absent value is null, not the string "undefined".
    expect(payload.variables[1]).toEqual({
      key: "TOKEN",
      status: "invalid",
      reason: "is required but was not set",
      expected: "string",
      received: null,
    });
  });

  it("keeps a secret redacted in the machine-readable output too", () => {
    const result = runDoctor({ TOKEN: str().secret().min(20) }, { TOKEN: "too-short" });
    const payload = JSON.parse(renderDoctorJson({ TOKEN: str().secret().min(20) }, result));
    expect(payload.variables[0].received).toBe("***");
  });

  it("includes warnings", () => {
    const withDeprecated = { OLD: str().deprecated("use NEW") };
    const result = runDoctor(withDeprecated, { OLD: "x" });
    const payload = JSON.parse(renderDoctorJson(withDeprecated, result)) as DoctorJson;
    expect(payload.ok).toBe(true);
    expect(payload.warnings).toEqual([
      { kind: "deprecated", key: "OLD", message: "OLD is deprecated — use NEW" },
    ]);
  });

  it("is valid, indented JSON ending in a newline", () => {
    const text = renderDoctorJson(schema, runDoctor(schema, {}));
    expect(text.endsWith("\n")).toBe(true);
    expect(() => JSON.parse(text)).not.toThrow();
    expect(text).toContain("\n  ");
  });
});

describe("renderSyncJson", () => {
  it("reports drift structurally", () => {
    const schema = { A: str(), B: str() };
    const drift = computeDrift(schema, parseEnvKeys("A=1\nSTALE=2\n"));
    const payload = JSON.parse(renderSyncJson(".env.example", drift)) as SyncJson;
    expect(payload).toEqual({
      ok: false,
      file: ".env.example",
      missing: ["B"],
      unknown: ["STALE"],
    });
  });

  it("reports ok:true with no drift", () => {
    const schema = { A: str() };
    const payload = JSON.parse(
      renderSyncJson(".env.example", computeDrift(schema, parseEnvKeys("A=1\n"))),
    ) as SyncJson;
    expect(payload).toEqual({ ok: true, file: ".env.example", missing: [], unknown: [] });
  });
});

describe("the --json flag end to end", () => {
  const SCHEMA = `
import { defineEnv, str, port } from ${JSON.stringify(DIST_INDEX)};
export const env = defineEnv({
  PORT: port().default(3000),
  DATABASE_URL: str(),
  OLD_URL: str().deprecated("use DATABASE_URL").optional(),
});
`;

  it("doctor --json prints JSON and keeps exit 1 on failure", async () => {
    const dir = fixture(SCHEMA);
    const { io, out } = capture(dir, {});
    expect(await run(["doctor", "--json"], io)).toBe(1);
    const payload = JSON.parse(out()) as DoctorJson;
    expect(payload.ok).toBe(false);
    expect(payload.variables.find((v) => v.key === "DATABASE_URL")?.status).toBe("invalid");
  });

  it("doctor --json keeps exit 0 on success", async () => {
    const dir = fixture(SCHEMA);
    const { io, out } = capture(dir, { DATABASE_URL: "postgres://x" });
    expect(await run(["doctor", "--json"], io)).toBe(0);
    expect((JSON.parse(out()) as DoctorJson).ok).toBe(true);
  });

  it("doctor --json emits nothing but JSON, even with --env-file", async () => {
    const dir = fixture(SCHEMA, { ".env": "DATABASE_URL=postgres://x\n" });
    const { io, out } = capture(dir, {});
    expect(await run(["doctor", "--json", "--env-file", ".env"], io)).toBe(0);
    // The human "(against .env …)" line would make the output unparseable.
    expect(() => JSON.parse(out())).not.toThrow();
  });

  it("doctor --json surfaces deprecation warnings", async () => {
    const dir = fixture(SCHEMA);
    const { io, out } = capture(dir, { DATABASE_URL: "postgres://x", OLD_URL: "legacy" });
    await run(["doctor", "--json"], io);
    expect((JSON.parse(out()) as DoctorJson).warnings).toEqual([
      { kind: "deprecated", key: "OLD_URL", message: "OLD_URL is deprecated — use DATABASE_URL" },
    ]);
  });

  it("sync --json reports drift and keeps exit 1", async () => {
    const dir = fixture(SCHEMA, { ".env.example": "PORT=3000\nSTALE=1\n" });
    const { io, out } = capture(dir, {});
    expect(await run(["sync", "--json"], io)).toBe(1);
    const payload = JSON.parse(out()) as SyncJson;
    expect(payload.missing).toContain("DATABASE_URL");
    expect(payload.unknown).toEqual(["STALE"]);
  });

  it("sync --json reports a missing file as JSON, not a stderr line", async () => {
    const dir = fixture(SCHEMA);
    const { io, out, err } = capture(dir, {});
    expect(await run(["sync", "--json"], io)).toBe(1);
    expect(err()).toBe("");
    expect(JSON.parse(out())).toMatchObject({ ok: false, error: "file not found" });
  });

  it("leaves the human output untouched without the flag", async () => {
    const dir = fixture(SCHEMA);
    const { io, out } = capture(dir, { DATABASE_URL: "postgres://x" });
    await run(["doctor"], io);
    expect(out()).toContain("✓ PORT");
    expect(() => JSON.parse(out())).toThrow();
  });
});

describe("doctor --strict", () => {
  const SCHEMA = `
import { defineEnv, str, port } from ${JSON.stringify(DIST_INDEX)};
export const env = defineEnv({ PORT: port().default(3000), DATABASE_URL: str() });
`;

  it("warns about env-file keys the schema does not declare", async () => {
    const dir = fixture(SCHEMA, { ".env": "DATABASE_URL=postgres://x\nSTALE_KEY=1\n" });
    const { io, out } = capture(dir, {});
    expect(await run(["doctor", "--strict", "--env-file", ".env"], io)).toBe(0);
    expect(out()).toContain("STALE_KEY is in the env file but not declared in the schema");
  });

  it("does not flag the shell's unrelated variables", async () => {
    const dir = fixture(SCHEMA, { ".env": "DATABASE_URL=postgres://x\n" });
    const { io, out } = capture(dir, { PATH: "/usr/bin", HOME: "/root" });
    await run(["doctor", "--strict", "--env-file", ".env"], io);
    expect(out()).not.toContain("PATH");
    expect(out()).not.toContain("HOME");
  });

  it("refuses to run without --env-file, and says why", async () => {
    const dir = fixture(SCHEMA);
    const { io, err } = capture(dir, {});
    expect(await run(["doctor", "--strict"], io)).toBe(1);
    expect(err()).toContain("--strict");
    expect(err()).toContain("--env-file");
  });

  it("reports unknowns in --json too", async () => {
    const dir = fixture(SCHEMA, { ".env": "DATABASE_URL=postgres://x\nSTALE_KEY=1\n" });
    const { io, out } = capture(dir, {});
    await run(["doctor", "--strict", "--env-file", ".env", "--json"], io);
    expect((JSON.parse(out()) as DoctorJson).warnings).toEqual([
      { kind: "unknown", key: "STALE_KEY", message: "STALE_KEY is in the env file but not declared in the schema" },
    ]);
  });
});

describe("review follow-ups (PR #34)", () => {
  it("doctor validates a BARE Standard Schema field instead of crashing", () => {
    // runDoctor used to assume every field was a prahari Validator and call
    // .parse() on it — a bare Valibot schema has no such method, so `prahari
    // doctor` died with a TypeError on a schema `defineEnv` handles fine.
    const schema = { REGION: z.enum(["us", "eu"]), API: v.pipe(v.string(), v.url()) };

    const good = runDoctor(schema, { REGION: "us", API: "https://api.example" });
    expect(good.ok).toEqual(["REGION", "API"]);
    expect(good.failures).toEqual([]);

    const bad = runDoctor(schema, { REGION: "mars", API: "not-a-url" });
    expect(bad.ok).toEqual([]);
    expect(bad.failures.map((f) => f.key)).toEqual(["REGION", "API"]);
    // ...and it reports them the way the boot report would, by vendor.
    expect(bad.failures.map((f) => f.expected)).toEqual(["zod", "valibot"]);
  });

  it("doctor agrees with defineEnv on a mixed schema", () => {
    const schema = { PORT: port(), REGION: z.enum(["us", "eu"]) };
    const source = { PORT: "not-a-port", REGION: "mars" };

    const doctored = runDoctor(schema, source);
    const parsed = safeParse(schema, { source, onWarn: () => {} });
    if (parsed.success) throw new Error("expected failure");
    expect(doctored.failures).toEqual(parsed.error.failures);
  });

  it("reports an explicitly empty value as null, like the human report", () => {
    // `KEY=` means UNSET in prahari; the human report suppresses the value, so
    // JSON says null rather than "" and pipelines need no special case.
    const schema = { TOKEN: str() };
    const payload = JSON.parse(
      renderDoctorJson(schema, runDoctor(schema, { TOKEN: "" })),
    ) as DoctorJson;
    expect(payload.variables[0]?.received).toBeNull();
  });
});
