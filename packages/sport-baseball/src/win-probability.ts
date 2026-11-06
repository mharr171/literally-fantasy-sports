/**
 * Win probability (ADR 0008 §8, D201): how often the home side goes on to
 * win from a situation, measured over harness games and saved as data
 * (`win-probability-table.ts`), so M18's graph is a lookup along a game's
 * events. A situation is the inning (10 meaning extra innings), the half,
 * the outs, the runners on base and the score difference (home minus away,
 * capped at ±5). Sparse situations fall back to the same one without
 * runners, then to the score difference alone.
 */
import { createRng } from "@lfs/core";
import {
  type BaseballEvent,
  defaultBaseballConfig,
  simulateGame,
} from "./game";
import { harnessTeam } from "./harness";

export interface WinSituation {
  inning: number;
  batting: "home" | "away";
  outs: number;
  /** Runners on first, second and third. */
  bases: readonly [unknown, unknown, unknown];
  /** Home runs minus away runs. */
  diff: number;
}

/** Home win chances in thousandths, by situation key. */
export type WinTable = Readonly<Record<string, number>>;

const capInning = (i: number) => Math.min(10, i);
const capDiff = (d: number) => Math.max(-5, Math.min(5, d));
const mask = (b: WinSituation["bases"]) =>
  (b[0] ? 1 : 0) + (b[1] ? 2 : 0) + (b[2] ? 4 : 0);

export const situationKey = (s: WinSituation): string =>
  `${capInning(s.inning)}${s.batting === "home" ? "b" : "t"}${s.outs}${mask(s.bases)}:${capDiff(s.diff)}`;
const noBasesKey = (s: WinSituation) =>
  `${capInning(s.inning)}${s.batting === "home" ? "b" : "t"}${s.outs}x:${capDiff(s.diff)}`;
const diffKey = (s: WinSituation) => `d:${capDiff(s.diff)}`;

/** Fewer games than this in a situation and the lookup falls back. */
export const MIN_SAMPLES = 40;

/** Builds the table from `games` harness games between even sides. */
export function buildWinTable(
  games: number,
  seed = "win-probability",
): WinTable {
  const root = createRng(seed);
  const pool = Array.from({ length: 60 }, (_, i) =>
    harnessTeam(root.fork(`t${i}`), `t${i}`, 60),
  );
  const counts = new Map<string, { wins: number; n: number }>();
  const add = (key: string, homeWon: boolean) => {
    const c = counts.get(key) ?? { wins: 0, n: 0 };
    c.n++;
    if (homeWon) c.wins++;
    counts.set(key, c);
  };
  const config = defaultBaseballConfig();
  for (let i = 0; i < games; i++) {
    const g = simulateGame(
      {
        home: pool[i % 60] as never,
        away: pool[(i * 7 + 13) % 60] as never,
        mode: "league",
        config,
      },
      `${seed}-${i}`,
    );
    const homeWon = g.result.winner === "home";
    for (const s of situations(g.events)) {
      add(situationKey(s), homeWon);
      add(noBasesKey(s), homeWon);
      add(diffKey(s), homeWon);
    }
  }
  const table: Record<string, number> = {};
  for (const [key, c] of [...counts].sort((a, b) => a[0].localeCompare(b[0])))
    if (c.n >= MIN_SAMPLES) table[key] = Math.round((c.wins / c.n) * 1000);
  return table;
}

/** The situation at the start of each plate appearance, in order. */
export function situations(events: readonly BaseballEvent[]): WinSituation[] {
  const out: WinSituation[] = [];
  let home = 0;
  let away = 0;
  for (const e of events) {
    if (e.type === "pitch" && e.balls === 0 && e.strikes === 0)
      out.push({
        inning: e.inning,
        batting: e.batting,
        outs: e.outs,
        bases: e.bases,
        diff: home - away,
      });
    if (e.type === "play") {
      if (e.batting === "home") home += e.runs;
      else away += e.runs;
    }
  }
  return out;
}

/** The home side's chance to win from a situation, 0–1. */
export function winProbability(table: WinTable, s: WinSituation): number {
  const hit =
    table[situationKey(s)] ?? table[noBasesKey(s)] ?? table[diffKey(s)];
  if (hit !== undefined) return hit / 1000;
  // Beyond what the table saw: a big lead wins.
  return s.diff > 0 ? 0.99 : s.diff < 0 ? 0.01 : 0.5;
}
