/**
 * Baseball's balance settings (ADR 0008 §9, ADR 0007 §7): every number the
 * admin balance editor shows, as dotted paths into `BaseballConfig`, with
 * limits. They're stored in versioned `game_config` rows under the
 * `baseball` scope, one key per path; a season plays by the version it
 * started with, and the built-in defaults apply until a version is
 * published.
 */
import {
  BOUGHT_TIERS,
  getPath,
  type Limit,
  type SettingGroup,
  withPaths,
} from "@lfs/core";
import { type BaseballConfig, defaultBaseballConfig } from "./game";

const share = (label: string, help?: string): Limit => ({
  label,
  ...(help ? { help } : {}),
  min: 0,
  max: 1,
});
const per = (label: string, max: number, help?: string): Limit => ({
  label,
  ...(help ? { help } : {}),
  min: 0,
  max,
});
const money = (label: string, help?: string): Limit => ({
  label,
  ...(help ? { help } : {}),
  min: 0,
  max: 100_000,
  integer: true,
});
const PACK_PRICE: Limit = {
  label: "Price",
  min: 500,
  max: 500_000,
  integer: true,
};
const whole = (
  label: string,
  min: number,
  max: number,
  help?: string,
): Limit => ({
  label,
  ...(help ? { help } : {}),
  min,
  max,
  integer: true,
});

