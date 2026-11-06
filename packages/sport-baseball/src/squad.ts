/**
 * A baseball club's saved game-day squad (ADR 0009 §8, D196, D212): the
 * batting order with each batter's position, the rotation, the bullpen with
 * its closer, setup man and the starter's pitch limit, and the bench with
 * roles. Stored as `matchday_squads.lineup_data`; checked here before it's
 * saved, and turned into the engine's team for a game.
 */
import type { BenchPlayer, BenchRole } from "./bench";
import type { BaseballTeam } from "./game";
import {
  BENCH_MAX,
  BULLPEN_MAX,
  type LineupStyle,
  type PickedSquad,
  ROTATION_SIZE,
} from "./lineup";
import { defaultBullpenPlan } from "./pitching";
import type { BaseballPlayer } from "./player";
import { type BatterPosition, FIELD_POSITIONS } from "./positions";

export const LINEUP_STYLES: readonly LineupStyle[] = [
  "balanced",
  "batFirst",
  "gloveFirst",
];
export const LINEUP_STYLE_NAMES: Record<LineupStyle, string> = {
  balanced: "Balanced",
  batFirst: "Bat first",
  gloveFirst: "Glove first",
};

export const BENCH_ROLES: readonly BenchRole[] = [
  "pinchHitter",
  "pinchRunner",
  "defense",
  "injury",
];
export const BENCH_ROLE_NAMES: Record<BenchRole, string> = {
  pinchHitter: "Pinch hitter",
  pinchRunner: "Pinch runner",
  defense: "Defensive replacement",
  injury: "Injury cover",
};

/** The 9 slots a batting order fills: each fielding position once, and the DH. */
export const LINEUP_SLOTS: readonly BatterPosition[] = [
  ...FIELD_POSITIONS,
  "DH",
];

/** The starter's pitch limit managers can set. */
export const PITCH_LIMIT_RANGE = [50, 140] as const;
export const DEFAULT_PITCH_LIMIT = 100;

export interface BaseballSquad {
  style: LineupStyle;
  /** The batting order, 1–9, with each batter's position. */
  order: { id: string; slot: BatterPosition }[];
  /** Starting pitchers in rotation order. */
  rotation: string[];
  /** Relievers in the order they come in. */
  bullpen: string[];
  closer: string | null;
  setup: string | null;
  /** The starter comes out at this many pitches, or sooner once tired. */
  starterPitchLimit: number;
  bench: { id: string; role: BenchRole; replaces?: string }[];
}

/** A squad from auto-pick: its order, rotation, bullpen (best closes, next sets up) and bench. */
export function squadFromPicked(
  picked: PickedSquad,
  style: LineupStyle = "balanced",
): BaseballSquad {
  const plan = defaultBullpenPlan(picked.bullpen);
  return {
    style,
    order: picked.batters.map((b) => ({ id: b.player.id, slot: b.slot })),
    rotation: picked.rotation.map((p) => p.id),
    bullpen: picked.bullpen.map((p) => p.id),
    closer: plan.closer,
    setup: plan.setup,
    starterPitchLimit: DEFAULT_PITCH_LIMIT,
    bench: picked.bench.map((b) => ({
      id: b.player.id,
      role: b.role,
      ...(b.replaces ? { replaces: b.replaces } : {}),
    })),
  };
}

/**
 * What's wrong with a squad for this roster, one line each; empty when it
 * can play. Players are checked by id against the roster, so a squad can't
 * name someone the club doesn't have.
 */
