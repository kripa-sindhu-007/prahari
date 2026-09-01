/**
 * `prahari/vite` — a Vite adapter with an enforced server/client boundary.
 *
 * Vite exposes only `VITE_`-prefixed variables to client source code via
 * `import.meta.env.VITE_X`, statically replaced at build time; everything else
 * lives on the server (`process.env`) and is `undefined` in the browser. This
 * adapter makes the split explicit: client keys must carry the prefix, server
 * keys must not, and reading a server-only var on the client throws instead of
 * silently returning `undefined`. Fields may be prahari built-ins or any
 * Standard Schema validator.
 *
 * A thin wrapper over the shared `defineClientServerEnv` core (same logic as the
 * Next adapter, with Vite's `VITE_` prefix). You supply `runtimeEnv` with static
 * references — `import.meta.env.VITE_X` for client vars, `process.env.X` for
 * server vars — so Vite inlines the public ones into the client bundle. The
 * adapter never touches `import.meta` itself (that keeps it usable from the CJS
 * build); the static references live in your app's `runtimeEnv`.
 */

import { defineClientServerEnv } from "../adapter.js";
import type { EnvSchema, InferEnv } from "../validators.js";

const DEFAULT_CLIENT_PREFIX = "VITE_";

export interface DefineViteEnvOptions<
  Server extends EnvSchema,
  Client extends EnvSchema,
> {
  /** Server-only variables (e.g. read from `process.env`). Never sent to the browser. */
  server?: Server;
  /** Browser-exposed variables. Every key must carry the client prefix. */
  client?: Client;
  /**
   * Explicit runtime values, e.g. `{ DATABASE_URL: process.env.DATABASE_URL,
   * VITE_API_URL: import.meta.env.VITE_API_URL }`. Required because Vite only
   * inlines *static* `import.meta.env.VITE_X` references into the client bundle.
   */
  runtimeEnv: Record<string, string | undefined>;
  /** Prefix client vars must carry. Defaults to `VITE_` (Vite's default `envPrefix`). */
  clientPrefix?: string;
  /**
   * Override server/client detection. Defaults to `typeof window === "undefined"`.
   * In a Vite SSR app you can pass `import.meta.env.SSR`. Also handy for testing.
   */
  isServer?: boolean;
}

/**
 * Validate a Vite app's environment with an enforced server/client split.
 * Returns a frozen, fully-typed object (server keys ∪ client keys); reading a
 * server key on the client throws.
 */
export function defineViteEnv<
  Server extends EnvSchema = Record<string, never>,
  Client extends EnvSchema = Record<string, never>,
>(
  options: DefineViteEnvOptions<Server, Client>,
): Readonly<InferEnv<Server> & InferEnv<Client>> {
  return defineClientServerEnv<Server, Client>({
    server: options.server,
    client: options.client,
    runtimeEnv: options.runtimeEnv,
    clientPrefix: options.clientPrefix ?? DEFAULT_CLIENT_PREFIX,
    isServer: options.isServer,
    adapter: "prahari/vite",
  });
}
