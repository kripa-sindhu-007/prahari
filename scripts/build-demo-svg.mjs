/**
 * Regenerates `assets/demo.svg` — the animated terminal demo in the README.
 *
 *   node scripts/build-demo-svg.mjs
 *
 * The lines below are REAL output, captured from the built CLI against a fixture
 * schema (see FIXTURE at the bottom of this file for how to reproduce). Only the
 * `note` lines are editorial — they are annotations, styled distinctly, not
 * pretend terminal output.
 *
 * A README demo that drifts from the tool it advertises would be a poor look for
 * this project in particular, so this generator exists to make refreshing it a
 * one-liner rather than a pixel-editing session.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/demo.svg");

const C = {
  bg: "#0B0F14",
  border: "#1F2933",
  text: "#C9D1D9",
  dim: "#6E7681",
  green: "#3FB950",
  red: "#F85149",
  yellow: "#D29922",
  prompt: "#22C55E",
  note: "#7D8590",
  bold: "#E6EDF3",
};

/** kind → fill colour + weight. */
const KIND = {
  cmd: { fill: C.prompt, weight: 700 },
  out: { fill: C.text, weight: 400 },
  ok: { fill: C.green, weight: 400 },
  bad: { fill: C.red, weight: 400 },
  warn: { fill: C.yellow, weight: 400 },
  dim: { fill: C.dim, weight: 400 },
  bold: { fill: C.bold, weight: 700 },
  head: { fill: C.bold, weight: 700 },
  note: { fill: C.note, weight: 400, italic: true },
  gap: { fill: C.text, weight: 400 },
  seg: { fill: C.text, weight: 400 },
};

/** Flatten a line to plain text, for width measurement. */
const plain = (text) => (Array.isArray(text) ? text.map(([, s]) => s).join("") : text);

/**
 * A failure row as the CLI actually paints it: red ✗, bold key, dim type, plain
 * reason, dim received. Written as segments so the demo matches the terminal
 * part for part — the columns come from the real `padEnd` widths.
 */
const row = (key, type, reason, received) => [
  ["out", "  "],
  ["bad", "✗"],
  ["out", " "],
  ["bold", key],
  ["out", "  "],
  ["dim", type],
  ["out", `  ${reason}`],
  ["dim", `  received: ${received}`],
];

// Each entry: [kind, text | segments, holdSeconds] — hold is the pause AFTER
// the line. A segment array renders as <tspan>s inside one <text>.
const SCRIPT = [
  ["cmd", "$ prahari doctor", 0.5],
  ["ok", "  ✓ NODE_ENV", 0.06],
  ["ok", "  ✓ SENTRY_DSN", 0.25],
  ["gap", "", 0.05],
  ["bad", "prahari: 3 environment variables failed validation", 0.3],
  ["gap", "", 0.05],
  ["seg", row("PORT        ", "(port)  ", "must be <= 65535", '"99999"'), 0.12],
  ["seg", row("DATABASE_URL", "(url)   ", "must be a valid URL", '"postgres"'), 0.12],
  ["seg", row("STRIPE_KEY  ", "(string)", 'must start with "sk_"', "***"), 0.1],
  ["note", "                                                        ↑ secret, never printed", 1.6],
  ["gap", "", 0.2],
  ["cmd", "$ prahari sync", 0.5],
  ["bad", "✗ .env.example has drifted from your schema:", 0.3],
  ["gap", "", 0.05],
  ["warn", "  + STRIPE_KEY — in schema, missing from file", 0.12],
  ["warn", "  + SENTRY_DSN — in schema, missing from file", 0.35],
  ["gap", "", 0.05],
  ["dim", "Run `prahari example` to regenerate.", 0.5],
  ["cmd", "$ echo $?", 0.35],
  ["out", "1", 0.05],
  ["note", "  ← the build fails here, not in production", 3.2],
];

const FONT_SIZE = 13.5;
const LINE_H = 21;
const CHAR_W = 8.13; // ui-monospace at 13.5px
const PAD_X = 22;
const PAD_TOP = 52; // room for the title bar
const PAD_BOTTOM = 20;

const longest = Math.max(...SCRIPT.map(([, t]) => plain(t).length));
const WIDTH = Math.ceil(PAD_X * 2 + longest * CHAR_W);
const HEIGHT = PAD_TOP + SCRIPT.length * LINE_H + PAD_BOTTOM;

