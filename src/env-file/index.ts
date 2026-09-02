/**
 * `prahari/env-file` — opt-in `.env` file loading.
 *
 * This lives behind its own entry point ON PURPOSE. The main entry is
 * zero-dependency and bundler/edge-safe; `node:fs` must never reach it, or
 * `prahari` stops working in a browser or on a Worker. Importing this module is
 * the opt-in.
 *
 * The stance: prahari **validates** the environment. Loading a `.env` file is a
 * separate job that Node's own `--env-file` and `dotenv` already do well — keep
 * using either if you like them. This loader exists so that you don't *need* a
 * second tool, not because you must use this one.
 */

import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

/** Values read from a file, before any precedence is applied. */
export type EnvFileValues = Record<string, string>;

export interface LoadEnvFilesOptions {
  /** Directory that relative paths resolve against. Defaults to `process.cwd()`. */
  cwd?: string;
  /**
   * Values that take precedence over the files — the real environment.
   * Defaults to `process.env`.
   */
  base?: Record<string, string | undefined>;
  /** Let file values win over `base` instead. Default `false`. */
  override?: boolean;
  /**
   * Also write the resolved values into `process.env` (the dotenv-style side
   * effect). Off by default: a pure return value is easier to reason about and
   * to test.
   */
  mutateProcessEnv?: boolean;
}

/**
 * Matches one `KEY=VALUE` entry. Quoted values may span lines (PEM keys), so the
 * quoted alternatives are matched with newline-tolerant classes; unquoted values
 * stop at `#` (an inline comment) or end of line.
 */
const ENTRY =
  /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_.-]*)[ \t]*=[ \t]*("(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*'|`(?:[^`\\]|\\[\s\S])*`|[^#\r\n]*)/gm;

function unescapeDoubleQuoted(value: string): string {
  return value.replace(/\\([\s\S])/g, (_, ch: string) => {
    switch (ch) {
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case "b":
        return "\b";
      case "f":
        return "\f";
      default:
        // \\ \" \' and anything else: the character itself.
        return ch;
    }
  });
}

/**
 * Parse the text of a `.env` file.
 *
 * Supports `export ` prefixes, `#` comments (whole-line and trailing an unquoted
 * value), single/double/backtick quoting, `\n`-style escapes inside double
 * quotes, multi-line quoted values, and CRLF. A `#` inside an unquoted value
 * starts a comment — quote the value if it contains one.
 */
export function parseEnvFile(text: string): EnvFileValues {
  const out: EnvFileValues = {};
  // Strip a UTF-8 BOM; it would otherwise glue itself to the first key.
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  ENTRY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ENTRY.exec(source)) !== null) {
    const key = match[1]!;
    let value = (match[2] ?? "").trim();

    const quote = value[0];
    if (
      value.length >= 2 &&
      (quote === '"' || quote === "'" || quote === "`") &&
      value.endsWith(quote)
    ) {
      value = value.slice(1, -1);
      if (quote === '"') value = unescapeDoubleQuoted(value);
    }
    out[key] = value;
  }
  return out;
}

/** Read a file, treating "not there" as "nothing to load". */
function readIfPresent(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // A missing .env.local is the normal case, not a problem. A directory or a
    // permissions error is a real mistake and stays loud.
    if (code === "ENOENT") return undefined;
    throw err;
  }
}

/**
 * Load one or more `.env` files and return a source ready for `defineEnv`.
 *
 * ```ts
 * import { defineEnv } from "prahari";
 * import { loadEnvFiles } from "prahari/env-file";
 *
 * export const env = defineEnv(schema, {
 *   source: loadEnvFiles([".env.local", ".env"]),
 * });
 * ```
 *
 * Precedence, highest first: the real environment (`process.env`), then each
 * file **in the order listed** — so `[".env.local", ".env"]` reads the way you
 * wrote it. `{ override: true }` flips the first rule.
 *
 * A value that is present-but-empty in the environment counts as unset (the same
 * rule the validators use), so an empty `PORT=` in your shell does not mask the
 * `PORT` in your `.env`.
 */
export function loadEnvFiles(
  files: string | string[],
  options: LoadEnvFilesOptions = {},
): Record<string, string | undefined> {
  const cwd = options.cwd ?? (typeof process !== "undefined" ? process.cwd() : ".");
  const base = options.base ?? (typeof process !== "undefined" ? process.env : {});
  const list = Array.isArray(files) ? files : [files];

  const fromFiles: EnvFileValues = {};
  for (const file of list) {
    const text = readIfPresent(isAbsolute(file) ? file : resolve(cwd, file));
    if (text === undefined) continue;
    for (const [key, value] of Object.entries(parseEnvFile(text))) {
      // Earlier files win over later ones.
      if (!(key in fromFiles)) fromFiles[key] = value;
    }
  }

  const merged: Record<string, string | undefined> = { ...base };
  for (const [key, value] of Object.entries(fromFiles)) {
    const existing = merged[key];
    // `undefined` and `""` both mean "not set" in prahari, so a file value fills
    // either of them in — matching how the validators read the environment.
    if (options.override || existing === undefined || existing === "") {
      merged[key] = value;
    }
  }

  if (options.mutateProcessEnv && typeof process !== "undefined") {
    for (const [key, value] of Object.entries(fromFiles)) {
      const existing = process.env[key];
      if (options.override || existing === undefined || existing === "") {
        process.env[key] = value;
      }
    }
  }

  return merged;
}