export const BASEBALL_SETTING_GROUPS: readonly SettingGroup[] = [
  {
    id: "pitches",
    title: "Pitches",
    columns: 4,
    fields: [
      {
        path: "pitch.missAtZero",
        limit: share(
          "Miss chance at control 0",
          "How often a pitch misses its spot",
        ),
      },
      {
        path: "pitch.missAtHundred",
        limit: share("Miss chance at control 100"),
      },
      { path: "pitch.swingInZone", limit: share("Swings at strikes") },
      { path: "pitch.swingOutOfZone", limit: share("Swings at balls") },
      {
        path: "pitch.eyeEffect",
        limit: per("Eye effect", 0.02, "Per point of eye above 50"),
      },
      { path: "pitch.contactInZone", limit: share("Contact on strikes") },
      { path: "pitch.contactOutOfZone", limit: share("Contact on balls") },
      {
        path: "pitch.contactEffect",
        limit: per(
          "Contact effect",
          0.02,
          "Per point of contact against stuff",
        ),
      },
      { path: "pitch.foulShare", limit: share("Share of contact fouled off") },
    ],
  },
  {
    id: "batted",
    title: "Balls in play",
    columns: 4,
    fields: [
      {
        path: "pitch.powerEffect",
        limit: per("Power effect", 0.05, "Per point of power against velocity"),
      },
      { path: "pitch.hitSpread", limit: per("How much contact varies", 1) },
      {
        path: "pitch.homeRunAt",
        limit: per(
          "Home runs from",
          2,
          "Fly balls hit this hard leave the park",
        ),
      },
      { path: "pitch.outChance.ground", limit: share("Ground balls caught") },
      { path: "pitch.outChance.line", limit: share("Line drives caught") },
      { path: "pitch.outChance.fly", limit: share("Fly balls caught") },
      { path: "pitch.outChance.popup", limit: share("Pop-ups caught") },
      {
        path: "pitch.fieldingEffect",
        limit: per("Fielding effect", 0.02, "Per point of fielding above 50"),
      },
      { path: "pitch.errorRate", limit: share("Error chance on an out") },
    ],
  },
  {
    id: "running",
    title: "Running",
    fields: [
      {
        path: "pitch.extraBase",
        limit: share(
          "Extra base on a hit",
          "When the runner's speed equals the arm",
        ),
      },
      {
        path: "pitch.runnerEffect",
        limit: per("Speed against arm", 0.02, "Per point"),
      },
      { path: "pitch.stealSpeed", limit: whole("Steals from speed", 1, 99) },
      { path: "pitch.stealTry", limit: share("Steal tries per pitch") },
    ],
  },
  {
    id: "pitchers",
    title: "Pitchers and rest",
    columns: 4,
    fields: [
      {
        path: "fatigue.starterBudgetAt40",
        limit: whole("Starter's pitches at stamina 40", 10, 200),
      },
      {
        path: "fatigue.budgetPerStamina",
        limit: per("Extra pitches per stamina point", 5),
      },
      {
        path: "fatigue.relieverShare",
        limit: share("Reliever's share of a starter's budget"),
      },
      {
        path: "fatigue.perPitchPast",
        limit: per("Fade per pitch past the budget", 0.1),
      },
      {
        path: "fatigue.floor",
        limit: share("Lowest a tired pitcher fades to"),
      },
      {
        path: "fatigue.tiredMargin",
        limit: whole("Pulled this far past the budget", 0, 100),
      },
      {
        path: "fatigue.noHitterLeeway",
        limit: whole(
          "No-hitter leeway past the budget",
          0,
          100,
          "A starter throwing a no-hitter stays in until this far past",
        ),
      },
    ],
  },
  {
    id: "bench",
    title: "Bench and injuries",
    columns: 4,
    fields: [
      {
        path: "bench.pinchHitFrom",
        limit: whole("Pinch hitters from inning", 1, 12),
      },
      {
        path: "bench.pinchHitMargin",
        limit: whole("Pinch hitter's Bat edge", 0, 50),
      },
      {
        path: "bench.pinchRunFrom",
        limit: whole("Pinch runners from inning", 1, 12),
      },
      {
        path: "bench.pinchRunMargin",
        limit: whole("Pinch runner's speed edge", 0, 50),
      },
      {
        path: "bench.closeRuns",
        limit: whole("A close game: within runs", 0, 10),
      },
      {
        path: "bench.defenseFrom",
        limit: whole("Defensive replacements from inning", 1, 12),
      },
      {
        path: "bench.defenseMargin",
        limit: whole("Replacement's Field edge", 0, 50),
      },
      {
        path: "bench.injuryPerPlateAppearance",
        limit: per("Injury chance per plate appearance", 0.05),
      },
    ],
  },
  {
    id: "skill",
    title: "Skill, home advantage and matchups",
    columns: 4,
    fields: [
      {
        path: "skill.positionFit.primary",
        limit: per("Primary position bonus", 1),
      },
      {
        path: "skill.positionFit.secondary",
        limit: per("Secondary position bonus", 1),
      },
      {
        path: "skill.positionFit.other",
        limit: { label: "Out of position", min: -1, max: 0 },
      },
      { path: "skill.homeBoost", limit: per("Home advantage", 0.2) },
      {
        path: "skill.teamMatchup",
        limit: per("Team matchup", 0.3, "Dominant color beats theirs"),
      },
      {
        path: "skill.teamMatchupSecond",
        limit: per("Second colors' matchup", 0.3),
      },
      {
        path: "skill.platoonEdge",
        limit: per(
          "Platoon edge",
          0.3,
          "Opposite-side batter or same-side pitcher",
        ),
      },
      {
        path: "skill.playerMatchup",
        limit: per("Pitcher against batter", 0.3),
      },
    ],
  },
  {
    id: "payouts",
    title: "Payouts and Elo",
    columns: 4,
    fields: [
      { path: "balance.payouts.perMatch", limit: money("Every game") },
      { path: "balance.payouts.win", limit: money("Extra for a win") },
      {
        path: "balance.payouts.quarter",
        limit: money("Reaching the quarterfinals"),
      },
      {
        path: "balance.payouts.playoffs",
        limit: money(
          "Reaching the semifinals",
          "On top of the quarterfinal bonus.",
        ),
      },
      {
        path: "balance.payouts.final",
        limit: money("Reaching the final", "On top of the semifinal bonus."),
      },
      {
        path: "balance.payouts.champion",
        limit: money("Winning the final", "On top of the final bonus."),
      },
      {
        path: "balance.payouts.eloK",
        limit: whole(
          "Elo K per game",
          1,
          40,
          "How far Elo moves after each game",
        ),
      },
    ],
  },
  {
    id: "packs",
    title: "Pack prices",
    columns: 4,
    fields: [
      ...BOUGHT_TIERS.map((t) => ({
        path: `balance.packs.tiers.${t.id}`,
        limit: { ...PACK_PRICE, label: `${t.name} pack` },
      })),
      {
        path: "balance.packs.focusSurcharge",
        limit: per("Position focus surcharge", 2, "0.2 = 20% more"),
      },
      {
        path: "balance.packs.eloPerOverall",
        limit: whole(
          "Elo per overall point",
          0,
          400,
          "Pack odds move one overall point per this much Elo above 1500; 0 = off",
        ),
      },
      {
        path: "balance.packs.pricePerOverall",
        limit: per("Price per overall point moved", 0.2),
      },
      {
        path: "balance.packs.excludeOne",
        limit: per("Leaving out 1 color", 3),
      },
      {
        path: "balance.packs.excludeTwo",
        limit: per("Leaving out 2 colors", 3),
      },
      {
        path: "balance.packs.excludeThree",
        limit: per("Leaving out 3 colors", 3),
      },
    ],
  },
  {
    id: "condition",
    title: "Rest and growth",
    columns: 4,
    fields: [
      {
        path: "balance.condition.rest.starterAfter100",
        limit: whole("Starter's rest after 100+ pitches", 0, 10, "Days"),
      },
      {
        path: "balance.condition.rest.starterAfter75",
        limit: whole("Starter's rest after 75–99", 0, 10, "Days"),
      },
      {
        path: "balance.condition.rest.starterAfter50",
        limit: whole("Starter's rest after 50–74", 0, 10, "Days"),
      },
      {
        path: "balance.condition.rest.starterShort",
        limit: whole("Starter's rest after fewer", 0, 10, "Days"),
      },
      {
        path: "balance.condition.rest.relieverPitches",
        limit: whole(
          "Reliever rests a day after",
          1,
          100,
          "Pitches, or after pitching two days running",
        ),
      },
      {
        path: "balance.condition.playingTimeGrowth",
        limit: share(
          "Growth from playing time",
          "0 = not at all; 1 = a player who didn't play barely grows (D154)",
        ),
      },
    ],
  },
  {
    id: "form",
    title: "Form and morale",
    columns: 4,
    fields: [
      {
        path: "balance.form.formEffect",
        limit: per(
          "Form effect",
          0.3,
          "Skill change at full form (0.05 = ±5%)",
        ),
      },
      {
        path: "balance.form.moraleEffect",
        limit: per("Morale effect", 0.3, "Skill change at full morale"),
      },
      {
        path: "balance.form.formMemory",
        limit: share("Form memory", "Share of old form kept after a game"),
      },
      {
        path: "balance.form.formIdleDecay",
        limit: share("Form kept when not playing", "Each week"),
      },
      {
        path: "balance.form.moraleMemory",
        limit: share("Morale memory", "Share kept after a game"),
      },
      {
        path: "balance.form.moraleSwing",
        limit: share("Morale swing", "Gained for a win, lost for a loss"),
      },
    ],
  },
  {
    id: "generation",
    title: "New players",
    columns: 4,
    fields: [
      {
        path: "balance.generation.meanAge",
        limit: whole("Average age", 18, 37),
      },
      { path: "balance.generation.ageSpread", limit: per("Age spread", 10) },
      { path: "balance.generation.peakAge", limit: whole("Peak age", 20, 35) },
      {
        path: "balance.generation.growthPerYear",
        limit: per("Most growth a year", 10, "Shrinks to 0 by the peak age"),
      },
      {
        path: "balance.generation.potentialRangeWidth",
        limit: whole("Shown potential range", 0, 30),
      },
      {
        path: "balance.generation.secondaryChance",
        limit: share("Batters with a second position"),
      },
      {
        path: "balance.generation.starterChance",
        limit: share("Pitchers who start", "In packs that don't choose"),
      },
      {
        path: "balance.generation.leftyPitcherShare",
        limit: share("Left-handed pitchers"),
      },
      {
        path: "balance.generation.leftyThrowerShare",
        limit: share(
          "Left-handed throwers",
          "Of fielders who may be: 1B, outfield and DH",
        ),
      },
      {
        path: "balance.generation.leftyBatterShare",
        limit: share("Batters hitting left"),
      },
      {
        path: "balance.generation.switchHitterShare",
        limit: share("Switch hitters"),
      },
    ],
  },
];

