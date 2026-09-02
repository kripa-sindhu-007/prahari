/**
 * `prahari docs` — render a Markdown table of every variable, straight from the
 * schema, so a project can paste an always-current env reference into its README.
 *
 * Pure renderer (unit-testable); the command wrapper does the IO.
 */

import { describeField, type EnvSchema, type FieldDescriptor } from "../validators.js";

function typeCell(d: FieldDescriptor): string {
  const base = d.enumValues
    ? d.enumValues.map((e) => `\`${e}\``).join(" \\| ")
    : d.typeName;
  const notes: string[] = [];
  if (d.secret) notes.push("secret");
  if (d.deprecated) notes.push("deprecated");
  return notes.length > 0 ? `${base} (${notes.join(", ")})` : base;
}

function requiredCell(d: FieldDescriptor): string {
  // A bare Standard Schema owns its own optionality — prahari can't read it.
  if (d.opaque) return "?";
  if (d.conditional) {
    // Escape the cell separator: a condition label may contain a pipe.
    const label = d.conditionLabel?.replace(/\|/g, "\\|");
    return label ? `when ${label}` : "conditional";
  }
  return d.optional || d.hasDefault ? "no" : "yes";
}

function defaultCell(d: FieldDescriptor): string {
  // Never surface a default for a secret, even if one is declared.
  if (d.secret || !d.hasDefault || d.default === undefined) return "—";
  const v = d.default;
  return `\`${typeof v === "string" ? v : JSON.stringify(v)}\``;
}

/** Produce a Markdown table documenting a schema. */
export function renderDocs(schema: EnvSchema): string {
  const rows = Object.keys(schema).map((key) => {
    const d = describeField(schema[key]!);
    const notes = [d.description, d.deprecationMessage && `**Deprecated** — ${d.deprecationMessage}`];
    const desc = notes.filter(Boolean).join(" ");
    return `| \`${key}\` | ${typeCell(d)} | ${requiredCell(d)} | ${defaultCell(d)} | ${desc} |`;
  });

  return [
    "| Variable | Type | Required | Default | Description |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}
