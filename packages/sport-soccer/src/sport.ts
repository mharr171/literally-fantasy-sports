import type { Sport } from "@lfs/core";
import {
  PLAYERS_ON_FIELD,
  type SoccerConfig,
  type SoccerEvent,
  type SoccerResult,
  type SoccerTeam,
  simulateMatch,
} from "./match";
import { SOCCER_GRID } from "./templates";

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
  allowsDraws: true,
  simulate: simulateMatch,
};
