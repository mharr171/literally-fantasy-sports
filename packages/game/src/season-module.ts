/**
 * A sport's season part (ADR 0009 §1, D217). The shared steps in
 * season-steps.ts and play-week.ts check the rules every sport shares
 * (season status, energy) and save through the database functions; they
 * ask the club's sport for everything else through this interface.
 */
import type { LoadedSeason } from "./season";
import type { MyTeam } from "./team";

/** The slot the club itself plays from in its league (the same in every sport). */
export const MANAGER_SLOT = 0;

/** A new season's league, as `start_season` takes it. */
export interface NewSeason {
  /** The settings version the season plays by, e.g. "soccer:3". */
  configVersion: string;
  slots: {
    slot: number;
    kind: string;
    name: string;
    start_rating: number;
    source_team_id: string | null;
  }[];
  fixtures: {
    week: number;
    stage: string;
    /** A game's number in its series (ADR 0007 §4); 1 when left out. */
    game_no?: number;
    home_slot: number;
    away_slot: number;
  }[];
}

/** A played week: `record_week`'s arguments other than the season, week and energy. */
export interface PlayedWeek {
  status: "regular" | "playoffs" | "finished";
  args: Record<string, unknown>;
}

/**
 * `Ready` is what `readyToPlay` found (the roster and game-day squad), handed
 * back to `playWeek` so it isn't loaded twice.
 */
export interface SeasonModule<Ready = unknown> {
  /**
   * The season's first week is the club's bye (baseball's week 0, ADR 0009
   * §2): it's played as the season starts, so the club begins on week 1.
   */
  playsOpeningWeek?: boolean;
  /** Checks the club can play (squad picked and valid); throws a message for the manager. */
  readyToPlay(team: MyTeam): Promise<Ready>;
  /** The league of a new season: the clubs nearest the club's Elo (D115) and their fixtures. */
  newSeason(team: MyTeam, seed: string): Promise<NewSeason>;
  /** Plays the season's current week: every game, results, Elo, payouts and condition. */
  playWeek(
    team: MyTeam,
    ready: Ready,
    season: LoadedSeason,
  ): Promise<PlayedWeek>;
  /** Season end: aging, the review, the club's snapshot and the free pack (`close_season_with_reward`'s arguments other than the season). */
  closeSeason(
    team: MyTeam,
    season: LoadedSeason,
  ): Promise<Record<string, unknown>>;
  /** The season's youth prospects as player rows, in the order they're offered. */
  youthRows(seed: string): Promise<Record<string, unknown>[]>;
}
