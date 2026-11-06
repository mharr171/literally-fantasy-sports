/**
 * Baseball's balance settings (ADR 0008 §9, ADR 0007 §7): every number the
 * admin balance editor shows, as dotted paths into `BaseballConfig`, with
 * limits. They're stored in versioned `game_config` rows under the
 * `baseball` scope, one key per path; a season plays by the version it
 * started with, and the built-in defaults apply until a version is
 * published.
 */
import { getPath, type Limit, type SettingGroup, withPaths } from "@lfs/core";
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
];

/** Every settings path, in editor order. */
export const BASEBALL_SETTING_PATHS = BASEBALL_SETTING_GROUPS.flatMap((g) =>
  g.fields.map((f) => f.path),
);

/**
 * A config from stored values (path → number): known paths only, and a
 * value outside its limits or not a number keeps the default.
 */
export function baseballConfigFromValues(
  values: Readonly<Record<string, unknown>>,
): BaseballConfig {
  const kept: Record<string, number> = {};
  for (const g of BASEBALL_SETTING_GROUPS)
    for (const f of g.fields) {
      const v = values[f.path];
      if (limitError(f.limit, v) === null) kept[f.path] = v as number;
    }
  return withPaths(defaultBaseballConfig(), kept);
}

/** The config as stored rows, one per settings path. */
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
