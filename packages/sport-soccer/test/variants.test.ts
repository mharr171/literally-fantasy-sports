import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { generateAiTeam } from "../src/ai-team";
import { generatePlayer } from "../src/generation";
import { simulateMatch } from "../src/match";
import { squadToTeam } from "../src/matchday";
import {
  defaultStoredTemplates,
  ENABLED_VARIANTS_KEY,
  enabledVariantsFromValues,
  generationSettingsFromValues,
  soccerConfigFromValues,
  type TemplateGrid,
  variantNameError,
  variantsFromValues,
  variantsKey,
  variantsToRows,
} from "../src/stored-config";

/** A grid with all its weight in the given rows. */
const band = (from: number, to: number): TemplateGrid =>
  Array.from({ length: 25 }, (_, r) =>
    Array.from({ length: 17 }, () => (r >= from && r < to ? 1 : 0)),
  );

describe("variant storage (D82)", () => {
  const stVariants = { poacher: band(20, 25), dropping: band(10, 18) };

  it("round-trips named variants and the enabled lists", () => {
    const rows = variantsToRows(
      { ST: stVariants },
      { ST: ["default", "poacher", "ghost"] },
    );
    const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    expect(Object.keys(variantsFromValues(values))).toEqual(["ST"]);
    expect(Object.keys(variantsFromValues(values).ST ?? {})).toEqual([
      "poacher",
      "dropping",
    ]);
    // Unknown names ("ghost") are dropped from the enabled list.
    expect(enabledVariantsFromValues(values)).toEqual({
      ST: ["default", "poacher"],
    });
    const saved = (values[variantsKey("ST")] as Record<string, TemplateGrid>)
      .poacher as TemplateGrid;
    expect(saved.flat().reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(values[ENABLED_VARIANTS_KEY]).toBeDefined();
  });

  it("checks names and grids", () => {
    expect(variantNameError("poacher")).toBeNull();
    expect(variantNameError("default")).toMatch(/taken/);
    expect(variantNameError("Big Man")).toMatch(/lowercase/);
    expect(() =>
      variantsToRows({ ST: { "Bad Name": band(0, 5) } }, {}),
    ).toThrow(/lowercase/);
    expect(() => variantsToRows({ ST: { empty: band(0, 0) } }, {})).toThrow(
      /empty/,
    );
  });

  it("gives new players one of the enabled templates", () => {
    const values = Object.fromEntries(
      variantsToRows({ ST: stVariants }, { ST: ["poacher", "dropping"] }).map(
        (r) => [r.key, r.value],
      ),
    );
    const settings = generationSettingsFromValues(values);
    const seen = new Set(
      Array.from(
        { length: 40 },
        (_, i) =>
          generatePlayer(createRng(`v${i}`), {
            position: "ST",
            overall: 60,
            settings,
          }).templateVariant,
      ),
    );
    expect(seen).toEqual(new Set(["poacher", "dropping"]));
    // Other positions, and versions with nothing enabled, use the default.
    expect(
      generatePlayer(createRng("cb"), { position: "CB", overall: 60, settings })
        .templateVariant,
    ).toBe("default");
    expect(generationSettingsFromValues({}).templateVariants).toBeUndefined();
  });
});

describe("variants in matches (D84)", () => {
  it("lets a player's variant change where they have influence", () => {
    const values = Object.fromEntries(
      variantsToRows(
        { ST: { poacher: band(22, 25) } },
        { ST: ["poacher"] },
      ).map((r) => [r.key, r.value]),
    );
    const config = soccerConfigFromValues("test", values);
    expect(config.variants?.ST?.poacher).toBeDefined();
    const home = generateAiTeam(createRng("vh"), 1500, "h");
    const away = generateAiTeam(createRng("va"), 1500, "a");
    const map = (t: typeof home, variant?: string) =>
      new Map(
        t.players.map((p) => [
          p.id,
          p.primaryPosition === "ST" && variant
            ? { ...p, templateVariant: variant }
            : p,
        ]),
      );
    const attackShare = (variant?: string) => {
      const { influence } = simulateMatch(
        {
          home: squadToTeam("h", home.squad, map(home, variant)),
          away: squadToTeam("a", away.squad, map(away)),
          mode: "league",
          config,
        },
        "variant-match",
      );
      const v = influence.home.values;
      let top = 0;
      let all = 0;
      for (let i = 0; i < v.length; i++) {
        all += v[i] as number;
        if (i >= 22 * 17) top += v[i] as number;
      }
      return top / all;
    };
    expect(attackShare("poacher")).toBeGreaterThan(attackShare());
    // An unknown variant just uses the default template.
    expect(attackShare("nope")).toBeCloseTo(attackShare(), 10);
  });

  it("keeps the default templates when a version has no variants", () => {
    expect(soccerConfigFromValues("x", {}).variants).toEqual({});
    expect(defaultStoredTemplates().ST).toHaveLength(25);
  });
});
