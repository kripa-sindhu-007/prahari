import { afterEach, describe, expect, it } from "vitest";

import { colorEnabled, green } from "../src/cli/ui";

const saved = { NO_COLOR: process.env.NO_COLOR, FORCE_COLOR: process.env.FORCE_COLOR };

afterEach(() => {
  process.env.NO_COLOR = saved.NO_COLOR;
  process.env.FORCE_COLOR = saved.FORCE_COLOR;
  if (saved.NO_COLOR === undefined) delete process.env.NO_COLOR;
  if (saved.FORCE_COLOR === undefined) delete process.env.FORCE_COLOR;
});

describe("ui color", () => {
  it("wraps in ANSI when FORCE_COLOR is set", () => {
    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR = "1";
    expect(colorEnabled()).toBe(true);
    expect(green("x")).toBe("\x1b[32mx\x1b[0m");
  });
  it("emits plain text when NO_COLOR is set", () => {
    process.env.NO_COLOR = "1";
    delete process.env.FORCE_COLOR;
    expect(colorEnabled()).toBe(false);
    expect(green("x")).toBe("x");
  });
});
