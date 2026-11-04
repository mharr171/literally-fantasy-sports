import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./supabase/server", () => ({ createClient: vi.fn() }));

const { summarizeVersions } = await import("./game-config");

const row = (scope: string, version: number, published: boolean) => ({
  scope,
  version,
  note: "",
  createdAt: "2026-11-01T00:00:00Z",
  publishedAt: published ? "2026-11-02T00:00:00Z" : null,
});

describe("summarizeVersions", () => {
  it("marks the newest published version of each sport live, older ones past, and drafts", () => {
    const out = summarizeVersions([
      row("soccer", 1, true),
      row("soccer", 3, false),
      row("soccer", 2, true),
      row("global", 1, true),
    ]);
    expect(out.map((v) => `${v.scope}:${v.version}:${v.status}`)).toEqual([
      "global:1:live",
      "soccer:3:draft",
      "soccer:2:live",
      "soccer:1:past",
    ]);
  });

  it("has no live version when a sport only has drafts", () => {
    expect(summarizeVersions([row("soccer", 1, false)])[0]?.status).toBe(
      "draft",
    );
    expect(summarizeVersions([])).toEqual([]);
  });
});
