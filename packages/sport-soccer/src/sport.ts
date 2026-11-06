import { SOCCER_POINTS, type Sport, type StatDef } from "@lfs/core";
import {
  PLAYERS_ON_FIELD,
  type SoccerConfig,
  type SoccerEvent,
  type SoccerResult,
  type SoccerTeam,
  simulateMatch,
} from "./match";
import { SOCCER_GRID } from "./templates";

/** The stats soccer keeps for each player (D143), by key (ADR 0007 §2). */
export const SOCCER_STATS: readonly StatDef[] = [
  { key: "games", label: "Games", short: "GP", kind: "total" },
  { key: "wins", label: "Wins", short: "W", kind: "total" },
  { key: "draws", label: "Draws", short: "D", kind: "total" },
  { key: "losses", label: "Losses", short: "L", kind: "total" },
  {
    key: "winPct",
    label: "Win %",
    short: "W%",
    kind: "rate",
    numerator: "wins",
    denominator: "games",
    scale: 100,
    decimals: 0,
  },
  { key: "goals", label: "Goals", short: "G", kind: "total" },
  { key: "assists", label: "Assists", short: "A", kind: "total" },
  { key: "tackles", label: "Tackles", short: "T", kind: "total" },
  { key: "saves", label: "Saves", short: "S", kind: "total" },
];

export const soccer: Sport<
  SoccerTeam,
  SoccerConfig,
  SoccerEvent,
  SoccerResult
> = {
  id: "soccer",
  name: "Soccer",
  grid: SOCCER_GRID,
  playersOnField: PLAYERS_ON_FIELD,
  results: {
    allowsDraws: true,
    points: SOCCER_POINTS,
    scoreName: { one: "goal", many: "goals" },
    tiebreaks: [
      { key: "extra_time", label: "after extra time" },
      { key: "penalties", label: "on penalties" },
      { key: "forfeit", label: "by forfeit" },
    ],
  },
  stats: SOCCER_STATS,
  simulate: simulateMatch,
};
