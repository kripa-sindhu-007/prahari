/**
 * `prahari docs` — render a Markdown table of every variable, straight from the
 * schema, so a project can paste an always-current env reference into its README.
 *
 * Pure renderer (unit-testable); the command wrapper does the IO.
 */

import type { EnvSchema, Validator } from "../validators.js";

function typeCell(v: Validator<unknown>): string {
  const base = v.meta.enumValues
    ? v.meta.enumValues.map((e) => `\`${e}\``).join(" \\| ")
    : v.meta.typeName;
  return v.meta.secret ? `${base} (secret)` : base;
}

function requiredCell(v: Validator<unknown>): string {
  return v.meta.optional || v.meta.hasDefault ? "no" : "yes";
}

function defaultCell(v: Validator<unknown>): string {
  // Never surface a default for a secret, even if one is declared.
  if (v.meta.secret || !v.meta.hasDefault || v.meta.default === undefined) return "—";
  const d = v.meta.default;
  return `\`${typeof d === "string" ? d : JSON.stringify(d)}\``;
}

/** Produce a Markdown table documenting a schema. */
export function renderDocs(schema: EnvSchema): string {
  const rows = Object.keys(schema).map((key) => {
    const v = schema[key] as Validator<unknown>;
    const desc = v.meta.description ?? "";
    return `| \`${key}\` | ${typeCell(v)} | ${requiredCell(v)} | ${defaultCell(v)} | ${desc} |`;
  });

  return [
    "| Variable | Type | Required | Default | Description |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}
