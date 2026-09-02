import { describe, it, expect, beforeEach } from "vitest";

import { bytes, defineEnv, duration } from "../src/index";
import { describeField } from "../src/validators";
import { clearRegistry } from "../src/registry";

/** #28 — env-shaped coercions: `30s` → ms, `10mb` → bytes. */

beforeEach(() => {
  clearRegistry();
  delete process.env.PRAHARI_SKIP_VALIDATION;
});

describe("duration()", () => {
  it.each([
    ["500ms", 500],
    ["30s", 30_000],
    ["5m", 300_000],
    ["2h", 7_200_000],
    ["1d", 86_400_000],
    ["1.5s", 1500],
    ["0s", 0],
  ])("parses %s → %i ms", (raw, expected) => {
    expect(duration().parse(raw)).toBe(expected);
  });

  it("treats a bare number as milliseconds", () => {
    expect(duration().parse("250")).toBe(250);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(duration().parse(" 30S ")).toBe(30_000);
  });

  it.each(["abc", "30x", "s", "-5s", "30 s 40", "", " "])(
    "rejects %o",
    (raw) => {
      expect(() => duration().parse(raw === "" ? " " : raw)).toThrow();
    },
  );

  it("explains itself when rejecting", () => {
    expect(() => duration().parse("soon")).toThrow(
      /must be a duration like 30s, 500ms, 2h or 1d/,
    );
  });

  it("composes with the number checks", () => {
    expect(() => duration().max(1000).parse("30s")).toThrow(/must be <= 1000/);
    expect(duration().min(1000).parse("30s")).toBe(30_000);
  });

  it("is typed as a number and renders a duration placeholder", () => {
    const env = defineEnv({ TIMEOUT: duration().default(5000) }, { source: { TIMEOUT: "30s" } });
    const ms: number = env.TIMEOUT;
    expect(ms).toBe(30_000);
    expect(describeField(duration()).typeName).toBe("duration");
    expect(describeField(duration()).exampleValue()).toBe("30s");
  });
});

describe("bytes()", () => {
  it.each([
    ["512b", 512],
    ["64kb", 65_536],
    ["10mb", 10_485_760],
    ["2gb", 2_147_483_648],
    ["1tb", 1_099_511_627_776],
    ["1.5kb", 1536],
  ])("parses %s → %i bytes", (raw, expected) => {
    expect(bytes().parse(raw)).toBe(expected);
  });

  it("treats kb/mb/gb as powers of 1024, same as kib/mib/gib", () => {
    // Documented deviation from SI: this is what config files mean.
    expect(bytes().parse("10mb")).toBe(bytes().parse("10mib"));
    expect(bytes().parse("1kb")).toBe(1024);
  });

  it("treats a bare number as bytes", () => {
    expect(bytes().parse("4096")).toBe(4096);
  });

  it.each(["abc", "10pb", "mb", "-1mb", "10 mb x"])("rejects %o", (raw) => {
    expect(() => bytes().parse(raw)).toThrow();
  });

  it("explains itself when rejecting", () => {
    expect(() => bytes().parse("huge")).toThrow(/must be a size like 512b, 64kb, 10mb or 2gb/);
  });

  it("composes with the number checks", () => {
    expect(() => bytes().max(1_048_576).parse("10mb")).toThrow(/must be <= 1048576/);
  });

  it("is typed as a number and renders a size placeholder", () => {
    const env = defineEnv({ MAX_UPLOAD: bytes() }, { source: { MAX_UPLOAD: "10mb" } });
    const size: number = env.MAX_UPLOAD;
    expect(size).toBe(10_485_760);
    expect(describeField(bytes()).typeName).toBe("bytes");
    expect(describeField(bytes()).exampleValue()).toBe("10mb");
  });
});
