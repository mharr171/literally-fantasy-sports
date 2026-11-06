/**
 * The sport registry (ADR 0007 §1): every sport the game layer can run, by
 * id. Shared code asks it for a club's sport instead of importing a sport
 * package directly.
 */
import type { MatchResult, Sport, SportId } from "@lfs/core";
import { soccer } from "./sports/soccer";

/** What the game layer needs from a sport. Grows as M16 moves code behind it. */
export interface SportModule {
  // biome-ignore lint/suspicious/noExplicitAny: each sport has its own team, config and event types
  engine: Sport<any, any, any, MatchResult>;
}

/** Soccer's id, for the code that is still soccer-only until M16 moves it. */
export const SOCCER: SportId = "soccer";

const MODULES: Partial<Record<SportId, SportModule>> = {
  soccer: { engine: soccer },
};

/** The sports with a module, in the order they're shown. */
export const SPORTS = Object.keys(MODULES) as SportId[];

export function isRegisteredSport(id: string): id is SportId {
  return id in MODULES;
}

/** A sport's module; throws for a sport the game can't run yet. */
export function sportModule(id: string): SportModule {
  const module = isRegisteredSport(id) ? MODULES[id] : undefined;
  if (!module) throw new Error(`No sport module for "${id}".`);
  return module;
}
