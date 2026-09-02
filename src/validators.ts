/**
 * Built-in, zero-dependency validators for prahari.
 *
 * A validator describes one environment variable: how to coerce its (always
 * string) raw value into a typed value, what extra checks apply, and metadata
 * for docs / `.env.example` generation. Validators are inert descriptors — the
 * core (`defineEnv`) drives them.
 *
 * Coercion rules (frozen — see the coercion test matrix):
 *  - Absent means `raw === undefined || raw === ""` (an explicitly empty env var
 *    counts as unset). Absent → default if set, else `undefined` if `.optional()`,
 *    else a "required" error.
 *  - Numbers/ports/urls/booleans/enums are trimmed before coercion; strings are
 *    kept verbatim.
 *  - Booleans: truthy = 1|true|yes|on, falsey = 0|false|no|off (case-insensitive),
 *    anything else is an error.
 *  - Defaults are already-typed values, NOT re-parsed strings (so a `.default(3000)`
 *    is the number 3000, full stop).
 */

import { URL } from "node:url";

import { EnvFieldError, isEnvFieldError } from "./errors.js";

const TRUTHY = new Set(["1", "true", "yes", "on"]);
const FALSEY = new Set(["0", "false", "no", "off"]);

export interface ValidatorMeta<T> {
  typeName: string;
  description?: string;
  secret: boolean;
  optional: boolean;
  hasDefault: boolean;
  default?: T;
  enumValues?: readonly string[];
}

/** Public shape of any validator. */
export interface Validator<T> {
  readonly typeName: string;
  readonly meta: ValidatorMeta<T>;
  /** Coerce+validate a raw value. Throws `EnvFieldError` on failure. */
  parse(raw: string | undefined): T;
  /** A placeholder value for this variable in a generated `.env.example`. */
  exampleValue(): string;
}

// --------------------------------------------------------------------------
// Standard Schema (https://standardschema.dev)
//
// Vendored, zero-dependency copy of the v1 interface — the spec's own
// recommendation is to COPY the type, not depend on a package. Zod (>=3.24),
// Valibot, ArkType and others expose their schemas through this `~standard`
// property, so `defineEnv` can accept any of them as a field validator.
// We call `validate(value)`; the real libraries' `(value, options?) => ...`
// signature is structurally assignable to ours.
// --------------------------------------------------------------------------

/** One issue reported by a Standard Schema validator. */
export interface StandardIssue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined;
}

/** Result of a Standard Schema `validate` call. */
export type StandardResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<StandardIssue> };

/** The `~standard` props object every Standard Schema validator exposes. */
export interface StandardSchemaProps<Input = unknown, Output = Input> {
  readonly version: 1;
  readonly vendor: string;
  readonly validate: (
    value: unknown,
  ) => StandardResult<Output> | Promise<StandardResult<Output>>;
  readonly types?: { readonly input: Input; readonly output: Output } | undefined;
}

/** Any Standard-Schema-compatible validator (Zod / Valibot / ArkType / …). */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaProps<Input, Output>;
}

/** Extract the output type of a Standard Schema validator. */
export type InferStandard<S> =
  S extends StandardSchemaV1<unknown, infer O> ? O : never;

/** True if `x` is a Standard Schema validator (has a callable `~standard.validate`). */
export function isStandardSchema(x: unknown): x is StandardSchemaV1 {
  // ArkType exposes its schema as a *callable function* carrying `~standard`,
  // so accept functions as well as plain objects.
  if ((typeof x !== "object" && typeof x !== "function") || x === null) return false;
  const std = (x as { "~standard"?: unknown })["~standard"];
  return (
    typeof std === "object" &&
    std !== null &&
    typeof (std as { validate?: unknown }).validate === "function"
  );
}

/** A single field passed to `defineEnv` — a built-in validator or a Standard Schema. */
export type EnvField = Validator<unknown> | StandardSchemaV1;

/** Extract the output type of any field (built-in validator or Standard Schema). */
export type Infer<V> =
  V extends Validator<infer T> ? T : V extends StandardSchemaV1<unknown, infer O> ? O : never;

