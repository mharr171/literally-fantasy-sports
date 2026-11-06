/**
 * The sports the web app can show (ADR 0007 §1): each sport's name and the
 * folder its screens live in (`src/sports/<sport>/`). Shared pages ask this
 * registry for a sport's parts instead of importing a sport's components
 * directly; soccer's screens move here as M16 goes on.
 */
import type { SportId } from "@lfs/core";

export interface SportUi {
  id: SportId;
  name: string;
  /** Where the sport's pages live (ADR 0007 §10). */
  basePath: string;
  /** A short emoji for the top bar and home page until icons exist. */
  icon: string;
}

export const SPORT_UI: Partial<Record<SportId, SportUi>> = {
  soccer: { id: "soccer", name: "Soccer", basePath: "/soccer", icon: "⚽" },
  // A stand-in until M17 (ADR 0007 §12); hidden from players (D207).
  baseball: {
    id: "baseball",
    name: "Baseball",
    basePath: "/baseball",
    icon: "⚾",
  },
};

/** A sport's UI entry, or undefined for a sport the web app can't show. */
export function sportUi(id: string): SportUi | undefined {
  return SPORT_UI[id as SportId];
}
