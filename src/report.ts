/**
 * Formats a set of field failures into the readable boot-time report that
 * `defineEnv` throws.
 *
 * Plain text by default — it ends up inside an `Error.message`, which gets
 * logged, serialized and diffed, and ANSI escapes have no business in any of
 * that. The CLI passes a `paint` map to colourise the same layout, so there is
 * ONE implementation of the table rather than a plain one and a pretty one that
 * quietly drift apart.
 *
 * Padding is computed on the raw text and colour applied after, because an ANSI
 * escape counts toward `String.length` and would silently break the columns.
 */

import type { FieldFailure } from "./errors.js";

/** Per-part styling hooks. Anything omitted is left untouched. */
export interface ReportPaint {
  heading?: (s: string) => string;
  cross?: (s: string) => string;
  key?: (s: string) => string;
  type?: (s: string) => string;
  reason?: (s: string) => string;
  received?: (s: string) => string;
}

const asIs = (s: string): string => s;

function receivedText(received: string | undefined): string {
  if (received === undefined || received === "") return "";
  // Secrets arrive pre-redacted as "***"; show them without quotes.
  return received === "***" ? "  received: ***" : `  received: ${JSON.stringify(received)}`;
}

export function formatReport(failures: FieldFailure[], paint: ReportPaint = {}): string {
  const heading = paint.heading ?? asIs;
  const cross = paint.cross ?? asIs;
  const key = paint.key ?? asIs;
  const type = paint.type ?? asIs;
  const reason = paint.reason ?? asIs;
  const received = paint.received ?? asIs;

  const keyWidth = Math.max(...failures.map((f) => f.key.length));
  const typeWidth = Math.max(...failures.map((f) => f.expected.length + 2));

  const rows = failures.map((f) => {
    const paddedKey = key(f.key.padEnd(keyWidth));
    const paddedType = type(`(${f.expected})`.padEnd(typeWidth));
    return `  ${cross("✗")} ${paddedKey}  ${paddedType}  ${reason(f.reason)}${received(
      receivedText(f.received),
    )}`;
  });

  const noun = failures.length === 1 ? "variable" : "variables";
  return [
    heading(`prahari: ${failures.length} environment ${noun} failed validation`),
    "",
    ...rows,
    "",
  ].join("\n");
}