// Build the timeline: a line appears at its cumulative offset and stays until
// the loop restarts, so the whole session reads as one continuous transcript.
let t = 0;
const timeline = SCRIPT.map((entry) => {
  const at = t;
  t += 0.16 + entry[2]; // typing beat + the line's own hold
  return { kind: entry[0], text: entry[1], at };
});
const TOTAL = Math.ceil(t * 10) / 10;

const pct = (seconds) => Math.min(100, (seconds / TOTAL) * 100);

const escape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const keyframes = timeline
  .map((line, i) => {
    const start = pct(line.at);
    const appear = Math.min(start + 0.35, 99.9);
    return `@keyframes l${i}{0%,${start.toFixed(2)}%{opacity:0}${appear.toFixed(
      2,
    )}%,100%{opacity:1}}`;
  })
  .join("");

const rules = timeline
  .map((_, i) => `.l${i}{animation:l${i} ${TOTAL}s steps(1,end) infinite}`)
  .join("");

const texts = timeline
  .map((line, i) => {
    if (plain(line.text) === "") return "";
    const style = KIND[line.kind];
    const y = PAD_TOP + i * LINE_H;
    const italic = style.italic ? ' font-style="italic"' : "";
    // A segmented line becomes tspans so one row can carry several colours —
    // matching how the CLI paints the ✗, the key and the type differently.
    const body = Array.isArray(line.text)
      ? line.text
          .map(([kind, text]) => {
            const s = KIND[kind];
            const weight = s.weight === 400 ? "" : ` font-weight="${s.weight}"`;
            return `<tspan fill="${s.fill}"${weight}>${escape(text)}</tspan>`;
          })
          .join("")
      : escape(line.text);
    // xml:space="preserve" is load-bearing: SVG collapses leading and repeated
    // spaces by default, which would destroy the report's column alignment and
    // leave the "↑ secret" annotation pointing at nothing.
    return `<text class="l${i}" xml:space="preserve" x="${PAD_X}" y="${y}" fill="${style.fill}" font-weight="${style.weight}"${italic}>${body}</text>`;
  })
  .filter(Boolean)
  .join("\n  ");

// The cursor trails the last line, blinking, so the card never looks frozen.
const cursorY = PAD_TOP + timeline.length * LINE_H - LINE_H + 4;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace" font-size="${FONT_SIZE}">
  <title>prahari — a failing boot report, then CI catching .env.example drift</title>
  <desc>Terminal recording: "prahari doctor" reports three invalid environment variables with the secret redacted, then "prahari sync" reports that .env.example has drifted from the schema and exits 1.</desc>
  <style>
    ${keyframes}
    ${rules}
    @keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
    .cursor{animation:blink 1.1s steps(1,end) infinite}
    @media (prefers-reduced-motion: reduce){
      text{animation:none!important;opacity:1!important}
      .cursor{animation:none!important}
    }
  </style>
  <rect width="${WIDTH}" height="${HEIGHT}" rx="10" fill="${C.bg}" stroke="${C.border}"/>
  <g transform="translate(20,22)">
    <circle r="6" fill="#FF5F57"/><circle cx="19" r="6" fill="#FEBC2E"/><circle cx="38" r="6" fill="#28C840"/>
  </g>
  <text x="${WIDTH / 2}" y="27" fill="${C.dim}" font-size="12" text-anchor="middle">prahari</text>
  <line x1="0" y1="38" x2="${WIDTH}" y2="38" stroke="${C.border}"/>
  ${texts}
  <rect class="cursor" x="${PAD_X}" y="${cursorY}" width="8" height="15" fill="${C.prompt}" opacity="0.8"/>
</svg>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
console.log(`wrote ${OUT} (${WIDTH}×${HEIGHT}, ${TOTAL}s loop, ${svg.length} bytes)`);

/*
FIXTURE — how the captured output was produced:

  // env.ts
  export const env = defineEnv({
    NODE_ENV: oneOf(["development", "production", "test"]).default("development"),
    PORT: port().default(3000),
    DATABASE_URL: url().desc("Postgres connection string"),
    STRIPE_KEY: str().secret().startsWith("sk_"),
    SENTRY_DSN: url().requiredIn("production"),
  });

  // .env.example  (deliberately stale — missing STRIPE_KEY and SENTRY_DSN)
  NODE_ENV=development
  PORT=3000
  DATABASE_URL=

  $ DATABASE_URL=postgres PORT=99999 STRIPE_KEY=pk_live_x prahari doctor
  $ prahari sync
*/
