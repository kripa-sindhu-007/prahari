/**
 * CLI routing + command handlers, with injectable IO so the whole surface is
 * testable in-process (no spawning). `index.ts` is a thin bin around `run`.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { parseArgs } from "node:util";

import { loadEnvFiles } from "../env-file/index.js";
import { formatReport } from "../report.js";
import { renderEnvExample } from "./example.js";
import { renderDocs } from "./docs.js";
import { renderDoctorJson, runDoctor } from "./doctor.js";
import { computeDrift, hasDrift, parseEnvKeys, renderSyncJson } from "./sync.js";
import { loadSchema, resolveConfigPath } from "./load.js";
import { bold, cross, dim, green, red, tick, yellow } from "./ui.js";

export interface RunIO {
  cwd: string;
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  /** Source for `doctor`. Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
}

/** A user-facing CLI failure — caught by `run`, printed, turned into exit 1. */
class CliError extends Error {}

export const HELP = `${bold("prahari")} — type-safe environment variables

${bold("Usage:")} prahari <command> [options]

${bold("Commands:")}
  example    generate a .env.example from your schema
  sync       report drift between your schema and an env file
  doctor     validate the current environment against your schema
  docs       print a Markdown table documenting your variables

${bold("Options:")}
  -c, --config <path>   config module (default: env.ts / src/env.ts / …)
  -f, --file <path>     env file to compare (sync; default: .env.example)
  -o, --out <path>      output file (example: default .env.example; docs: stdout)
      --stdout          print to stdout instead of writing a file (example)
      --env-file <path> also read this .env file (doctor; real env still wins)
      --json            machine-readable output (doctor, sync); same exit codes
      --strict          warn about vars in the env file but not the schema
                        (doctor; requires --env-file)
  -h, --help            show this help
`;

async function getSchema(io: RunIO, configFlag?: string) {
  const path = resolveConfigPath(configFlag, io.cwd);
  if (!path) {
    throw new CliError(
      `no env config found. Create an ${bold("env.ts")} that calls ${bold(
        "defineEnv",
      )}, or pass ${bold("--config <path>")}.`,
    );
  }
  let schema;
  try {
    schema = await loadSchema(path);
  } catch (err) {
    throw new CliError(`failed to load ${relative(io.cwd, path)}: ${(err as Error).message}`);
  }
  if (Object.keys(schema).length === 0) {
    throw new CliError(
      `loaded ${relative(io.cwd, path)} but no schema was registered — does it call defineEnv()?`,
    );
  }
  return { schema, path };
}

async function cmdExample(io: RunIO, values: Record<string, unknown>): Promise<number> {
  const { schema, path } = await getSchema(io, values.config as string | undefined);
  const content = renderEnvExample(schema);

  if (values.stdout) {
    io.stdout(content);
    return 0;
  }

  const out = resolve(io.cwd, (values.out as string | undefined) ?? ".env.example");
  writeFileSync(out, content);
  io.stdout(
    `${tick} wrote ${bold(String(Object.keys(schema).length))} variable(s) to ${bold(
      relative(io.cwd, out),
    )} ${dim(`(from ${relative(io.cwd, path)})`)}\n`,
  );
  return 0;
}

async function cmdSync(io: RunIO, values: Record<string, unknown>): Promise<number> {
  const { schema } = await getSchema(io, values.config as string | undefined);
  const file = resolve(io.cwd, (values.file as string | undefined) ?? ".env.example");
  const rel = relative(io.cwd, file);

  if (!existsSync(file)) {
    if (values.json) {
      io.stdout(`${JSON.stringify({ ok: false, file: rel, error: "file not found" }, null, 2)}\n`);
      return 1;
    }
    io.stderr(`${cross} ${bold(rel)} does not exist. Run ${bold("prahari example")} to create it.\n`);
    return 1;
  }

  const drift = computeDrift(schema, parseEnvKeys(readFileSync(file, "utf8")));

  if (values.json) {
    io.stdout(renderSyncJson(rel, drift));
    return hasDrift(drift) ? 1 : 0;
  }

  if (!hasDrift(drift)) {
    io.stdout(`${tick} ${bold(rel)} is in sync with your schema.\n`);
    return 0;
  }

  io.stdout(`${cross} ${bold(rel)} has drifted from your schema:\n\n`);
  for (const key of drift.missing) {
    io.stdout(`  ${yellow("+")} ${key} ${dim("— in schema, missing from file")}\n`);
  }
  for (const key of drift.unknown) {
    io.stdout(`  ${red("-")} ${key} ${dim("— in file, not in schema")}\n`);
  }
  io.stdout(`\n${dim("Run `prahari example` to regenerate.")}\n`);
  return 1;
}

