import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import {
  defineEnv,
  EnvValidationError,
  port,
  safeParse,
  str,
  url,
  type EnvWarning,
} from "../src/index";
import { renderDocs } from "../src/cli/docs";
import { renderEnvExample } from "../src/cli/example";
import { describeField } from "../src/validators";
import { clearRegistry } from "../src/registry";

/** #30 — deprecation and unknown-variable warnings. */

beforeEach(() => {
  clearRegistry();
  delete process.env.PRAHARI_SKIP_VALIDATION;
});
afterEach(() => vi.restoreAllMocks());

const collect = () => {
  const warnings: EnvWarning[] = [];
  return { warnings, onWarn: (w: EnvWarning) => warnings.push(w) };
};

describe(".deprecated()", () => {
  it("still validates — a deprecation is not a failure", () => {
    const { warnings, onWarn } = collect();
    const env = defineEnv(
      { OLD_URL: url().deprecated("use API_URL instead") },
      { source: { OLD_URL: "https://old.example" }, onWarn },
    );
    expect(env.OLD_URL).toBe("https://old.example");
    expect(warnings).toEqual([
      {
        kind: "deprecated",
        key: "OLD_URL",
        message: "OLD_URL is deprecated — use API_URL instead",
      },
    ]);
  });

  it("warns without a message too", () => {
    const { warnings, onWarn } = collect();
    defineEnv({ OLD: str().deprecated() }, { source: { OLD: "x" }, onWarn });
    expect(warnings[0]?.message).toBe("OLD is deprecated");
  });

  it("says nothing when the deprecated variable is NOT set", () => {
    const { warnings, onWarn } = collect();
    // Metadata modifiers come BEFORE .optional() — it returns the plain
    // Validator interface, same ordering rule as .transform().
    defineEnv({ OLD: str().deprecated("gone soon").optional() }, { source: {}, onWarn });
    // Warning about a variable nobody uses just trains people to ignore warnings.
    expect(warnings).toEqual([]);
  });

  it("treats an explicitly empty value as not set", () => {
    const { warnings, onWarn } = collect();
    defineEnv({ OLD: str().deprecated().optional() }, { source: { OLD: "" }, onWarn });
    expect(warnings).toEqual([]);
  });

  it("warns even when another variable fails", () => {
    const { warnings, onWarn } = collect();
    expect(() =>
      defineEnv(
        { OLD: str().deprecated(), PORT: port() },
        { source: { OLD: "x", PORT: "nope" }, onWarn },
      ),
    ).toThrow(EnvValidationError);
    expect(warnings.map((w) => w.key)).toEqual(["OLD"]);
  });

  it("still validates the value it deprecates", () => {
    expect(() =>
      defineEnv({ OLD: port().deprecated() }, { source: { OLD: "not-a-port" }, onWarn: () => {} }),
    ).toThrow(/must be a number/);
  });
});

