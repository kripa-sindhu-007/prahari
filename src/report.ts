/**
 * Formats a set of field failures into the readable boot-time report that
 * `defineEnv` throws. Plain text (no color) so it renders anywhere; the CLI may
 * add color on top.
 */

import type { FieldFailure } from "./errors.js";

function receivedText(received: string | undefined): string {
  if (received === undefined || received === "") return "";
  // Secrets arrive pre-redacted as "***"; show them without quotes.
  return received === "***" ? "  received: ***" : `  received: ${JSON.stringify(received)}`;
}

export function formatReport(failures: FieldFailure[]): string {
  const keyWidth = Math.max(...failures.map((f) => f.key.length));
  const typeWidth = Math.max(...failures.map((f) => f.expected.length + 2));

  const rows = failures.map((f) => {
    const key = f.key.padEnd(keyWidth);
    const type = `(${f.expected})`.padEnd(typeWidth);
    return `  ✗ ${key}  ${type}  ${f.reason}${receivedText(f.received)}`;
  });

  const noun = failures.length === 1 ? "variable" : "variables";
  return [
    `prahari: ${failures.length} environment ${noun} failed validation`,
    "",
    ...rows,
    "",
  ].join("\n");
}
