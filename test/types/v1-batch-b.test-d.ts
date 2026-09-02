import { describe, it, expectTypeOf } from "vitest";

import {
  bytes,
  defineEnv,
  duration,
  json,
  list,
  num,
  oneOf,
  port,
  str,
} from "../../src/index";

/**
 * Layer 3 — type-level contract for Batch B: list/duration/bytes coercions and
 * the widening effect of a conditional requirement.
 */

describe("list() inference", () => {
  it("is string[] by default", () => {
    const env = defineEnv({ ORIGINS: list() }, { source: { ORIGINS: "a" } });
    expectTypeOf(env.ORIGINS).toEqualTypeOf<string[]>();
  });

  it("takes its item type from .of()", () => {
    const env = defineEnv(
      { PORTS: list().of(port()), FLAGS: list().of(oneOf(["a", "b"])) },
      { source: { PORTS: "80", FLAGS: "a" } },
    );
    expectTypeOf(env.PORTS).toEqualTypeOf<number[]>();
    expectTypeOf(env.FLAGS).toEqualTypeOf<("a" | "b")[]>();
  });

  it("carries the item type through json()", () => {
    const env = defineEnv(
      { BLOBS: list().of(json<{ id: string }>()) },
      { source: { BLOBS: '{"id":"x"}' } },
    );
    expectTypeOf(env.BLOBS).toEqualTypeOf<{ id: string }[]>();
  });

  it("types .default() at the item type", () => {
    // @ts-expect-error — items are numbers, not strings
    list().of(port()).default(["3000"]);

    const env = defineEnv({ PORTS: list().of(port()).default([]) }, { source: {} });
    expectTypeOf(env.PORTS).toEqualTypeOf<number[]>();
  });

  it("widens with .optional()", () => {
    const env = defineEnv({ TAGS: list().optional() }, { source: {} });
    expectTypeOf(env.TAGS).toEqualTypeOf<string[] | undefined>();
  });

  it("re-types through .transform()", () => {
    const env = defineEnv(
      { TAGS: list().transform((items) => new Set(items)) },
      { source: { TAGS: "a" } },
    );
    expectTypeOf(env.TAGS).toEqualTypeOf<Set<string>>();
  });
});

describe("duration() and bytes() inference", () => {
  it("are plain numbers", () => {
    const env = defineEnv(
      { TIMEOUT: duration(), MAX_UPLOAD: bytes() },
      { source: { TIMEOUT: "30s", MAX_UPLOAD: "10mb" } },
    );
    expectTypeOf(env.TIMEOUT).toEqualTypeOf<number>();
    expectTypeOf(env.MAX_UPLOAD).toEqualTypeOf<number>();
  });

  it("take numeric defaults and numeric bounds", () => {
    // @ts-expect-error — the default is the COERCED value, a number of ms
    duration().default("30s");

    const env = defineEnv({ TIMEOUT: duration().min(0).max(60_000).default(5_000) }, { source: {} });
    expectTypeOf(env.TIMEOUT).toEqualTypeOf<number>();
  });
});

describe("conditional requirements widen the type", () => {
  it("makes the field possibly-undefined", () => {
    const env = defineEnv(
      {
        NODE_ENV: str().default("development"),
        STRIPE_KEY: str().requiredIn("production"),
        SENTRY_DSN: str().requiredWhen((e) => e.NODE_ENV === "production"),
      },
      { source: {} },
    );
    // TypeScript cannot know which environment you boot in — `T | undefined` is
    // the honest type, and the compiler makes you handle it.
    expectTypeOf(env.STRIPE_KEY).toEqualTypeOf<string | undefined>();
    expectTypeOf(env.SENTRY_DSN).toEqualTypeOf<string | undefined>();
  });

  it("keeps the underlying type otherwise", () => {
    const env = defineEnv({ PORT: port().requiredIn("production") }, { source: {} });
    expectTypeOf(env.PORT).toEqualTypeOf<number | undefined>();
  });

  it("types the predicate's argument as the resolved env", () => {
    num().requiredWhen((env) => {
      expectTypeOf(env).toEqualTypeOf<Record<string, unknown>>();
      return true;
    });
  });
});
