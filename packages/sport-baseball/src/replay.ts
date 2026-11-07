/**
 * Replaying a baseball game for its match page (ADR 0009 §9, D204): the
 * same teams, settings and seed give the same game, event for event. The
 * play-by-play text and the win probability line are worked out here, so
 * the page only draws them.
 */
import type { BenchRole } from "./bench";
import type {
  BaseballConfig,
  BaseballEvent,
  BaseballOutput,
  BaseballTeam,
  BattedKind,
  PlayResult,
} from "./game";
import { simulateGame } from "./game";
import type { ChangeReason } from "./pitching";
import { situations, type WinTable, winProbability } from "./win-probability";
import { WIN_TABLE } from "./win-probability-table";

/** The game again, from the teams it was played with and its seed. */
export function replayGame(
  teams: { home: BaseballTeam; away: BaseballTeam },
  config: BaseballConfig,
  seed: string,
  knockout = false,
): BaseballOutput {
  return simulateGame(
    {
      home: teams.home,
      away: teams.away,
      mode: knockout ? "knockout" : "league",
      config,
    },
    seed,
  );
}

const RESULT_TEXT: Record<PlayResult, string> = {
  strikeout: "strikes out",
  walk: "walks",
  single: "singles",
  double: "doubles",
  triple: "triples",
  homeRun: "homers",
  out: "is out",
  doublePlay: "grounds into a double play",
  sacFly: "hits a sacrifice fly",
  error: "reaches on an error",
};

/** An out by the kind of ball hit. */
const OUT_TEXT: Record<BattedKind, string> = {
  ground: "grounds out",
  line: "lines out",
  fly: "flies out",
  popup: "pops out",
};

const CHANGE_TEXT: Record<ChangeReason, string> = {
  limit: "at his pitch limit",
  tired: "tired",
  closer: "for the save",
  setup: "to set up",
};

const ROLE_TEXT: Record<BenchRole, string> = {
  pinchHitter: "pinch-hits",
  pinchRunner: "pinch-runs",
  defense: "comes in for defense",
  injury: "replaces the injured player",
};

const fielderText = (f: string | undefined) => (f ? ` to ${f}` : "");

/**
 * One line of play-by-play for an event, or null for a pitch (pitches are
 * shown by the diamond and the count, not the log).
 */
export function playText(
  e: BaseballEvent,
  name: (id: string) => string,
): string | null {
  switch (e.type) {
    case "pitch":
      return null;
    case "play": {
      const what =
        e.result === "out" && e.batted
          ? OUT_TEXT[e.batted.kind]
          : RESULT_TEXT[e.result];
      const scored =
        e.scored.length > 0
          ? ` ${e.scored.map((r) => name(r.runner)).join(", ")} ${e.scored.length === 1 ? "scores" : "score"}.`
          : "";
      const where =
        e.result === "strikeout" || e.result === "walk"
          ? ""
          : fielderText(e.fielder);
      return `${name(e.batter)} ${what}${where}.${scored}`;
    }
    case "steal":
      return e.safe
        ? `${name(e.runner)} steals ${e.to === 2 ? "second" : "third"}.`
        : `${name(e.runner)} is caught stealing ${e.to === 2 ? "second" : "third"}.`;
    case "pitchingChange":
      return `Pitching change: ${name(e.in)} replaces ${name(e.out)} (${CHANGE_TEXT[e.reason]}).`;
    case "substitution":
      return `${name(e.in)} ${ROLE_TEXT[e.role]} for ${name(e.out)}.`;
    case "injury":
      return `${name(e.player)} is hurt (${e.days} day${e.days === 1 ? "" : "s"}).`;
  }
}

/** The home side's chance of winning before each plate appearance, then the final result (0 or 1). */
export function winProbabilityLine(
  events: readonly BaseballEvent[],
  homeWon: boolean,
  table: WinTable = WIN_TABLE,
): number[] {
  return [
    ...situations(events).map((s) => winProbability(table, s)),
    homeWon ? 1 : 0,
  ];
}