/** A record of fields — the shape passed to `defineEnv`. */
export type EnvSchema = Record<string, EnvField>;

/** The typed env object inferred from a schema. */
export type InferEnv<S extends EnvSchema> = {
  [K in keyof S]: Infer<S[K]>;
};

abstract class BaseValidator<T> implements Validator<T> {
  abstract readonly typeName: string;
  readonly meta: ValidatorMeta<T>;
  protected readonly checks: Array<(value: T) => void> = [];

  constructor() {
    this.meta = { typeName: "", secret: false, optional: false, hasDefault: false };
  }

  /** Coerce a *present, non-empty* raw string into T. Throws on failure. */
  protected abstract coerce(raw: string): T;

  /** Type-specific placeholder for `.env.example` (overridable). */
  protected placeholder(): string {
    return "";
  }

  parse(raw: string | undefined): T {
    const absent = raw === undefined || raw === "";
    if (absent) {
      if (this.meta.hasDefault) return this.meta.default as T;
      if (this.meta.optional) return undefined as T;
      throw new EnvFieldError("is required but was not set");
    }
    return this.coerceChecked(raw);
  }

  /** Coerce a present raw value and run every registered check. */
  protected coerceChecked(raw: string): T {
    const value = this.coerce(raw);
    for (const check of this.checks) check(value);
    return value;
  }

  exampleValue(): string {
    if (this.meta.hasDefault && this.meta.default !== undefined) {
      const d = this.meta.default;
      return typeof d === "string" ? d : JSON.stringify(d);
    }
    return this.placeholder();
  }

  // ---- shared modifiers ----

  desc(text: string): this {
    this.meta.description = text;
    return this;
  }

  secret(): this {
    this.meta.secret = true;
    return this;
  }

  default(value: T): this {
    this.meta.hasDefault = true;
    this.meta.default = value;
    return this;
  }

  optional(): Validator<T | undefined> {
    this.meta.optional = true;
    return this as unknown as Validator<T | undefined>;
  }

