import { describe, expect, it } from "vitest";
import { adminNextPath, isAdminPath } from "./admin-path";

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

describe("adminNextPath (M5)", () => {
  it("returns to the admin page the admin was heading for", () => {
    expect(adminNextPath("/admin/balance")).toBe("/admin/balance");
    expect(adminNextPath("/admin")).toBe("/admin");
  });

  it("falls back to the overview for anything else", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "/admin/security",
      "/team",
      "https://evil.example/admin",
      "//evil.example/admin",
      "/admin/../team",
      "/admin/x?y=1",
    ])
      expect(adminNextPath(bad)).toBe("/admin");
  });
});
