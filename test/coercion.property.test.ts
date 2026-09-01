import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { str, num, port, bool, url, json, oneOf, isEnvFieldError } from "../src/index";

/**
 * Property-based coverage for coercion (issue #7). The example-based matrix in
 * coercion.test.ts pins specific cases; these throw thousands of random inputs
 * at each validator and assert the *invariants* hold — a failing case a
 * hand-written table would miss is reported as a shrunk counterexample.
 */

const TRUTHY = new Set(["1", "true", "yes", "on"]);
const FALSEY = new Set(["0", "false", "no", "off"]);

describe("property: coercion invariants", () => {
  it("num() returns a finite number equal to Number(trimmed), or throws EnvFieldError", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        let v: number;
        try {
          v = num().parse(s);
        } catch (e) {
          expect(isEnvFieldError(e)).toBe(true);
          return;
        }
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBe(Number(s.trim()));
      }),
    );
  });

  it("port() only ever yields an integer in [1, 65535]", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        let v: number;
        try {
          v = port().parse(s);
        } catch (e) {
          expect(isEnvFieldError(e)).toBe(true);
          return;
        }
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(65535);
      }),
    );
  });

  it("bool() only accepts the truthy/falsey token sets", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        let v: boolean;
        try {
          v = bool().parse(s);
        } catch (e) {
          expect(isEnvFieldError(e)).toBe(true);
          return;
        }
        const norm = s.trim().toLowerCase();
        expect(typeof v).toBe("boolean");
        expect(v ? TRUTHY.has(norm) : FALSEY.has(norm)).toBe(true);
      }),
    );
  });

  it("url() only returns strings that re-parse as a URL", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        let v: string;
        try {
          v = url().parse(s);
        } catch (e) {
          expect(isEnvFieldError(e)).toBe(true);
          return;
        }
        expect(() => new URL(v)).not.toThrow();
      }),
    );
  });

  it("json() returns exactly JSON.parse(raw), or throws EnvFieldError", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        let v: unknown;
        try {
          v = json().parse(s);
        } catch (e) {
          expect(isEnvFieldError(e)).toBe(true);
          return;
        }
        expect(v).toStrictEqual(JSON.parse(s));
      }),
    );
  });

  it("no validator ever throws anything other than EnvFieldError", () => {
    const validators = [str(), num(), port(), bool(), url(), json(), oneOf(["a", "b"])];
    fc.assert(
      fc.property(fc.constantFrom(...validators), fc.string(), (v, s) => {
        try {
          v.parse(s);
        } catch (e) {
          expect(isEnvFieldError(e)).toBe(true);
        }
      }),
    );
  });
});

describe("property: round-trips", () => {
  it("port() round-trips every valid port number", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 65535 }), (n) => {
        expect(port().parse(String(n))).toBe(n);
      }),
    );
  });

  it("num() round-trips every finite number", () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }).filter((n) => !Object.is(n, -0)),
        (n) => {
          expect(num().parse(String(n))).toBe(n);
        },
      ),
    );
  });

  it("bool() accepts every token in either set, any casing or padding", () => {
    fc.assert(
      fc.property(fc.constantFrom(...TRUTHY, ...FALSEY), fc.boolean(), (token, upper) => {
        const raw = `  ${upper ? token.toUpperCase() : token}  `;
        expect(bool().parse(raw)).toBe(TRUTHY.has(token));
      }),
    );
  });
});
