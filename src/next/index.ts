/**
 * `prahari/next` — a Next.js adapter with an enforced server/client boundary.
 *
 * Next.js only inlines `NEXT_PUBLIC_`-prefixed variables (referenced statically
 * as `process.env.NEXT_PUBLIC_X`) into the browser bundle; everything else is
 * server-only and simply `undefined` on the client. This adapter makes the
 * split explicit: client keys must carry the prefix, server keys must not, and
 * reading a server-only var on the client throws instead of silently returning
 * `undefined`. Fields may be prahari built-ins or any Standard Schema validator.
 *
 * A thin wrapper over the shared `defineClientServerEnv` core. Works with both
 * the App Router and the Pages Router — the boundary is about where a value is
 * read (server vs browser), not which router serves it.
 */

import { defineClientServerEnv } from "../adapter.js";
import type { EnvSchema, InferEnv } from "../validators.js";

const DEFAULT_CLIENT_PREFIX = "NEXT_PUBLIC_";

export interface DefineNextEnvOptions<
  Server extends EnvSchema,
  Client extends EnvSchema,
> {
  /** Server-only variables. Never exposed to the browser. */
  server?: Server;
  /** Browser-exposed variables. Every key must carry the client prefix. */
  client?: Client;
  /**
   * Explicit runtime values, e.g. `{ DATABASE_URL: process.env.DATABASE_URL,
   * NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL }`. Required because
   * Next only inlines *static* `process.env.X` references into the client
   * bundle — a dynamic read would be `undefined` in the browser.
   */
  runtimeEnv: Record<string, string | undefined>;
  /** Prefix client vars must carry. Defaults to `NEXT_PUBLIC_` (what Next inlines). */
  clientPrefix?: string;
  /**
   * Override server/client detection. Defaults to `typeof window === "undefined"`.
   * Exposed mainly for testing the client path without a real browser.
   */
  isServer?: boolean;
}

/**
 * Validate a Next.js app's environment with an enforced server/client split.
 * Returns a frozen, fully-typed object (server keys ∪ client keys); reading a
 * server key on the client throws.
 */
export function defineNextEnv<
  Server extends EnvSchema = Record<string, never>,
  Client extends EnvSchema = Record<string, never>,
>(
  options: DefineNextEnvOptions<Server, Client>,
): Readonly<InferEnv<Server> & InferEnv<Client>> {
  return defineClientServerEnv<Server, Client>({
    server: options.server,
    client: options.client,
    runtimeEnv: options.runtimeEnv,
    clientPrefix: options.clientPrefix ?? DEFAULT_CLIENT_PREFIX,
    isServer: options.isServer,
    adapter: "prahari/next",
  });
}
