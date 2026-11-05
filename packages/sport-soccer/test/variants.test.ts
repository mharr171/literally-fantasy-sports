import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { generateAiTeam } from "../src/ai-team";
import {
  DEFAULT_GENERATION_SETTINGS,
  type GenerationSettings,
  generatePlayer,
} from "../src/generation";
import { simulateMatch } from "../src/match";
import { squadToTeam } from "../src/matchday";
import { POSITIONS, type Position } from "../src/positions";
import {
  BOUGHT_TIERS,
  PACK_FOCUSES,
  packContents,
  starterPackPlan,
} from "../src/roster";
import { youthIntake } from "../src/season-end";
import {
  defaultStoredTemplates,
  ENABLED_VARIANTS_KEY,
  enabledVariantsFromValues,
  generationSettingsFromValues,
  soccerConfigFromValues,
  type TemplateGrid,
  unpublishedVariantPositions,
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

describe("every new player gets enabled variants (D132, D136)", () => {
  // Two enabled variants for every position.
  const enabled = Object.fromEntries(
    POSITIONS.map((p) => [p, [`${p.toLowerCase()}-a`, `${p.toLowerCase()}-b`]]),
  ) as Record<Position, string[]>;
  const withDefaults = (
    s: Partial<GenerationSettings>,
  ): GenerationSettings => ({
    ...DEFAULT_GENERATION_SETTINGS,
    ...s,
  });

  const check = (players: ReturnType<typeof youthIntake>) => {
    expect(players.length).toBeGreaterThan(0);
    for (const p of players) {
      expect(enabled[p.primaryPosition]).toContain(p.templateVariant);
      if (p.secondaryPosition)
        expect(enabled[p.secondaryPosition]).toContain(
          p.secondaryTemplateVariant,
        );
      else expect(p.secondaryTemplateVariant).toBe("default");
    }
  };
  const live = withDefaults({ templateVariants: enabled });

  it("covers starter packs (and so AI clubs, which open the same packs)", () => {
    const plan = starterPackPlan();
    const players = plan.flatMap((pack, i) =>
      packContents(`starter-${i}`, pack.focus, pack.tier, live),
    );
    check(players);
    expect(players.some((p) => p.secondaryPosition)).toBe(true);
  });

  it("covers bought packs of every tier and focus", () => {
    check(
      BOUGHT_TIERS.flatMap((tier) =>
        PACK_FOCUSES.flatMap((focus) =>
          packContents(`bought-${tier.id}-${focus}`, focus, tier.id, live),
        ),
      ),
    );
  });

  it("covers the youth intake", () => {
    check(youthIntake("youth-seed", undefined, live));
  });

  it("gives the default where a position has no variants enabled", () => {
    const none = withDefaults({});
    for (const p of youthIntake("youth-seed", undefined, none)) {
      expect(p.templateVariant).toBe("default");
      expect(p.secondaryTemplateVariant).toBe("default");
    }
  });

  it("never changes anything else about a player", () => {
    // Pack seeds are regenerated when opened, so adding the second roll must
    // leave every other part of an existing pack's players as it was.
    const before = youthIntake("same-seed", undefined, withDefaults({}));
    const after = youthIntake("same-seed", undefined, live);
    const strip = (p: (typeof before)[number]) => {
      const { templateVariant, secondaryTemplateVariant, ...rest } = p;
      return rest;
    };
    expect(after.map(strip)).toEqual(before.map(strip));
    // Changing the enabled lists changes only the variant picks.
    const otherSecondary = withDefaults({
      templateVariants: Object.fromEntries(
        POSITIONS.map((p) => [p, [...enabled[p], "extra"]]),
      ),
    });
    const a = after;
    const b = youthIntake("same-seed", undefined, otherSecondary);
    expect(b.map(strip)).toEqual(a.map(strip));
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

  it("uses a player's second variant at their secondary position (D136)", () => {
    const values = Object.fromEntries(
      variantsToRows(
        { ST: { poacher: band(22, 25) } },
        { ST: ["poacher"] },
      ).map((r) => [r.key, r.value]),
    );
    const config = soccerConfigFromValues("test", values);
    const home = generateAiTeam(createRng("vh"), 1500, "h");
    const away = generateAiTeam(createRng("va"), 1500, "a");
    // The strikers become wingers who can also play up front.
    const map = (t: typeof home, variant?: string) =>
      new Map(
        t.players.map((p) => [
          p.id,
          p.primaryPosition === "ST"
            ? {
                ...p,
                primaryPosition: "LW" as const,
                secondaryPosition: "ST" as const,
                templateVariant: "poacher",
                secondaryTemplateVariant: variant ?? "default",
              }
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
    // The primary variant ("poacher" as a winger) doesn't apply up front.
    expect(attackShare("poacher")).toBeGreaterThan(attackShare());
  });

  it("keeps the default templates when a version has no variants", () => {
    expect(soccerConfigFromValues("x", {}).variants).toEqual({});
    expect(defaultStoredTemplates().ST).toHaveLength(25);
  });
});

describe("unpublished variant warning (D132)", () => {
  it("lists positions whose ticked templates aren't live yet", () => {
    expect(unpublishedVariantPositions({}, {})).toEqual([]);
    // Nothing ticked is the same as ticking just the default.
    expect(unpublishedVariantPositions({ ST: ["default"] }, {})).toEqual([]);
    // Order and repeats don't matter.
    expect(
      unpublishedVariantPositions(
        { ST: ["poacher", "default", "poacher"] },
        { ST: ["default", "poacher"] },
      ),
    ).toEqual([]);
    expect(
      unpublishedVariantPositions(
        { ST: ["poacher"], CB: ["stopper"] },
        { ST: ["default"] },
      ),
    ).toEqual(["CB", "ST"]);
  });
});
