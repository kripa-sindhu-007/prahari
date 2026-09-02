import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineEnv, str, num, port, bool, url, oneOf, json, type Validator } from "../src/index";
import { formatReport } from "../src/report";
import { parseEnvKeys, computeDrift, hasDrift } from "../src/cli/sync";
import { renderEnvExample } from "../src/cli/example";
import { renderDocs } from "../src/cli/docs";
import { runDoctor } from "../src/cli/doctor";
import { resolveConfigPath } from "../src/cli/load";
import {
  clearRegistry,
  getRegisteredSchema,
  getRegisteredSchemas,
  registerSchema,
} from "../src/registry";

/** Direct unit tests for the pure helpers + defensive paths (fast, no jiti). */

describe("sync helpers", () => {
  it("parseEnvKeys handles comments, blanks, export, and non-assignments", () => {
    const keys = parseEnvKeys(
      ["# comment", "", "FOO=bar", "export BAZ=1", "NOEQUALS", "  QUX = 2 "].join("\n"),
    );
    expect([...keys].sort()).toEqual(["BAZ", "FOO", "QUX"]);
  });

  it("computeDrift / hasDrift split missing vs unknown", () => {
    const d = computeDrift({ A: str(), B: str() }, new Set(["A", "C"]));
    expect(d.missing).toEqual(["B"]);
    expect(d.unknown).toEqual(["C"]);
    expect(hasDrift(d)).toBe(true);
    expect(hasDrift({ missing: [], unknown: [] })).toBe(false);
  });
});

describe("renderEnvExample", () => {
  it("emits tags, descriptions, enum hints, and blanks secrets", () => {
    const out = renderEnvExample({
      MODE: oneOf(["a", "b"]),
      NAME: str().desc("your name").optional(),
      KEY: str().secret(),
      PORT: port().default(8080),
    });
    expect(out).toContain("MODE=a");
    expect(out).toContain("one of: a | b");
    expect(out).toContain("# your name");
    expect(out).toContain("(optional");
    expect(out).toMatch(/KEY=\n/); // secret value blank
    expect(out).toContain("PORT=8080");
  });
});

describe("renderDocs", () => {
  it("renders a Markdown table with required/default and redacts secret defaults", () => {
    const md = renderDocs({
      DATABASE_URL: str().desc("Postgres connection string"),
      PORT: port().default(3000),
      MODE: oneOf(["a", "b"]),
      API_KEY: str().secret(),
      NAME: str().optional(),
    });
    expect(md).toContain("| Variable | Type | Required | Default | Description |");
    expect(md).toContain("| `DATABASE_URL` | string | yes | — | Postgres connection string |");
    expect(md).toContain("| `PORT` | port | no | `3000` |  |");
    expect(md).toContain("(secret)");
    // an optional field is not "required"
    expect(md).toMatch(/\| `NAME` \| string \| no \|/);
    // enum values are listed in the type cell
    expect(md).toContain("`a`");
  });
});

describe("registry", () => {
  it("tracks multiple schemas and clears", () => {
    clearRegistry();
    registerSchema({ X: str() });
    registerSchema({ Y: str() });
    expect(getRegisteredSchemas()).toHaveLength(2);
    expect(Object.keys(getRegisteredSchema()).sort()).toEqual(["X", "Y"]);
    clearRegistry();
    expect(getRegisteredSchemas()).toHaveLength(0);
  });
});

describe("resolveConfigPath", () => {
  it("returns null for an explicit path that does not exist", () => {
    expect(resolveConfigPath("nope-does-not-exist.ts", process.cwd())).toBeNull();
  });
  it("returns null when no conventional config exists", () => {
    const empty = mkdtempSync(join(tmpdir(), "prahari-noconf-"));
    expect(resolveConfigPath(undefined, empty)).toBeNull();
  });
  it("returns an explicit path that exists", () => {
    const self = fileURLToPath(import.meta.url);
    expect(resolveConfigPath(self, process.cwd())).toBe(self);
  });
});

describe("extra validator branches", () => {
  it("url protocol accepts a trailing-colon spec", () => {
    expect(url().protocol("https:").parse("https://x.com")).toBe("https://x.com");
  });
  it("optional present value passes through", () => {
    expect(str().optional().parse("x")).toBe("x");
  });
  it("num max and json generic", () => {
    expect(num().max(5).parse("3")).toBe(3);
    expect(json<{ a: number }>().parse('{"a":1}')).toEqual({ a: 1 });
  });
  it("json placeholder + optional default example", () => {
    expect(json().exampleValue()).toBe("{}");
    expect(bool().default(true).optional().exampleValue()).toBe("true");
  });
});

describe("defensive: non-EnvFieldError propagates", () => {
  const boom: Validator<unknown> = {
    typeName: "x",
    meta: { typeName: "x", secret: false, optional: false, hasDefault: false },
    parse() {
      throw new Error("weird internal error");
    },
    exampleValue() {
      return "";
    },
  };

  it("defineEnv rethrows unexpected errors (not swallowed as a field failure)", () => {
    expect(() => defineEnv({ B: boom }, { source: { B: "v" } })).toThrow("weird internal error");
  });
  it("runDoctor rethrows unexpected errors", () => {
    expect(() => runDoctor({ B: boom }, { B: "v" })).toThrow("weird internal error");
  });

  it("runDoctor redacts an unset secret as undefined (no leak)", () => {
    const { failures } = runDoctor({ K: str().secret() }, {});
    expect(failures[0]!.received).toBeUndefined();
    expect(failures[0]!.reason).toMatch(/required/);
  });
});

describe("formatReport painting", () => {
  const failures = [
    { key: "PORT", reason: "must be a number", received: "abc", expected: "port" },
    { key: "DATABASE_URL", reason: "is required but was not set", received: undefined, expected: "url" },
  ];

  it("is plain by default — it ends up inside an Error.message", () => {
    const out = formatReport(failures);
    // eslint-disable-next-line no-control-regex
    expect(out).not.toMatch(/\x1b\[/);
    expect(out).toContain("  ✗ PORT          (port)  must be a number  received: \"abc\"");
  });

  it("paints each part when asked, without breaking the columns", () => {
    const mark = (name: string) => (s: string) => `<${name}>${s}</${name}>`;
    const out = formatReport(failures, {
      heading: mark("h"),
      cross: mark("x"),
      key: mark("k"),
      type: mark("t"),
      reason: mark("r"),
      received: mark("v"),
    });
    expect(out).toContain("<h>prahari: 2 environment variables failed validation</h>");
    expect(out).toContain("<x>✗</x>");
    // Padding is applied to the RAW text before painting, so the columns survive
    // — an ANSI escape counts toward String.length and would shift them.
    expect(out).toContain("<k>PORT        </k>");
    expect(out).toContain("<k>DATABASE_URL</k>");
    expect(out).toContain("<t>(port)</t>");
    expect(out).toContain("<v>  received: \"abc\"</v>");
  });

  it("omits an empty received rather than painting nothing", () => {
    const out = formatReport(failures, { received: (s) => `<v>${s}</v>` });
    expect(out).toContain("<v></v>"); // the absent one paints an empty string
    expect(out).not.toContain("received: undefined");
  });
});
