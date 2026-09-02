/**
 * Composable schemas — a shared base env schema that individual packages extend.
 *
 * The monorepo case: `packages/config` declares what every service needs, each
 * app adds its own variables on top. Composition is a WRAPPER object rather than
 * a schema record carrying an `extend` key, because `defineEnv` iterates the
 * record's keys — a glued-on method would be walked as if it were a variable.
 *
 * Composition is immutable: `.extend()` returns a new `ComposedSchema` and never
 * mutates the base, so one app extending the shared base cannot change what the
 * others see.
 */

import type { EnvSchema } from "./validators.js";

/**
 * Brand for cross-bundle-safe detection. The runtime entry and the CLI are
 * separate bundles (see `registry.ts`), so a plain `instanceof` is unreliable;
 * `Symbol.for` resolves to the same symbol in both.
 */
const COMPOSED = Symbol.for("prahari.composed.v1");

/** Flatten an intersection into a single readable object type. */
type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** Merge two schemas — later keys win, at the type level too. */
export type MergeSchemas<A extends EnvSchema, B extends EnvSchema> = Simplify<
  Omit<A, keyof B> & B
>;

/** A schema that can be extended. Accepted anywhere a plain schema record is. */
export interface ComposedSchema<S extends EnvSchema> {
  readonly [COMPOSED]: true;
  /** The flattened field record. */
  readonly fields: S;
  /** Add fields, overriding any base key of the same name. Returns a new schema. */
  extend<E extends EnvSchema>(fields: E): ComposedSchema<MergeSchemas<S, E>>;
  /** Merge another schema (plain or composed) on top. Returns a new schema. */
  merge<O extends EnvSchema>(
    other: O | ComposedSchema<O>,
  ): ComposedSchema<MergeSchemas<S, O>>;
}

/** Either form accepted by `defineEnv` / `safeParse`. */
export type SchemaInput<S extends EnvSchema> = S | ComposedSchema<S>;

/** True if `x` is a `ComposedSchema` rather than a plain field record. */
export function isComposedSchema(x: unknown): x is ComposedSchema<EnvSchema> {
  return typeof x === "object" && x !== null && (x as Record<symbol, unknown>)[COMPOSED] === true;
}

/**
 * Declare a reusable, extendable schema.
 *
 * ```ts
 * // packages/config/base.ts
 * export const base = defineSchema({ LOG_LEVEL: oneOf(["debug", "info", "warn"]) });
 *
 * // apps/api/env.ts
 * export const env = defineEnv(base.extend({ PORT: port() }));
 * ```
 */
export function defineSchema<S extends EnvSchema>(fields: S): ComposedSchema<S> {
  // Copy on the way in as well as on the way out: the caller's object stays
  // theirs, and later mutation of it can't reach through into the composition.
  const own = { ...fields } as S;
  return {
    [COMPOSED]: true,
    fields: own,
    extend<E extends EnvSchema>(more: E) {
      return defineSchema({ ...own, ...more } as unknown as MergeSchemas<S, E>);
    },
    merge<O extends EnvSchema>(other: O | ComposedSchema<O>) {
      return defineSchema({
        ...own,
        ...normalizeSchema(other),
      } as unknown as MergeSchemas<S, O>);
    },
  };
}

/** Reduce either accepted form to the plain field record the core walks. */
export function normalizeSchema<S extends EnvSchema>(schema: SchemaInput<S>): S {
  return isComposedSchema(schema) ? (schema.fields as S) : schema;
}
