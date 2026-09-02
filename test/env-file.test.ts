import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadEnvFiles, parseEnvFile } from "../src/env-file/index";
import { defineEnv, port, str } from "../src/index";
import { clearRegistry } from "../src/registry";

/** #25 — opt-in `.env` loading, behind its own entry point. */

const dirs: string[] = [];
function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "prahari-envfile-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  dirs.push(dir);
  return dir;
}

beforeEach(() => clearRegistry());
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("parseEnvFile", () => {
  it("parses plain assignments", () => {
    expect(parseEnvFile("A=1\nB=two\n")).toEqual({ A: "1", B: "two" });
  });

  it("ignores comments and blank lines", () => {
    expect(parseEnvFile("# a comment\n\nA=1\n   \n# another\nB=2")).toEqual({ A: "1", B: "2" });
  });

  it("strips an `export ` prefix", () => {
    expect(parseEnvFile("export A=1\n  export  B=2")).toEqual({ A: "1", B: "2" });
  });

  it("trims an unquoted value and its trailing comment", () => {
    expect(parseEnvFile("A=  spaced   # trailing comment\nB=plain")).toEqual({
      A: "spaced",
      B: "plain",
    });
  });

  it("keeps whitespace and # inside quotes", () => {
    expect(parseEnvFile('A=" spaced "\nB="has # hash"\nC=\'raw # hash\'')).toEqual({
      A: " spaced ",
      B: "has # hash",
      C: "raw # hash",
    });
  });

  it("unescapes only inside double quotes", () => {
    expect(parseEnvFile('A="line1\\nline2"')).toEqual({ A: "line1\nline2" });
    expect(parseEnvFile("B='line1\\nline2'")).toEqual({ B: "line1\\nline2" });
    expect(parseEnvFile('C="tab\\there"')).toEqual({ C: "tab\there" });
    expect(parseEnvFile('D="quote\\"inside"')).toEqual({ D: 'quote"inside' });
  });

  it("supports multi-line quoted values (PEM keys)", () => {
    const text = 'KEY="-----BEGIN-----\nline2\n-----END-----"\nAFTER=1\n';
    expect(parseEnvFile(text)).toEqual({
      KEY: "-----BEGIN-----\nline2\n-----END-----",
      AFTER: "1",
    });
  });

  it("supports backtick quoting", () => {
    expect(parseEnvFile("A=`it's fine`")).toEqual({ A: "it's fine" });
  });

  it("handles CRLF and a BOM", () => {
    expect(parseEnvFile("﻿A=1\r\nB=2\r\n")).toEqual({ A: "1", B: "2" });
  });

  it("yields an empty string for an empty assignment", () => {
    expect(parseEnvFile("A=\nB=2")).toEqual({ A: "", B: "2" });
  });

  it("ignores lines that are not assignments", () => {
    expect(parseEnvFile("just some text\nA=1")).toEqual({ A: "1" });
  });
});

