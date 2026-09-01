/**
 * Shared server/client-boundary core for the framework adapters
 * (`prahari/next`, `prahari/vite`, …).
 *
 * Bundlers (Next, Vite) inline ONLY prefixed variables — referenced statically
 * — into the client bundle; everything else is `undefined` on the client. That
 * silent `undefined` is where secrets leak and client vars vanish. This core
 * makes the split explicit:
 *
 *   - `client` keys MUST carry the public prefix; `server` keys must NOT (a
 *     prefixed server key would be inlined = a leak);
 *   - on the server both groups validate; on the client only client vars do
 *     (server values aren't present there to validate);
 *   - the returned object throws with a clear message if a server-only var is
 *     read on the client.
 *
 * Each adapter is a thin wrapper that supplies the bundler's real prefix
 * default (`NEXT_PUBLIC_`, `VITE_`, …) and an `adapter` label for errors.
 */

import { defineEnv } from "./core.js";
import type { EnvSchema, InferEnv } from "./validators.js";

export interface ClientServerEnvOptions<
  Server extends EnvSchema,
  Client extends EnvSchema,
> {
  /** Server-only variables. Never exposed to the browser. */
  server?: Server;
  /** Browser-exposed variables. Every key must carry the client prefix. */
  client?: Client;
  /**
   * Explicit runtime values, referenced statically so the bundler inlines the
   * public ones into the client bundle. A dynamic lookup would never reach the
   * browser.
   */
  runtimeEnv: Record<string, string | undefined>;
  /** Prefix client vars must carry (e.g. `NEXT_PUBLIC_`, `VITE_`). */
  clientPrefix: string;
  /**
   * Override server/client detection. Defaults to `typeof window === "undefined"`.
   * Exposed mainly for testing the client path without a real browser.
   */
  isServer?: boolean;
  /** Adapter label used in error messages, e.g. `prahari/next`. */
  adapter: string;
}

/**
 * Validate a client/server-split environment with an enforced boundary. Returns
 * a frozen, fully-typed object (server keys ∪ client keys); reading a server key
 * on the client throws. Shared by every framework adapter.
 */
export function defineClientServerEnv<
  Server extends EnvSchema,
  Client extends EnvSchema,
>(
  options: ClientServerEnvOptions<Server, Client>,
): Readonly<InferEnv<Server> & InferEnv<Client>> {
  const { clientPrefix: prefix, adapter } = options;
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
        `${adapter}: client variable "${key}" must start with "${prefix}" ` +
          `so it is exposed to the browser. Rename it, or move it to \`server\`.`,
      );
    }
  }
  for (const key of Object.keys(server)) {
    if (key.startsWith(prefix)) {
      throw new Error(
        `${adapter}: server variable "${key}" must NOT start with "${prefix}" — ` +
          `it would be inlined into the client bundle, leaking it. Move it to \`client\`.`,
      );
    }
  }

  // --- Validate. On the client, server values aren't present, so validate only
  //     the client group (validating absent server vars would throw in the
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
          `${adapter}: attempted to read server-only variable "${prop}" on the client. ` +
            `Server variables are never sent to the browser — read it in server code, ` +
            `or expose a "${prefix}${prop}" client variable instead.`,
        );
      }
      return Reflect.get(target, prop);
    },
  });

  return guarded as Readonly<InferEnv<Server> & InferEnv<Client>>;
}