  /**
   * Post-process a validated value into a derived type, returning a NEW
   * validator typed at the result — so `.default()` / `.optional()` chained
   * after `.transform()` are typed at the transformed type, which is what reads
   * naturally: `str().transform((s) => s.split(","))`.
   *
   * The transform runs after this validator's coercion AND its checks. A
   * default declared BEFORE the transform is transformed eagerly (once, at
   * declaration) so the declared intent survives; `desc`/`secret`/`optional`
   * carry over because they describe the variable, not the type.
   */
  transform<U>(fn: (value: T) => U): DerivedValidator<U> {
    const inner = this;
    const derived = new DerivedValidator<U>({
      // The type name still describes what the RAW value must look like.
      typeName: inner.meta.typeName,
      coerce: (raw) => runUserFn(() => fn(inner.coerceChecked(raw))),
      // `.env.example` needs the raw, pre-transform placeholder.
      example: () => inner.exampleValue(),
    });
    derived.meta.description = inner.meta.description;
    derived.meta.secret = inner.meta.secret;
    derived.meta.optional = inner.meta.optional;
    if (inner.meta.hasDefault) {
      derived.meta.hasDefault = true;
      try {
        derived.meta.default = fn(inner.meta.default as T);
      } catch (err) {
        // A default that cannot survive its own transform is a declaration bug,
        // not a config error — fail loudly where it is written.
        throw new Error(
          `.transform() failed on the declared default: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    return derived;
  }
}

/**
 * Run a user-supplied coercion (`custom()` / `.transform()`) and normalize any
 * failure into an `EnvFieldError`, so `throw new Error("must be a UUID")` in
 * user code becomes an ordinary row in the boot report instead of crashing the
 * process with an unhandled error.
 */
function runUserFn<T>(run: () => T): T {
  try {
    return run();
  } catch (err) {
    if (isEnvFieldError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new EnvFieldError(message === "" ? "failed validation" : message);
  }
}

interface DerivedOptions<T> {
  typeName: string;
  coerce: (raw: string) => T;
  /** Overrides the default-derived `.env.example` placeholder when supplied. */
  example?: () => string;
}

/**
 * A validator built from a plain coercion function — the single implementation
 * behind both `custom()` and `.transform()`. It inherits every shared modifier
 * (`.desc/.secret/.default/.optional/.transform`) from `BaseValidator`.
 */
class DerivedValidator<T> extends BaseValidator<T> {
  readonly typeName: string;
  private readonly coerceFn: (raw: string) => T;
  private readonly exampleFn?: () => string;

  constructor(options: DerivedOptions<T>) {
    super();
    this.typeName = options.typeName;
    this.meta.typeName = options.typeName;
    this.coerceFn = options.coerce;
    this.exampleFn = options.example;
  }

  protected coerce(raw: string): T {
    return this.coerceFn(raw);
  }

  override exampleValue(): string {
    if (this.exampleFn) return this.exampleFn();
    return super.exampleValue();
  }
}

export type { DerivedValidator };

/** Extra metadata for a `custom()` field. */
export interface CustomMeta {
  /** Human description for docs / `.env.example`. */
  desc?: string;
  /** Redact the value in the boot report and never write it to `.env.example`. */
  secret?: boolean;
  /** Placeholder value for `.env.example`. */
  example?: string;
  /** Type label shown in the report and docs. Defaults to `"custom"`. */
  typeName?: string;
}

/**
 * Declare a one-off validator without reaching for a schema library — the
 * zero-dependency escape hatch for a bespoke type.
 *
 * `fn` receives the present, non-empty raw string and returns the typed value.
 * Throw anything (an `Error` is enough) to fail the variable; the message
 * becomes the reason in the aggregate report.
 *
 * ```ts
 * const env = defineEnv({
 *   REGION: custom((raw) => {
 *     if (!/^[a-z]{2}-[a-z]+-\d$/.test(raw)) throw new Error("must look like us-east-1");
 *     return raw as `${string}-${string}-${number}`;
 *   }, { desc: "AWS region" }),
 * });
 * ```
 */
export function custom<T>(
  fn: (raw: string) => T,
  meta: CustomMeta = {},
): DerivedValidator<T> {
  const example = meta.example;
  const validator = new DerivedValidator<T>({
    typeName: meta.typeName ?? "custom",
    coerce: (raw) => runUserFn(() => fn(raw)),
    example: example !== undefined ? () => example : undefined,
  });
  if (meta.desc !== undefined) validator.desc(meta.desc);
  if (meta.secret) validator.secret();
  return validator;
}

// --------------------------------------------------------------------------
// string
// --------------------------------------------------------------------------

class StringValidator extends BaseValidator<string> {
  readonly typeName = "string";
  constructor() {
    super();
    this.meta.typeName = "string";
  }
  protected coerce(raw: string): string {
    return raw;
  }
  protected override placeholder(): string {
    return "";
  }
  min(length: number): this {
    this.checks.push((v) => {
      if (v.length < length) throw new EnvFieldError(`must be at least ${length} characters`);
    });
    return this;
  }
  max(length: number): this {
    this.checks.push((v) => {
      if (v.length > length) throw new EnvFieldError(`must be at most ${length} characters`);
    });
    return this;
  }
  startsWith(prefix: string): this {
    this.checks.push((v) => {
      if (!v.startsWith(prefix)) throw new EnvFieldError(`must start with "${prefix}"`);
    });
    return this;
  }
  matches(pattern: RegExp): this {
    this.checks.push((v) => {
      if (!pattern.test(v)) throw new EnvFieldError(`must match ${pattern}`);
    });
    return this;
  }
}

// --------------------------------------------------------------------------
// number / port
// --------------------------------------------------------------------------

class NumberValidator extends BaseValidator<number> {
  readonly typeName: string = "number";
  constructor() {
    super();
    this.meta.typeName = "number";
  }
  protected coerce(raw: string): number {
    const t = raw.trim();
    if (t === "") throw new EnvFieldError("must be a number");
    const n = Number(t);
    if (!Number.isFinite(n)) throw new EnvFieldError("must be a number");
    return n;
  }
  protected override placeholder(): string {
    return "0";
  }
  int(): this {
    this.checks.push((v) => {
      if (!Number.isInteger(v)) throw new EnvFieldError("must be an integer");
    });
    return this;
  }
  min(value: number): this {
    this.checks.push((v) => {
      if (v < value) throw new EnvFieldError(`must be >= ${value}`);
    });
    return this;
  }
  max(value: number): this {
    this.checks.push((v) => {
      if (v > value) throw new EnvFieldError(`must be <= ${value}`);
    });
    return this;
  }
}

class PortValidator extends NumberValidator {
  override readonly typeName: string = "port";
  constructor() {
    super();
    this.meta.typeName = "port";
    this.int();
    this.min(1);
    this.max(65535);
  }
  protected override placeholder(): string {
    return "3000";
  }
}

// --------------------------------------------------------------------------
// boolean
// --------------------------------------------------------------------------

class BooleanValidator extends BaseValidator<boolean> {
  readonly typeName = "boolean";
  constructor() {
    super();
    this.meta.typeName = "boolean";
  }
  protected coerce(raw: string): boolean {
    const v = raw.trim().toLowerCase();
    if (TRUTHY.has(v)) return true;
    if (FALSEY.has(v)) return false;
    throw new EnvFieldError(`must be a boolean (${[...TRUTHY, ...FALSEY].join("|")})`);
  }
  protected override placeholder(): string {
    return "false";
  }
}

// --------------------------------------------------------------------------
// url
// --------------------------------------------------------------------------

class UrlValidator extends BaseValidator<string> {
  readonly typeName = "url";
  constructor() {
    super();
    this.meta.typeName = "url";
  }
  protected coerce(raw: string): string {
    const s = raw.trim();
    try {
      // eslint-disable-next-line no-new
      new URL(s);
    } catch {
      throw new EnvFieldError("must be a valid URL");
    }
    return s;
  }
  protected override placeholder(): string {
    return "https://example.com";
  }
  protocol(protocol: string): this {
    const want = protocol.endsWith(":") ? protocol : `${protocol}:`;
    this.checks.push((v) => {
      if (new URL(v).protocol !== want) throw new EnvFieldError(`must use ${want} protocol`);
    });
    return this;
  }
}

// --------------------------------------------------------------------------
// oneOf (enum)
// --------------------------------------------------------------------------

class EnumValidator<T extends string> extends BaseValidator<T> {
  readonly typeName = "enum";
  constructor(private readonly values: readonly T[]) {
    super();
    this.meta.typeName = "enum";
    this.meta.enumValues = values;
  }
  protected coerce(raw: string): T {
    const s = raw.trim();
    if ((this.values as readonly string[]).includes(s)) return s as T;
    throw new EnvFieldError(`must be one of ${this.values.join(", ")}`);
  }
  protected override placeholder(): string {
    return this.values[0] ?? "";
  }
}

// --------------------------------------------------------------------------
// json
// --------------------------------------------------------------------------

class JsonValidator<T> extends BaseValidator<T> {
  readonly typeName = "json";
  constructor() {
    super();
    this.meta.typeName = "json";
  }
  protected coerce(raw: string): T {
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new EnvFieldError("must be valid JSON");
    }
  }
  protected override placeholder(): string {
    return "{}";
  }
}

// --------------------------------------------------------------------------
// public factory functions
// --------------------------------------------------------------------------

export function str(): StringValidator {
  return new StringValidator();
}

export function num(): NumberValidator {
  return new NumberValidator();
}

export function port(): PortValidator {
  return new PortValidator();
}

export function bool(): BooleanValidator {
  return new BooleanValidator();
}

export function url(): UrlValidator {
  return new UrlValidator();
}

export function oneOf<const T extends string>(values: readonly T[]): EnumValidator<T> {
  return new EnumValidator<T>(values);
}

export function json<T = unknown>(): JsonValidator<T> {
  return new JsonValidator<T>();
}

// --------------------------------------------------------------------------
// Standard Schema bridge
// --------------------------------------------------------------------------

/** Join a Standard Schema validator's issues into one report fragment. */
export function formatStandardIssues(issues: ReadonlyArray<StandardIssue>): string {
  const msgs = issues.map((i) => i.message).filter(Boolean);
  return msgs.length > 0 ? msgs.join("; ") : "failed validation";
}

/** True for a thenable — a Standard Schema `validate` that resolved to a Promise. */
export function isPromiseLike(x: unknown): x is Promise<unknown> {
  return (
    (typeof x === "object" || typeof x === "function") &&
    x !== null &&
    typeof (x as { then?: unknown }).then === "function"
  );
}

/** Reason reported when a Standard Schema validator returns a Promise. */
export const ASYNC_STANDARD_MESSAGE =
  "returned a Promise — prahari validates synchronously; use a synchronous schema";

/** Reason reported when a Standard Schema validator returns no result object. */
export const NO_RESULT_STANDARD_MESSAGE = "validator returned no result";

/** Extra prahari metadata to attach to a wrapped Standard Schema. */
export interface StandardMeta {
  /** Redact the value in the boot report and never write it to `.env.example`. */
  secret?: boolean;
  /** Human description for docs / `.env.example`. */
  desc?: string;
  /** Placeholder value for `.env.example`. */
  example?: string;
  /** Type label shown in the report and docs (defaults to the vendor, e.g. "zod"). */
  typeName?: string;
}

/**
 * Wrap a Standard Schema validator as a prahari `Validator`, attaching metadata
 * so it participates fully in the boot report (with redaction), `.env.example`,
 * and `docs`. Bare Standard Schemas also work in `defineEnv` — this wrapper is
 * for when you want redaction or richer docs on a Zod/Valibot/ArkType field.
 */
export function standard<S extends StandardSchemaV1>(
  schema: S,
  meta: StandardMeta = {},
): Validator<InferStandard<S>> {
  type Out = InferStandard<S>;
  const props = schema["~standard"];
  const example = meta.example ?? "";
  return {
    typeName: meta.typeName ?? props.vendor,
    meta: {
      typeName: meta.typeName ?? props.vendor,
      description: meta.desc,
      secret: meta.secret ?? false,
      optional: false,
      hasDefault: false,
    },
    parse(raw: string | undefined): Out {
      const result = props.validate(raw);
      if (isPromiseLike(result)) throw new EnvFieldError(ASYNC_STANDARD_MESSAGE);
      if (!result) throw new EnvFieldError(NO_RESULT_STANDARD_MESSAGE);
      const sync = result as StandardResult<Out>;
      if (sync.issues) throw new EnvFieldError(formatStandardIssues(sync.issues));
      return sync.value;
    },
    exampleValue(): string {
      return example;
    },
  };
}

// --------------------------------------------------------------------------
// Introspection — a uniform descriptor for either kind of field, so the CLI
// (`example`, `docs`) can render a schema that mixes built-ins and bare
// Standard Schemas without special-casing at each call site.
// --------------------------------------------------------------------------

/** Normalized, render-ready view of a field. */
export interface FieldDescriptor {
  typeName: string;
  description?: string;
  secret: boolean;
  optional: boolean;
  hasDefault: boolean;
  default?: unknown;
  enumValues?: readonly string[];
  /** `true` for a bare Standard Schema: prahari can't see optional/default/example. */
  opaque: boolean;
  exampleValue(): string;
}

/**
 * Describe any field uniformly. Built-in validators (and `standard()` wrappers)
 * expose full metadata; a BARE Standard Schema exposes only its vendor, so its
 * descriptor is marked `opaque` and carries no optional/default/example.
 */
export function describeField(field: EnvField): FieldDescriptor {
  if (isStandardSchema(field)) {
    const vendor = field["~standard"].vendor;
    return {
      typeName: vendor,
      secret: false,
      optional: false,
      hasDefault: false,
      opaque: true,
      exampleValue: () => "",
    };
  }
  const v = field as Validator<unknown>;
  return {
    typeName: v.meta.typeName,
    description: v.meta.description,
    secret: v.meta.secret,
    optional: v.meta.optional,
    hasDefault: v.meta.hasDefault,
    default: v.meta.default,
    enumValues: v.meta.enumValues,
    opaque: false,
    exampleValue: () => v.exampleValue(),
  };
}