describe("the default warning sink", () => {
  it("writes one greppable line to console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    defineEnv({ OLD: str().deprecated("use NEW") }, { source: { OLD: "x" } });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("prahari: OLD is deprecated — use NEW");
  });

  it("is silenced by an empty onWarn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    defineEnv({ OLD: str().deprecated() }, { source: { OLD: "x" }, onWarn: () => {} });
    expect(spy).not.toHaveBeenCalled();
  });

  it("says nothing at all for a schema with no deprecations", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    defineEnv({ PORT: port() }, { source: { PORT: "80" } });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("unknown variables", () => {
  const schema = { PORT: port() };
  const source = { PORT: "80", STALE: "1", ALSO_STALE: "2" };

  it("is ignored by default", () => {
    const { warnings, onWarn } = collect();
    defineEnv(schema, { source, onWarn });
    expect(warnings).toEqual([]);
  });

  it("warns on request, listing each offender", () => {
    const { warnings, onWarn } = collect();
    defineEnv(schema, { source, onWarn, unknown: "warn" });
    expect(warnings).toEqual([
      { kind: "unknown", key: "STALE", message: "STALE is set but not declared in the schema" },
      {
        kind: "unknown",
        key: "ALSO_STALE",
        message: "ALSO_STALE is set but not declared in the schema",
      },
    ]);
  });

  it("fails validation in error mode", () => {
    let error: EnvValidationError | undefined;
    try {
      defineEnv(schema, { source, unknown: "error", onWarn: () => {} });
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error?.failures.map((f) => [f.key, f.reason])).toEqual([
      ["STALE", "is not declared in the schema"],
      ["ALSO_STALE", "is not declared in the schema"],
    ]);
  });

  it("keeps schema failures before unknown ones in the report", () => {
    let error: EnvValidationError | undefined;
    try {
      defineEnv(
        { PORT: port() },
        { source: { STALE: "1" }, unknown: "error", onWarn: () => {} },
      );
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error?.failures.map((f) => f.key)).toEqual(["PORT", "STALE"]);
  });

  it("is skipped for a source that cannot be enumerated", () => {
    const { warnings, onWarn } = collect();
    // A get(key) source has no key set to walk — documented, not half-working.
    defineEnv(schema, {
      source: { get: (key) => (key === "PORT" ? "80" : undefined) },
      onWarn,
      unknown: "warn",
    });
    expect(warnings).toEqual([]);
  });
});

describe("warnings through safeParse", () => {
  it("returns them alongside a success", () => {
    const result = safeParse(
      { OLD: str().deprecated("use NEW") },
      { source: { OLD: "x" }, onWarn: () => {} },
    );
    expect(result.success).toBe(true);
    expect(result.warnings.map((w) => w.key)).toEqual(["OLD"]);
  });

  it("returns them alongside a failure", () => {
    const result = safeParse(
      { OLD: str().deprecated(), PORT: port() },
      { source: { OLD: "x" }, onWarn: () => {} },
    );
    expect(result.success).toBe(false);
    expect(result.warnings.map((w) => w.key)).toEqual(["OLD"]);
    if (result.success) throw new Error("expected failure");
    expect(result.error.failures.map((f) => f.key)).toEqual(["PORT"]);
  });

  it("returns an empty array in CLI introspection mode", () => {
    process.env.PRAHARI_SKIP_VALIDATION = "1";
    try {
      const result = safeParse({ OLD: str().deprecated() }, { source: { OLD: "x" } });
      expect(result.warnings).toEqual([]);
    } finally {
      delete process.env.PRAHARI_SKIP_VALIDATION;
    }
  });
});

describe("deprecation in the CLI renderers", () => {
  const schema = {
    OLD_URL: url().desc("Legacy endpoint").deprecated("use API_URL instead"),
    PLAIN_OLD: str().deprecated(),
    SECRET_OLD: str().secret().deprecated(),
  };

  it("marks the field in the descriptor", () => {
    const d = describeField(schema.OLD_URL);
    expect(d.deprecated).toBe(true);
    expect(d.deprecationMessage).toBe("use API_URL instead");
    expect(describeField(str()).deprecated).toBe(false);
  });

  it("annotates .env.example with the tag and the message", () => {
    const out = renderEnvExample(schema);
    expect(out).toContain("# DEPRECATED: use API_URL instead");
    expect(out).toContain("# (required, deprecated, url)");
    expect(out).toContain("# (required, secret, deprecated, string)");
  });

  it("annotates the docs table next to the existing secret note", () => {
    const out = renderDocs(schema);
    expect(out).toContain("| `OLD_URL` | url (deprecated) |");
    expect(out).toContain("| `SECRET_OLD` | string (secret, deprecated) |");
    expect(out).toContain("**Deprecated** — use API_URL instead");
  });
});

describe("unknown variables — the empty-value rule (PR #34 review)", () => {
  it("does not flag a key whose value is empty", () => {
    const { warnings, onWarn } = collect();
    // `STALE=` means UNSET everywhere else in prahari, so calling it "set but
    // not declared" would contradict the rule the validators use.
    defineEnv(
      { PORT: port() },
      { source: { PORT: "80", STALE: "", ALSO: undefined }, onWarn, unknown: "warn" },
    );
    expect(warnings).toEqual([]);
  });

  it("does not fail on an empty unknown key in error mode either", () => {
    expect(() =>
      defineEnv(
        { PORT: port() },
        { source: { PORT: "80", STALE: "" }, unknown: "error", onWarn: () => {} },
      ),
    ).not.toThrow();
  });

  it("still flags one that genuinely has a value", () => {
    const { warnings, onWarn } = collect();
    defineEnv(
      { PORT: port() },
      { source: { PORT: "80", STALE: "leftover" }, onWarn, unknown: "warn" },
    );
    expect(warnings.map((w) => w.key)).toEqual(["STALE"]);
  });
});
