/**
 * Baseball (ADR 0008): the pitch-by-pitch engine, its players, squads,
 * stats and settings. Hidden from players until its Public switch is on
 * (D207); the game around it comes in M18.
 */
import type { Sport } from "@lfs/core";
import {
  type BaseballConfig,
  type BaseballEvent,
  type BaseballResult,
  type BaseballTeam,
  simulateGame,
} from "./game";
import { PLAYERS_ON_FIELD } from "./generation";
import { BASEBALL_STATS } from "./stats";

export const baseball: Sport<
  BaseballTeam,
  BaseballConfig,
  BaseballEvent,
  BaseballResult
> = {
  id: "baseball",
  name: "Baseball",
  playersOnField: PLAYERS_ON_FIELD,
  results: {
    allowsDraws: false,
    points: { win: 1, draw: 0, loss: 0 },
    scoreName: { one: "run", many: "runs" },
    tiebreaks: [{ key: "extra_innings", label: "in extra innings" }],
  },
  stats: BASEBALL_STATS,
  simulate: simulateGame,
};

export * from "./attributes";
export * from "./balance";
export * from "./bench";
export * from "./game";
export * from "./generation";
export * from "./harness";
export * from "./lineup";
export * from "./overall";
export * from "./packs";
export * from "./pitching";
export * from "./player";
export * from "./positions";
export * from "./profiles";
export * from "./season";
export * from "./season-end";
export * from "./season-types";
export * from "./settings";
export * from "./skill";
export * from "./squad";
export * from "./stats";
export * from "./week";
export * from "./win-probability";
export * from "./win-probability-table";
