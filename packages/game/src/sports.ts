/**
 * The sport registry (ADR 0007 §1): every sport the game layer can run, by
 * id. Shared code asks it for a club's sport instead of importing a sport
 * package directly.
 */
import type { MatchResult, SettingGroup, Sport, SportId } from "@lfs/core";
import type { AiManager, AiTypes } from "./ai-manager";
import { baseball } from "./sports/baseball";
import { SOCCER_SETTING_GROUPS, soccer } from "./sports/soccer";
import { type SoccerAiTypes, soccerAi } from "./sports/soccer-ai";

/** What the game layer needs from a sport. Grows as M16 moves code behind it. */
export interface SportModule<TAi extends AiTypes = AiTypes> {
  // biome-ignore lint/suspicious/noExplicitAny: each sport has its own team, config and event types
  engine: Sport<any, any, any, MatchResult>;
  /**
   * How the sport's AI clubs decide (ADR 0007 §8). Baseball's stand-in has
   * none yet: its AI world stays off until M18.
   */
  ai?: AiManager<TAi>;
  /** Its balance settings as the admin editor draws them (ADR 0007 §7). */
  settings: readonly SettingGroup[];
}

/** Each registered sport's module, with its own types. */
interface Modules {
  soccer: SportModule<SoccerAiTypes> & { ai: AiManager<SoccerAiTypes> };
  /** A stand-in until M17 (ADR 0007 §12): hidden from players. */
  baseball: SportModule;
}

const MODULES: Modules = {
  soccer: { engine: soccer, ai: soccerAi, settings: SOCCER_SETTING_GROUPS },
  baseball: { engine: baseball, settings: [] },
};

/** Soccer's id, for the code that is still soccer-only until M16 moves it. */
export const SOCCER = "soccer" satisfies SportId;

/** The sports with a module, in the order they're shown. */
export const SPORTS = Object.keys(MODULES) as (keyof Modules & SportId)[];

export function isRegisteredSport(id: string): id is keyof Modules {
  return id in MODULES;
}

/** A sport's module; throws for a sport the game can't run yet. */
export function sportModule<K extends keyof Modules>(id: K): Modules[K];
export function sportModule(id: string): SportModule;
export function sportModule(id: string): SportModule {
  if (!isRegisteredSport(id)) throw new Error(`No sport module for "${id}".`);
  return MODULES[id] as unknown as SportModule;
}
