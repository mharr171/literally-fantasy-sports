import { describe, expect, it } from "vitest";
import { getPath, withPaths } from "../src/settings";

describe("setting paths (ADR 0007 §7)", () => {
  it("reads numbers at dotted paths", () => {
    const s = { a: { b: { c: 3 } }, d: 1 };
    expect(getPath(s, "a.b.c")).toBe(3);
    expect(getPath(s, "d")).toBe(1);
    expect(getPath(s, "a.x.c")).toBeUndefined();
    expect(getPath(null, "a")).toBeUndefined();
  });

  it("sets paths on a copy, creating objects on the way", () => {
    const s = { a: { b: 1 }, keep: [1, 2] };
    const t = withPaths(s, { "a.b": 2, "n.m": 5 });
    expect(t).toEqual({ a: { b: 2 }, keep: [1, 2], n: { m: 5 } });
    expect(s.a.b).toBe(1);
  });
});
