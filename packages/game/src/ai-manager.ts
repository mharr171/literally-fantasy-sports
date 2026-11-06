/**
 * What an AI club decides, the same for every sport (ADR 0007 §8). Each
 * sport implements it with its own player views, squads and profiles; the
 * AI runner in ai-clubs.ts only calls these methods. Decisions only ever
 * see what a manager sees (never true potential).
 */
import type { Rng } from "@lfs/core";

/** The types a sport's AI manager works with. */
export interface AiTypes {
  /** A player as the AI sees them: never the hidden potential. */
  view: unknown;
  /** A rostered player, with what releasing needs to know. */
  rosterPlayer: unknown;
  /** A player as the AI picks its game-day squad: with condition. */
  squadPlayer: unknown;
  /** A saved game-day squad. */
  squad: unknown;
  /** How the club is run (personality, pace, formation…). */
  profile: unknown;
  /** Today's pack prices. */
  prices: unknown;
  /** Which pack to buy. */
  packChoice: unknown;
  /** A new AI club's name, colors, manager and profile. */
  identity: unknown;
}

export interface AiManager<T extends AiTypes> {
  /** A new AI club; `taken` is lower-cased names already in use. */
  rollIdentity(
    rng: Rng,
    taken: ReadonlySet<string>,
    formations: readonly string[],
  ): T["identity"];
  /** Which starter-pack players to keep, as indexes into the pool. */
  pickStarters(pool: readonly T["view"][], profile: T["profile"]): number[];
  /** This week's game-day squad. */
  pickSquad(
    roster: readonly T["squadPlayer"][],
    profile: T["profile"],
    restBelowFitness: number,
  ): T["squad"];
  /** The pack to buy now, or null to save. */
  choosePack(
    funds: number,
    roster: readonly T["view"][],
    profile: T["profile"],
    prices: T["prices"],
    eloShift: number,
  ): T["packChoice"] | null;
  /** Which players to keep from an opened pack. */
  chooseKeeps(
    pack: readonly T["view"][],
    roster: readonly T["view"][],
    profile: T["profile"],
  ): number[];
  /** Which youth prospects to take, by index. */
  chooseYouth(
    prospects: readonly T["view"][],
    rosterSize: number,
    profile: T["profile"],
  ): number[];
  /** Who leaves to bring the roster back to the club's target. */
  chooseReleases(
    roster: readonly T["rosterPlayer"][],
    profile: T["profile"],
  ): { id: string; mode: "sell" | "release" }[];
}
