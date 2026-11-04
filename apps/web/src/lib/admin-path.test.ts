import { describe, expect, it } from "vitest";
import { isAdminPath } from "./admin-path";

describe("isAdminPath", () => {
  it("matches the admin area and everything under it", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/settings")).toBe(true);
    expect(isAdminPath("/admin/templates/soccer")).toBe(true);
  });

  it("doesn't match lookalike paths", () => {
    expect(isAdminPath("/administrator")).toBe(false);
    expect(isAdminPath("/admins")).toBe(false);
    expect(isAdminPath("/")).toBe(false);
    expect(isAdminPath("/sign-in")).toBe(false);
  });
});
