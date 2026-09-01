/**
 * `prahari/next` — a Next.js adapter with an enforced server/client boundary.
 *
 * Next.js only inlines `NEXT_PUBLIC_`-prefixed variables (referenced statically
 * as `process.env.NEXT_PUBLIC_X`) into the browser bundle; everything else is
 * server-only and is simply `undefined` on the client. That silent `undefined`
 * is where secrets leak and client vars mysteriously vanish. This adapter makes
 * the split explicit:
 *
 *   - `client` keys MUST carry the public prefix (default `NEXT_PUBLIC_`);
 *   - `server` keys must NOT (a prefixed server key would be inlined = a leak);
 *   - on the server, both groups are validated; on the client, only client vars
 *     are validated (server values aren't there to validate);
 *   - the returned object is a Proxy that THROWS with a clear message if you
 *     read a server-only var on the client — turning a silent `undefined` into
 *     a loud failure.
 *
 * You pass an explicit `runtimeEnv` map (`{ NEXT_PUBLIC_X: process.env.NEXT_PUBLIC_X }`)
 * because Next only inlines *static* `process.env.X` references — a dynamic
 * lookup would never reach the browser. Fields may be prahari built-ins or any
 * Standard Schema validator (Zod / Valibot / ArkType).
 *
 * Works with both the App Router and the Pages Router — the boundary is about
 * where a value is read (server vs browser), not which router serves it.
 */

import { defineEnv } from "../core.js";
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
  const prefix = options.clientPrefix ?? DEFAULT_CLIENT_PREFIX;
  const server = (options.server ?? {}) as EnvSchema;
  const client = (options.client ?? {}) as EnvSchema;
  // `window` isn't in this package's lib (it targets Node), so probe it via
  // globalThis: present only in a browser → we're on the client.
  const isServer =
    options.isServer ??
    typeof (globalThis as { window?: unknown }).window === "undefined";

  // --- Config invariants (always checked; these are developer mistakes) ---
  for (const key of Object.keys(client)) {
    if (!key.startsWith(prefix)) {
      throw new Error(
        `prahari/next: client variable "${key}" must start with "${prefix}" ` +
          `so Next.js exposes it to the browser. Rename it, or move it to \`server\`.`,
      );
    }
  }
  for (const key of Object.keys(server)) {
    if (key.startsWith(prefix)) {
      throw new Error(
        `prahari/next: server variable "${key}" must NOT start with "${prefix}" — ` +
          `Next.js would inline it into the client bundle, leaking it. Move it to \`client\`.`,
      );
    }
  }

  // --- Validate. On the client, server values aren't present, so validate
  //     only the client group (validating absent server vars would throw in the
  //     browser). On the server, validate both. The CLI always runs server-side
  //     (isServer === true), so it registers and introspects the full schema. ---
  const schema: EnvSchema = isServer ? { ...server, ...client } : client;
  const parsed = defineEnv(schema, { source: options.runtimeEnv });

  // --- Boundary guard: reading a server-only key on the client is a loud error,
  //     not a silent `undefined`. ---
  const serverKeys = new Set(Object.keys(server));
  const guarded = new Proxy(parsed as Record<string, unknown>, {
    get(target, prop) {
      if (typeof prop === "string" && !isServer && serverKeys.has(prop)) {
        throw new Error(
          `prahari/next: attempted to read server-only variable "${prop}" on the client. ` +
            `Server variables are never sent to the browser — read it in server code, ` +
            `or expose a "${prefix}${prop}" client variable instead.`,
        );
      }
      return Reflect.get(target, prop);
    },
  });

  return guarded as Readonly<InferEnv<Server> & InferEnv<Client>>;
}
