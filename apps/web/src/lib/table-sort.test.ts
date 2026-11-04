import { describe, expect, it } from "vitest";
import { nextSort, sortRows } from "./table-sort";

const rows = [
  { name: "Bo", ovr: 60, pot: null },
  { name: "Al", ovr: 70, pot: 80 },
  { name: "Cy", ovr: 60, pot: 75 },
];
const columns = {
  name: (r: (typeof rows)[number]) => r.name,
  ovr: (r: (typeof rows)[number]) => r.ovr,
  pot: (r: (typeof rows)[number]) => r.pot,
};

describe("table sorting (M7)", () => {
  it("sorts numbers and text both ways, keeping ties in order", () => {
    const names = (s: Parameters<typeof sortRows>[1]) =>
      sortRows(rows, s as never, columns).map((r) => r.name);
    expect(names({ key: "ovr", dir: "desc" })).toEqual(["Al", "Bo", "Cy"]);
    expect(names({ key: "ovr", dir: "asc" })).toEqual(["Bo", "Cy", "Al"]);
    expect(names({ key: "name", dir: "asc" })).toEqual(["Al", "Bo", "Cy"]);
  });

  it("always puts missing values last", () => {
    for (const dir of ["asc", "desc"] as const)
      expect(sortRows(rows, { key: "pot", dir }, columns).at(-1)?.name).toBe(
        "Bo",
      );
  });

  it("flips the same column and starts a new one in its own direction", () => {
    const s = { key: "ovr" as const, dir: "desc" as const };
    expect(nextSort(s, "ovr", "desc")).toEqual({ key: "ovr", dir: "asc" });
    expect(nextSort<"ovr" | "name">(s, "name", "asc")).toEqual({
      key: "name",
      dir: "asc",
    });
  });
});
