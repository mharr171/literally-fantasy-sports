/**
 * Soccer's AI manager behind the sport-neutral interface (ADR 0007 §8).
 * Each method calls soccer's existing decision unchanged, so AI clubs
 * decide exactly as before.
 */
import type { AiManager } from "../ai-manager";
import {
  type AiIdentity,
  type AiPlayerView,
  type AiProfile,
  type AiRosterPlayer,
  type AiSquadPlayer,
  aiSquad,
  chooseKeeps,
  choosePack,
  chooseReleases,
  chooseYouth,
  type MatchdaySquad,
  type PackFocus,
  type PackPrices,
  pickStarterKeeps,
  rollAiIdentity,
} from "./soccer";

export interface SoccerAiTypes {
  view: AiPlayerView;
  rosterPlayer: AiRosterPlayer;
  squadPlayer: AiSquadPlayer;
  squad: MatchdaySquad;
  profile: AiProfile;
  prices: PackPrices;
  packChoice: { tier: string; focus: PackFocus };
  identity: AiIdentity;
}

export const soccerAi: AiManager<SoccerAiTypes> = {
  rollIdentity: (rng, taken, formations) =>
    rollAiIdentity(rng, taken, formations),
  pickStarters: (pool, profile) => pickStarterKeeps(pool, profile.personality),
  pickSquad: (roster, profile, restBelowFitness) =>
    aiSquad(roster, profile, restBelowFitness),
  choosePack: (funds, roster, profile, prices, eloShift) =>
    choosePack(funds, roster, profile.personality, prices, eloShift),
  chooseKeeps: (pack, roster, profile) =>
    chooseKeeps(pack, roster, profile.personality),
  chooseYouth: (prospects, rosterSize, profile) =>
    chooseYouth(prospects, rosterSize, profile.personality),
  chooseReleases: (roster, profile) =>
    chooseReleases(roster, profile.personality),
};