export function squadProblems(
  squad: BaseballSquad,
  roster: readonly Pick<BaseballPlayer, "id" | "primaryPosition" | "throws">[],
  benchMax: number = BENCH_MAX,
): string[] {
  const out: string[] = [];
  const byId = new Map(roster.map((p) => [p.id, p]));
  const isPitcher = (id: string) => byId.get(id)?.primaryPosition === "P";
  const all = [
    ...squad.order.map((b) => b.id),
    ...squad.rotation,
    ...squad.bullpen,
    ...squad.bench.map((b) => b.id),
  ];
  if (all.some((id) => !byId.has(id)))
    out.push("A player in the squad isn't on your roster.");
  if (new Set(all).size !== all.length)
    out.push("A player is in the squad twice.");

  if (squad.order.length !== LINEUP_SLOTS.length)
    out.push(`The batting order needs ${LINEUP_SLOTS.length} batters.`);
  const slots = new Set(squad.order.map((b) => b.slot));
  const missing = LINEUP_SLOTS.filter((s) => !slots.has(s));
  if (missing.length > 0 || slots.size !== squad.order.length)
    out.push(
      `Every position needs one batter${missing.length > 0 ? `: ${missing.join(", ")} missing` : ""}.`,
    );
  if (squad.order.some((b) => isPitcher(b.id)))
    out.push("Pitchers don't bat: the DH bats for them.");
  if (
    squad.order.some(
      (b) =>
        byId.get(b.id)?.throws === "L" &&
        ["C", "2B", "3B", "SS"].includes(b.slot),
    )
  )
    out.push("A left-handed thrower can't play C, 2B, 3B or SS.");

  if (squad.rotation.length !== ROTATION_SIZE)
    out.push(`The rotation needs ${ROTATION_SIZE} starting pitchers.`);
  if (squad.bullpen.length > BULLPEN_MAX)
    out.push(`The bullpen holds at most ${BULLPEN_MAX} relievers.`);
  if ([...squad.rotation, ...squad.bullpen].some((id) => !isPitcher(id)))
    out.push("Only pitchers go in the rotation and bullpen.");
  for (const [name, id] of [
    ["closer", squad.closer],
    ["setup man", squad.setup],
  ] as const)
    if (id !== null && !squad.bullpen.includes(id))
      out.push(`The ${name} must be in the bullpen.`);
  if (squad.closer !== null && squad.closer === squad.setup)
    out.push("The closer and setup man must be different relievers.");
  const [lo, hi] = PITCH_LIMIT_RANGE;
  if (
    !Number.isInteger(squad.starterPitchLimit) ||
    squad.starterPitchLimit < lo ||
    squad.starterPitchLimit > hi
  )
    out.push(`The starter's pitch limit must be ${lo}–${hi}.`);

  if (squad.bench.length > benchMax)
    out.push(`The bench holds at most ${benchMax} players.`);
  if (squad.bench.some((b) => isPitcher(b.id)))
    out.push("Pitchers go in the rotation or bullpen, not the bench.");
  const starters = new Set(squad.order.map((b) => b.id));
  if (squad.bench.some((b) => b.replaces && !starters.has(b.replaces)))
    out.push("A bench player is named for someone not in the batting order.");
  if (squad.bench.some((b) => !BENCH_ROLES.includes(b.role)))
    out.push("A bench player has no role.");
  if (!LINEUP_STYLES.includes(squad.style)) out.push("Pick a lineup style.");
  return out;
}

/**
 * The engine's team for a game from a saved squad: `starter` is the
 * rotation's pitcher for this game (the season picks him), `unavailable`
 * the relievers still resting. Players not found are left out.
 */
export function squadToTeam(
  id: string,
  squad: BaseballSquad,
  players: ReadonlyMap<string, BaseballPlayer>,
  starter: string,
  unavailable: readonly string[] = [],
): BaseballTeam {
  const get = (pid: string) => players.get(pid);
  const pitcher = get(starter);
  if (!pitcher) throw new Error("The starting pitcher isn't on the roster.");
  const bullpen = squad.bullpen.flatMap((pid) => get(pid) ?? []);
  return {
    id,
    batters: squad.order.flatMap((b) => {
      const player = get(b.id);
      return player ? [{ player, slot: b.slot }] : [];
    }),
    pitcher,
    bullpen,
    plan: {
      starterPitchLimit: squad.starterPitchLimit,
      closer: squad.closer,
      setup: squad.setup,
      order: squad.bullpen.filter(
        (pid) => pid !== squad.closer && pid !== squad.setup,
      ),
    },
    unavailable,
    bench: squad.bench.flatMap((b): BenchPlayer[] => {
      const player = get(b.id);
      return player
        ? [
            {
              player,
              role: b.role,
              ...(b.replaces ? { replaces: b.replaces } : {}),
            },
          ]
        : [];
    }),
  };
}

/** A saved squad read back from `lineup_data`, or null if it isn't one. */
export function squadFromData(data: unknown): BaseballSquad | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Partial<BaseballSquad>;
  if (
    !Array.isArray(d.order) ||
    !Array.isArray(d.rotation) ||
    !Array.isArray(d.bullpen) ||
    !Array.isArray(d.bench)
  )
    return null;
  return {
    style: LINEUP_STYLES.includes(d.style as LineupStyle)
      ? (d.style as LineupStyle)
      : "balanced",
    order: d.order,
    rotation: d.rotation,
    bullpen: d.bullpen,
    closer: d.closer ?? null,
    setup: d.setup ?? null,
    starterPitchLimit: d.starterPitchLimit ?? DEFAULT_PITCH_LIMIT,
    bench: d.bench,
  };
}