describe("loadEnvFiles", () => {
  it("loads a single file", () => {
    const dir = fixture({ ".env": "PORT=8080\n" });
    const values = loadEnvFiles(".env", { cwd: dir, base: {} });
    expect(values.PORT).toBe("8080");
  });

  it("lets EARLIER files win over later ones", () => {
    const dir = fixture({
      ".env.local": "PORT=1111\nONLY_LOCAL=yes\n",
      ".env": "PORT=2222\nONLY_BASE=yes\n",
    });
    const values = loadEnvFiles([".env.local", ".env"], { cwd: dir, base: {} });
    expect(values.PORT).toBe("1111");
    expect(values.ONLY_LOCAL).toBe("yes");
    expect(values.ONLY_BASE).toBe("yes");
  });

  it("lets the real environment win over the files", () => {
    const dir = fixture({ ".env": "PORT=8080\n" });
    const values = loadEnvFiles(".env", { cwd: dir, base: { PORT: "9999" } });
    expect(values.PORT).toBe("9999");
  });

  it("fills in a base value that is absent or empty", () => {
    const dir = fixture({ ".env": "A=from-file\nB=from-file\n" });
    const values = loadEnvFiles(".env", { cwd: dir, base: { A: "", B: undefined } });
    // "" and undefined both mean unset in prahari, so the file shows through.
    expect(values).toMatchObject({ A: "from-file", B: "from-file" });
  });

  it("can be told to override the environment", () => {
    const dir = fixture({ ".env": "PORT=8080\n" });
    const values = loadEnvFiles(".env", { cwd: dir, base: { PORT: "9999" }, override: true });
    expect(values.PORT).toBe("8080");
  });

  it("skips a missing file without complaining", () => {
    const dir = fixture({ ".env": "PORT=8080\n" });
    const values = loadEnvFiles([".env.local", ".env"], { cwd: dir, base: {} });
    expect(values.PORT).toBe("8080");
  });

  it("returns the base untouched when no file exists", () => {
    const dir = fixture({});
    expect(loadEnvFiles(".env", { cwd: dir, base: { A: "1" } })).toEqual({ A: "1" });
  });

  it("propagates a real read error", () => {
    const dir = fixture({});
    // A directory, not a file — EISDIR, which is a genuine mistake.
    expect(() => loadEnvFiles(".", { cwd: dir, base: {} })).toThrow();
  });

  it("accepts an absolute path", () => {
    const dir = fixture({ ".env": "PORT=8080\n" });
    const values = loadEnvFiles(join(dir, ".env"), { cwd: "/nowhere", base: {} });
    expect(values.PORT).toBe("8080");
  });

  it("does not touch process.env by default", () => {
    const dir = fixture({ ".env": "PRAHARI_SIDE_EFFECT=nope\n" });
    loadEnvFiles(".env", { cwd: dir, base: {} });
    expect(process.env.PRAHARI_SIDE_EFFECT).toBeUndefined();
  });

  it("mutates process.env only when asked", () => {
    const dir = fixture({ ".env": "PRAHARI_SIDE_EFFECT=yes\nPRAHARI_EXISTING=from-file\n" });
    process.env.PRAHARI_EXISTING = "from-shell";
    try {
      loadEnvFiles(".env", { cwd: dir, mutateProcessEnv: true });
      expect(process.env.PRAHARI_SIDE_EFFECT).toBe("yes");
      expect(process.env.PRAHARI_EXISTING).toBe("from-shell"); // never clobbers
    } finally {
      delete process.env.PRAHARI_SIDE_EFFECT;
      delete process.env.PRAHARI_EXISTING;
    }
  });

  it("feeds defineEnv as a source", () => {
    const dir = fixture({ ".env": "PORT=8080\nNAME=svc\n" });
    const env = defineEnv(
      { PORT: port(), NAME: str() },
      { source: loadEnvFiles(".env", { cwd: dir, base: {} }) },
    );
    expect(env.PORT).toBe(8080);
    expect(env.NAME).toBe("svc");
  });
});

describe("loadEnvFiles — defaults and escapes", () => {
  it("covers every escape sequence inside double quotes", () => {
    expect(parseEnvFile('A="a\\rb"')).toEqual({ A: "a\rb" });
    expect(parseEnvFile('B="a\\bb"')).toEqual({ B: "a\bb" });
    expect(parseEnvFile('C="a\\fb"')).toEqual({ C: "a\fb" });
    expect(parseEnvFile('D="a\\\\b"')).toEqual({ D: "a\\b" });
    // An escape with no special meaning is just the character itself.
    expect(parseEnvFile('E="a\\qb"')).toEqual({ E: "aqb" });
  });

  it("defaults cwd to process.cwd() and base to process.env", () => {
    const dir = fixture({ ".env": "PRAHARI_DEFAULTS=from-file\nPRAHARI_SHELL_WINS=from-file\n" });
    const originalCwd = process.cwd();
    process.env.PRAHARI_SHELL_WINS = "from-shell";
    process.chdir(dir);
    try {
      const values = loadEnvFiles(".env");
      expect(values.PRAHARI_DEFAULTS).toBe("from-file");
      expect(values.PRAHARI_SHELL_WINS).toBe("from-shell");
      // process.env itself is still untouched.
      expect(process.env.PRAHARI_DEFAULTS).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
      delete process.env.PRAHARI_SHELL_WINS;
    }
  });

  it("overrides process.env when asked to both override and mutate", () => {
    const dir = fixture({ ".env": "PRAHARI_FORCED=from-file\n" });
    process.env.PRAHARI_FORCED = "from-shell";
    try {
      const values = loadEnvFiles(".env", { cwd: dir, override: true, mutateProcessEnv: true });
      expect(values.PRAHARI_FORCED).toBe("from-file");
      expect(process.env.PRAHARI_FORCED).toBe("from-file");
    } finally {
      delete process.env.PRAHARI_FORCED;
    }
  });
});

describe("loadEnvFiles — degenerate input", () => {
  it("leaves a lone quote character alone", () => {
    expect(parseEnvFile('A="\nB=1')).toEqual({ A: '"', B: "1" });
  });

  it("works on a runtime with no process binding", () => {
    const dir = fixture({ ".env": "PORT=8080\n" });
    const original = globalThis.process;
    // @ts-expect-error — simulating an edge runtime
    delete globalThis.process;
    try {
      expect(loadEnvFiles(join(dir, ".env")).PORT).toBe("8080");
    } finally {
      globalThis.process = original;
    }
  });
});