async function cmdDocs(io: RunIO, values: Record<string, unknown>): Promise<number> {
  const { schema, path } = await getSchema(io, values.config as string | undefined);
  const content = renderDocs(schema);

  const outFlag = values.out as string | undefined;
  if (!outFlag) {
    io.stdout(content);
    return 0;
  }

  const out = resolve(io.cwd, outFlag);
  writeFileSync(out, content);
  io.stdout(
    `${tick} wrote docs for ${bold(String(Object.keys(schema).length))} variable(s) to ${bold(
      relative(io.cwd, out),
    )} ${dim(`(from ${relative(io.cwd, path)})`)}\n`,
  );
  return 0;
}

async function cmdDoctor(io: RunIO, values: Record<string, unknown>): Promise<number> {
  const { schema } = await getSchema(io, values.config as string | undefined);
  const base = io.env ?? process.env;
  const envFile = values["env-file"] as string | undefined;
  const json = values.json === true;
  const strict = values.strict === true;

  if (strict && envFile === undefined) {
    // Against process.env this would flag PATH, HOME and a hundred others —
    // noise, not signal. Strict mode needs a source you actually control.
    throw new CliError(
      `${bold("--strict")} needs ${bold("--env-file <path>")} — the process environment ` +
        `carries hundreds of unrelated variables, so reporting "unknown" against it is noise.`,
    );
  }

  let source = base;
  if (envFile !== undefined) {
    const path = resolve(io.cwd, envFile);
    if (!existsSync(path)) {
      throw new CliError(`env file not found: ${bold(relative(io.cwd, path))}`);
    }
    // The real environment still wins over the file — validate what the process
    // would actually see if it booted here.
    source = loadEnvFiles(path, { base, cwd: io.cwd });
    if (!json) {
      io.stdout(`${dim(`(against ${relative(io.cwd, path)} + the current environment)`)}\n`);
    }
  }

  // Strict reports unknowns from the FILE's own keys — the set the developer
  // wrote and controls — not from the whole process environment.
  const unknownKeys = strict
    ? parseEnvKeys(readFileSync(resolve(io.cwd, envFile!), "utf8"))
    : undefined;

  const result = runDoctor(schema, source, { unknownKeys });

  if (json) {
    io.stdout(renderDoctorJson(schema, result));
    return result.failures.length === 0 ? 0 : 1;
  }

  for (const key of result.ok) io.stdout(`  ${tick} ${key}\n`);

  for (const warning of result.warnings) {
    io.stdout(`  ${yellow("!")} ${warning.message}\n`);
  }

  if (result.failures.length === 0) {
    io.stdout(`\n${green(`All ${result.ok.length} variable(s) valid.`)}\n`);
    return 0;
  }
  // Same table the boot error carries, painted for a terminal. `sync` has always
  // failed in colour; there was no reason for `doctor` to whisper.
  io.stdout(
    `\n${formatReport(result.failures, {
      heading: red,
      cross: red,
      key: bold,
      type: dim,
      received: dim,
    })}`,
  );
  return 1;
}

export async function run(argv: string[], io: RunIO): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        config: { type: "string", short: "c" },
        file: { type: "string", short: "f" },
        out: { type: "string", short: "o" },
        stdout: { type: "boolean" },
        "env-file": { type: "string" },
        json: { type: "boolean" },
        strict: { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    io.stderr(`${cross} ${(err as Error).message}\n\n${HELP}`);
    return 1;
  }

  const { values, positionals } = parsed;
  const command = positionals[0];

  if (values.help || !command) {
    io.stdout(HELP);
    return command || values.help ? 0 : 1;
  }

  try {
    switch (command) {
      case "example":
        return await cmdExample(io, values);
      case "sync":
        return await cmdSync(io, values);
      case "doctor":
        return await cmdDoctor(io, values);
      case "docs":
        return await cmdDocs(io, values);
      default:
        io.stderr(`${cross} unknown command: ${bold(command)}\n\n${HELP}`);
        return 1;
    }
  } catch (err) {
    if (err instanceof CliError) {
      io.stderr(`${cross} ${err.message}\n`);
      return 1;
    }
    throw err;
  }
}
