/**
 * Next.js env — one source of truth for server + client variables, with an
 * enforced boundary. Import this `env` everywhere instead of `process.env`.
 *
 * Works for both the App Router and the Pages Router (see usage below).
 */

import { defineNextEnv } from "prahari/next";
import { str, url } from "prahari";
import { z } from "zod"; // Standard Schema fields compose too (optional)

export const env = defineNextEnv({
  // Server-only — never sent to the browser. Reading these on the client throws.
  server: {
    DATABASE_URL: z.url(),
    STRIPE_SECRET_KEY: str().secret().startsWith("sk_"),
  },

  // Browser-exposed — must carry the NEXT_PUBLIC_ prefix (what Next inlines).
  client: {
    NEXT_PUBLIC_API_URL: url(),
    NEXT_PUBLIC_ANALYTICS_ID: str().optional(),
  },

  // Explicit, STATIC references so Next inlines the NEXT_PUBLIC_ ones into the
  // client bundle. A dynamic `process.env[key]` would never reach the browser.
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_ANALYTICS_ID: process.env.NEXT_PUBLIC_ANALYTICS_ID,
  },
});

/*
 * ── App Router ──────────────────────────────────────────────────────────────
 *
 * // app/page.tsx  (Server Component — full access)
 * import { env } from "@/env";
 * export default async function Page() {
 *   const db = await connect(env.DATABASE_URL);   // ✅ server var, server code
 *   return <main data-api={env.NEXT_PUBLIC_API_URL}>…</main>;
 * }
 *
 * // app/widget.tsx  ("use client" — client vars only)
 * "use client";
 * import { env } from "@/env";
 * export function Widget() {
 *   fetch(env.NEXT_PUBLIC_API_URL);   // ✅ client var
 *   // console.log(env.STRIPE_SECRET_KEY); // ❌ throws: server-only on the client
 *   return null;
 * }
 *
 * ── Pages Router ─────────────────────────────────────────────────────────────
 *
 * // pages/index.tsx
 * import { env } from "@/env";
 * export const getServerSideProps = async () => {
 *   const db = await connect(env.DATABASE_URL);   // ✅ server var, runs on server
 *   return { props: {} };
 * };
 * export default function Home() {
 *   fetch(env.NEXT_PUBLIC_API_URL);   // ✅ client var, inlined at build
 *   return null;
 * }
 */
