/**
 * Tiny zero-dependency terminal styling. Respects NO_COLOR / FORCE_COLOR and
 * falls back to TTY detection. Evaluated per call so it stays testable.
 */

export function colorEnabled(): boolean {
  if (typeof process === "undefined") return false;
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return process.stdout?.isTTY === true;
}

function wrap(code: number): (s: string) => string {
  return (s) => (colorEnabled() ? `\x1b[${code}m${s}\x1b[0m` : s);
}

export const green = wrap(32);
export const red = wrap(31);
export const yellow = wrap(33);
export const dim = wrap(2);
export const bold = wrap(1);

export const tick = green("✓");
export const cross = red("✗");
