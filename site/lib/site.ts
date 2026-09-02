export const site = {
  name: "prahari",
  tagline: "The sentinel for your environment config.",
  devanagari: "प्रहरी",
  url: "https://prahari-azure.vercel.app",
  repo: "https://github.com/kripa-sindhu-007/prahari",
  npm: "https://www.npmjs.com/package/prahari",
  install: "npm i prahari",
  version: "1.0.0",
};

export type Validator = {
  name: string;
  type: string;
  notes: string;
};

export const validators: Validator[] = [
  { name: "str()", type: "string", notes: ".min .max .startsWith .matches" },
  { name: "num()", type: "number", notes: ".int .min .max" },
  { name: "port()", type: "number", notes: "integer, 1–65535" },
  { name: "bool()", type: "boolean", notes: "1|true|yes|on / 0|false|no|off" },
  { name: "url()", type: "string", notes: "valid URL, .protocol(\"https\")" },
  { name: "oneOf([…])", type: "union", notes: "narrows to the literal union" },
  { name: "json<T>()", type: "T", notes: "JSON.parse into a typed shape" },
  { name: "list()", type: "T[]", notes: "\"a,b,c\" → array; .of(port()) types the items" },
  { name: "duration()", type: "number", notes: "\"30s\" \"2h\" → milliseconds" },
  { name: "bytes()", type: "number", notes: "\"10mb\" \"64kb\" → bytes" },
  { name: "custom<T>(fn)", type: "T", notes: "your function; throw to fail" },
];

export const modifiers = [
  ".default(value)",
  ".optional()",
  ".desc(text)",
  ".secret()",
  ".deprecated(msg)",
  ".transform(fn)",
  ".requiredIn(\"production\")",
];

export type Feature = {
  icon: string; // lucide icon name key (resolved in component)
  title: string;
  body: string;
};

export const features: Feature[] = [
  {
    icon: "ShieldCheck",
    title: "Fails at boot, not in prod",
    body: "One readable table of everything that's wrong — the process refuses to start instead of crashing later, far from the cause.",
  },
  {
    icon: "Braces",
    title: "Truly type-safe",
    body: "port() → number, oneOf([...]) → a literal union, json<T>() → T. Every value is inferred; your editor knows the shape.",
  },
  {
    icon: "Feather",
    title: "Zero runtime dependencies",
    body: "The import pulls in nothing. Your bundle and your supply chain stay exactly as small as they were.",
  },
  {
    icon: "Blocks",
    title: "Schema-agnostic",
    body: "Bring your own Standard Schema lib — Zod, Valibot, ArkType — or use the built-in validators. No lock-in.",
  },
  {
    icon: "Terminal",
    title: "A CLI nobody else has",
    body: "example, sync, doctor, docs. Your .env.example is generated from the schema and can never silently drift again.",
  },
  {
    icon: "EyeOff",
    title: "Secrets never leak",
    body: "Mark a var .secret() and a bad value shows as received: *** in the failure report — never in your logs.",
  },
];

export type CliCommand = {
  cmd: string;
  blurb: string;
};

export const cliCommands: CliCommand[] = [
  { cmd: "prahari example", blurb: "generate .env.example from your schema (descriptions → comments)" },
  { cmd: "prahari sync", blurb: "report drift between schema and .env.example (exit 1 on drift)" },
  { cmd: "prahari doctor", blurb: "validate the current environment, red/green per variable" },
  { cmd: "prahari docs", blurb: "print a Markdown table of your variables for your README" },
];

export const testingLayers = [
  { n: "1", title: "Unit", body: "validators + the coercion matrix" },
  { n: "2", title: "Integration", body: "defineEnv orchestration" },
  { n: "3", title: "Type-level", body: "expectTypeOf + @ts-expect-error — the inference is the product" },
  { n: "4", title: "E2E", body: "the real dist/cli.js spawned against a fixture" },
  { n: "5", title: "Packaging", body: "publint + attw — exports, ESM+CJS, types resolve, no dep leak" },
];