/** Every settings path, in editor order. */
export const BASEBALL_SETTING_PATHS = BASEBALL_SETTING_GROUPS.flatMap((g) =>
  g.fields.map((f) => f.path),
);

/**
 * The key a settings path is stored under: lower case with underscores,
 * as the database's key format asks (`pitch.missAtZero` is stored as
 * `pitch.miss_at_zero`).
 */
export function baseballStoredKey(path: string): string {
  return path.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/**
 * A config from stored values (path → number, by path or stored key):
 * known paths only, and a value outside its limits or not a number keeps
 * the default.
 */
export function baseballConfigFromValues(
  values: Readonly<Record<string, unknown>>,
): BaseballConfig {
  const kept: Record<string, number> = {};
  for (const g of BASEBALL_SETTING_GROUPS)
    for (const f of g.fields) {
      const v = values[f.path] ?? values[baseballStoredKey(f.path)];
      if (limitError(f.limit, v) === null) kept[f.path] = v as number;
    }
  return withPaths(defaultBaseballConfig(), kept);
}

/** The config as the database stores it: one row per path, under its stored key. */
export function baseballConfigToStoredRows(
  config: BaseballConfig,
): { key: string; value: number }[] {
  return baseballConfigToRows(config).map((r) => ({
    key: baseballStoredKey(r.key),
    value: r.value,
  }));
}

/** The config's values, one per settings path. */
export function baseballConfigToRows(
  config: BaseballConfig,
): { key: string; value: number }[] {
  return BASEBALL_SETTING_PATHS.map((key) => ({
    key,
    value: getPath(config, key) as number,
  }));
}

function limitError(limit: Limit, v: unknown): string | null {
  if (typeof v !== "number" || !Number.isFinite(v))
    return `${limit.label} must be a number.`;
  if (v < limit.min || v > limit.max)
    return `${limit.label} must be ${limit.min}–${limit.max}.`;
  if (limit.integer && !Number.isInteger(v))
    return `${limit.label} must be a whole number.`;
  return null;
}

/** What's wrong with these values, one line per field; empty when fine. */
export function baseballSettingsErrors(
  values: Readonly<Record<string, unknown>>,
): string[] {
  const out: string[] = [];
  for (const g of BASEBALL_SETTING_GROUPS)
    for (const f of g.fields) {
      const e = limitError(f.limit, values[f.path]);
      if (e) out.push(e);
    }
  return out;
}
