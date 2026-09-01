/**
 * Bring-your-own-schema example.
 *
 * prahari accepts any Standard Schema validator (Zod / Valibot / ArkType) as a
 * field — on its own or mixed with the built-ins — so you keep one schema
 * library across your app. The built-ins stay the zero-dependency on-ramp.
 *
 * Run it:
 *   PORT=8080 REGION=eu DATABASE_URL=postgres://localhost/app \
 *   API_KEY=sk_live_123 FEATURE_FLAGS='{"beta":true}' \
 *   pnpm tsx examples/standard-schema.ts
 */

import { defineEnv, port, standard } from "prahari";
import { z } from "zod";
import * as v from "valibot";

export const env = defineEnv({
  // Built-in validator — zero-dependency.
  PORT: port().default(3000),

  // Bare Zod — inferred as the literal union "us" | "eu".
  REGION: z.enum(["us", "eu"]),

  // Bare Zod with a format check.
  DATABASE_URL: z.url(),

  // Bare Valibot — string → parsed JSON.
  FEATURE_FLAGS: v.pipe(
    v.string(),
    v.transform((s) => JSON.parse(s) as Record<string, boolean>),
  ),

  // Wrapped Zod: `standard()` attaches prahari metadata so the value is
  // redacted in the boot report and left blank in `.env.example`.
  API_KEY: standard(z.string().startsWith("sk_"), {
    secret: true,
    desc: "Server API key",
  }),
});

// Fully typed. `env.REGION` is "us" | "eu"; `env.PORT` is number; etc.
console.log("Environment validated:", {
  PORT: env.PORT,
  REGION: env.REGION,
  DATABASE_URL: env.DATABASE_URL,
  FEATURE_FLAGS: env.FEATURE_FLAGS,
  API_KEY: "(redacted)",
});
