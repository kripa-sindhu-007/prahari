/**
 * Vite env — one source of truth for server + client variables, with an
 * enforced boundary. Import this `env` everywhere instead of touching
 * `process.env` / `import.meta.env` directly.
 */

import { defineViteEnv } from "prahari/vite";
import { str, url } from "prahari";
import { z } from "zod"; // Standard Schema fields compose too (optional)

export const env = defineViteEnv({
  // Server-only (e.g. read in vite.config, SSR, API routes). Never sent to the
  // browser; reading these on the client throws.
  server: {
    DATABASE_URL: z.url(),
    SESSION_SECRET: str().secret(),
  },

  // Browser-exposed — must carry the VITE_ prefix (Vite's default envPrefix).
  client: {
    VITE_API_URL: url(),
    VITE_SENTRY_DSN: str().optional(),
  },

  // Static references so Vite inlines the VITE_ ones into the client bundle.
  // Server values come from process.env; client values from import.meta.env.
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  },

  // In a Vite SSR app you can be explicit instead of relying on the window probe:
  // isServer: import.meta.env.SSR,
});

/*
 * Usage:
 *
 *   import { env } from "./env";
 *
 *   // Client code (browser):
 *   fetch(env.VITE_API_URL);          // ✅ inlined at build
 *   // console.log(env.SESSION_SECRET);  // ❌ throws: server-only on the client
 *
 *   // Server code (vite.config.ts, SSR entry, API handler):
 *   const db = await connect(env.DATABASE_URL);   // ✅ server var
 */
