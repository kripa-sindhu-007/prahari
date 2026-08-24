/**
 * Built-in, zero-dependency validators for envguard.
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

import { EnvFieldError } from "./errors.js";

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

/** Extract the output type of a validator. */
export type Infer<V> = V extends Validator<infer T> ? T : never;

/** A record of validators — the shape passed to `defineEnv`. */
export type EnvSchema = Record<string, Validator<unknown>>;

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
