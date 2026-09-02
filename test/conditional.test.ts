import { describe, it, expect, beforeEach } from "vitest";

import {
  bool,
  defineEnv,
  EnvValidationError,
  oneOf,
  port,
  safeParse,
  str,
  url,
} from "../src/index";
import { renderDocs } from "../src/cli/docs";
import { renderEnvExample } from "../src/cli/example";
import { runDoctor } from "../src/cli/doctor";
import { describeField } from "../src/validators";
import { clearRegistry } from "../src/registry";

/** #27 — requirements that depend on the rest of the environment. */

beforeEach(() => {
  clearRegistry();
  delete process.env.PRAHARI_SKIP_VALIDATION;
});

const schema = {
  NODE_ENV: oneOf(["development", "production", "test"]).default("development"),
  STRIPE_KEY: str().secret().requiredIn("production"),
};

describe(".requiredIn()", () => {
  it("does not require the variable outside the named environments", () => {
    const env = defineEnv(schema, { source: { NODE_ENV: "development" } });
    expect(env.STRIPE_KEY).toBeUndefined();
  });

  it("requires it inside them, naming the condition in the report", () => {
    let error: EnvValidationError | undefined;
    try {
      defineEnv(schema, { source: { NODE_ENV: "production" } });
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error?.failures).toEqual([
      {
        key: "STRIPE_KEY",
        reason: "is required when NODE_ENV is production",
        received: undefined,
        expected: "string",
      },
    ]);
  });

  it("accepts a present value in the required environment", () => {
    const env = defineEnv(schema, {
      source: { NODE_ENV: "production", STRIPE_KEY: "sk_live" },
    });
    expect(env.STRIPE_KEY).toBe("sk_live");
  });

  it("still validates a present value in a NON-required environment", () => {
    expect(() =>
      defineEnv(
        { NODE_ENV: str().default("development"), PORT: port().requiredIn("production") },
        { source: { PORT: "not-a-port" } },
      ),
    ).toThrow(/must be a number/);
  });

  it("accepts several environments", () => {
    const field = { NODE_ENV: str().default("dev"), KEY: str().requiredIn("staging", "production") };
    expect(() => defineEnv(field, { source: { NODE_ENV: "staging" } })).toThrow(
      /is required when NODE_ENV is staging or production/,
    );
    expect(defineEnv(field, { source: { NODE_ENV: "dev" } }).KEY).toBeUndefined();
  });

  it("does not fire when NODE_ENV is absent from the schema", () => {
    const env = defineEnv({ KEY: str().requiredIn("production") }, { source: {} });
    expect(env.KEY).toBeUndefined();
  });
});

describe(".requiredWhen()", () => {
  it("reads any other resolved variable", () => {
    const s = {
      BILLING_ENABLED: bool().default(false),
      STRIPE_KEY: str().requiredWhen((env) => env.BILLING_ENABLED === true, "billing is enabled"),
    };
    expect(defineEnv(s, { source: {} }).STRIPE_KEY).toBeUndefined();
    expect(() => defineEnv(s, { source: { BILLING_ENABLED: "true" } })).toThrow(
      /is required when billing is enabled/,
    );
  });

  it("falls back to a generic reason with no label", () => {
    expect(() =>
      defineEnv({ KEY: str().requiredWhen(() => true) }, { source: {} }),
    ).toThrow(/is required under the declared condition/);
  });

  it("respects a default — a defaulted variable is never 'missing'", () => {
    const env = defineEnv(
      { KEY: str().default("fallback").requiredWhen(() => true) },
      { source: {} },
    );
    expect(env.KEY).toBe("fallback");
  });

  it("reports a throwing predicate instead of crashing", () => {
    let error: EnvValidationError | undefined;
    try {
      defineEnv(
        {
          KEY: str().requiredWhen(() => {
            throw new Error("bad condition");
          }),
        },
        { source: {} },
      );
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error?.failures[0]?.reason).toBe("conditional requirement threw: bad condition");
  });

  it("keeps the report in schema order even though it is judged in a second pass", () => {
    let error: EnvValidationError | undefined;
    try {
      defineEnv(
        {
          A_CONDITIONAL: str().requiredWhen(() => true, "always"),
          B_MISSING: str(),
          C_CONDITIONAL: str().requiredWhen(() => true, "always"),
        },
        { source: {} },
      );
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error?.failures.map((f) => f.key)).toEqual([
      "A_CONDITIONAL",
      "B_MISSING",
      "C_CONDITIONAL",
    ]);
  });

  it("works through safeParse", () => {
    const result = safeParse(schema, { source: { NODE_ENV: "production" } });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.failures[0]?.key).toBe("STRIPE_KEY");
  });
});

describe("conditional requirements in the CLI output", () => {
  it("marks the field in the descriptor", () => {
    const d = describeField(schema.STRIPE_KEY);
    expect(d.conditional).toBe(true);
    expect(d.conditionLabel).toBe("NODE_ENV is production");
    const plain = describeField(str().optional());
    expect(plain.conditional).toBe(false);
  });

  it("says 'required when …' in .env.example instead of 'optional'", () => {
    const out = renderEnvExample(schema);
    expect(out).toContain("# (required when NODE_ENV is production, secret, string)");
    expect(out).not.toContain("optional");
  });

  it("shows the condition in the docs table's Required column", () => {
    const out = renderDocs(schema);
    expect(out).toContain("| `STRIPE_KEY` | string (secret) | when NODE_ENV is production |");
  });

  it("falls back to 'conditional' with no label", () => {
    const s = { KEY: str().requiredWhen(() => true) };
    expect(renderDocs(s)).toContain("| conditional |");
    expect(renderEnvExample(s)).toContain("conditionally required");
  });

  it("escapes a pipe in the condition label so the table survives", () => {
    const s = { KEY: str().requiredWhen(() => true, "A | B") };
    expect(renderDocs(s)).toContain("when A \\| B");
  });

  it("doctor agrees with defineEnv about what was required", () => {
    const production = runDoctor(schema, { NODE_ENV: "production" });
    expect(production.ok).toEqual(["NODE_ENV"]);
    expect(production.failures.map((f) => f.reason)).toEqual([
      "is required when NODE_ENV is production",
    ]);

    const development = runDoctor(schema, { NODE_ENV: "development" });
    expect(development.ok).toEqual(["NODE_ENV", "STRIPE_KEY"]);
    expect(development.failures).toEqual([]);
  });

  it("doctor keeps its failures in schema order", () => {
    const s = {
      A: str().requiredWhen(() => true, "always"),
      B: url(),
    };
    const result = runDoctor(s, {});
    expect(result.failures.map((f) => f.key)).toEqual(["A", "B"]);
  });
});
