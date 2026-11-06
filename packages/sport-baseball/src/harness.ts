/**
 * The baseball tuning harness (ADR 0008 §10): plays many games between
 * generated clubs with auto-picked squads and reports what the targets
 * cover, so tuning changes can be judged. Pure: the script prints it.
 */
import { createRng, type Rng } from "@lfs/core";
import {
  type BaseballConfig,
  type BaseballTeam,
  defaultBaseballConfig,
  simulateGame,
} from "./game";
import { generatePlayer } from "./generation";
import { autoPickSquad } from "./lineup";
import type { BaseballPlayer } from "./player";
import { POSITIONS, type Position } from "./positions";
import {
  batterRating,
  boxScore,
  DEFAULT_FORM_WEIGHTS,
  type FormWeights,
  pitcherRating,
} from "./stats";

/** A club of this level: 2 per batter position and 13 pitchers, auto-picked. */
export function harnessTeam(
  rng: Rng,
  id: string,
  overall: number,
): BaseballTeam {
  const roster: BaseballPlayer[] = [];
  for (const pos of POSITIONS.filter((p) => p !== "P"))
    for (let k = 0; k < 2; k++)
      roster.push({
        id: `${id}-${pos}-${k}`,
        ...generatePlayer(rng.fork(`${pos}${k}`), {
          position: pos,
          overall: overall + rng.int(-3, 3),
        }),
      });
  for (let k = 0; k < 13; k++)
    roster.push({
      id: `${id}-P${k}`,
      ...generatePlayer(rng.fork(`P${k}`), {
        position: "P",
        overall: overall + rng.int(-3, 3),
        role: k < 5 ? "starter" : "reliever",
      }),
    });
  const squad = autoPickSquad(roster);
  return {
    id,
    batters: squad.batters,
    pitcher: squad.rotation[0] as BaseballPlayer,
    bullpen: squad.bullpen,
    bench: squad.bench,
  };
}

export interface HarnessReport {
  games: number;
  runsPerGame: number;
  homeWinRate: number;
  extraInningRate: number;
  /** Per team per game. */
  strikeouts: number;
  walks: number;
  homeRuns: number;
  stolenBases: number;
  errors: number;
  battingAverage: number;
  starterPitches: number;
  /** Win rate of the stronger side by overall gap, playing home and away equally. */
  byGap: { gap: number; winRate: number }[];
  /** Average game rating by position (D202). */
  formByPosition: Partial<Record<Position, number>>;
  msPerGame: number;
}

export const GAPS = [0, 5, 10, 15] as const;

export function runHarness(
  games: number,
  seed = "harness",
  config: BaseballConfig = defaultBaseballConfig(),
  form: FormWeights = DEFAULT_FORM_WEIGHTS,
  /** Games per gap for the win-rate table; a quarter of `games` (at least 200) by default. */
  gapGames = Math.max(200, Math.round(games / 4)),
): HarnessReport {
  const root = createRng(seed);
  const level = 60;
  const pool = Array.from({ length: 100 }, (_, i) =>
    harnessTeam(root.fork(`t${i}`), `t${i}`, level),
  );
  let runs = 0;
  let home = 0;
  let extras = 0;
  let k = 0;
  let bb = 0;
  let hr = 0;
  let sb = 0;
  let errors = 0;
  let hits = 0;
  let atBats = 0;
  let starterPitches = 0;
  let ms = 0;
  const ratings = new Map<Position, { total: number; n: number }>();
  const rate = (pos: Position, r: number) => {
    const f = ratings.get(pos) ?? { total: 0, n: 0 };
    f.total += r;
    f.n++;
    ratings.set(pos, f);
  };
  for (let i = 0; i < games; i++) {
    const h = pool[i % pool.length] as BaseballTeam;
    const a = pool[(i * 7 + 13) % pool.length] as BaseballTeam;
    const start = performance.now();
    const g = simulateGame(
      { home: h, away: a, mode: "league", config },
      `${seed}-${i}`,
    );
    ms += performance.now() - start;
    const box = boxScore(g);
    runs += g.result.score.home + g.result.score.away;
    if (g.result.winner === "home") home++;
    if (g.result.decidedBy) extras++;
    errors += g.result.errors.home + g.result.errors.away;
    starterPitches +=
      (g.result.pitches[h.pitcher.id] ?? 0) +
      (g.result.pitches[a.pitcher.id] ?? 0);
    for (const [side, team] of [
      ["home", h],
      ["away", a],
    ] as const) {
      const slotOf = new Map<string, Position>(
        team.batters.map((b) => [b.player.id, b.slot]),
      );
      for (const b of box.batters[side]) {
        k += b.k;
        bb += b.bb;
        hr += b.hr;
        sb += b.sb;
        hits += b.h;
        atBats += b.ab;
        const pos = slotOf.get(b.id);
        // Batters who came to the plate at least 3 times.
        if (pos && pos !== "P" && b.ab + b.bb >= 3)
          rate(pos, batterRating(b, pos, form));
      }
      for (const p of box.pitchers[side])
        if (p.outs >= 3) rate("P", pitcherRating(p, box.decisions, form));
    }
  }
  const perTeam = (x: number) => x / games / 2;
  return {
    games,
    runsPerGame: runs / games,
    homeWinRate: home / games,
    extraInningRate: extras / games,
    strikeouts: perTeam(k),
    walks: perTeam(bb),
    homeRuns: perTeam(hr),
    stolenBases: perTeam(sb),
    errors: perTeam(errors),
    battingAverage: atBats ? hits / atBats : 0,
    starterPitches: starterPitches / games / 2,
    byGap: GAPS.map((gap) => ({
      gap,
      winRate: gapWinRate(gap, gapGames, seed, config),
    })),
    formByPosition: Object.fromEntries(
      [...ratings].map(([pos, f]) => [pos, f.total / f.n]),
    ),
    msPerGame: ms / games,
  };
}

/** The stronger side's win rate at an overall gap, home and away in turn. */
export function gapWinRate(
  gap: number,
  games: number,
  seed: string,
  config: BaseballConfig,
): number {
  const root = createRng(`${seed}-gap${gap}`);
  let wins = 0;
  for (let i = 0; i < games; i++) {
    const strong = harnessTeam(root.fork(`s${i}`), `s${i}`, 60 + gap / 2);
    const weak = harnessTeam(root.fork(`w${i}`), `w${i}`, 60 - gap / 2);
    const strongHome = i % 2 === 0;
    const g = simulateGame(
      {
        home: strongHome ? strong : weak,
        away: strongHome ? weak : strong,
        mode: "league",
        config,
      },
      `${seed}-g${gap}-${i}`,
    );
    if ((g.result.winner === "home") === strongHome) wins++;
  }
  return wins / games;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** The report as text, with each target next to its number. */
export function formatReport(r: HarnessReport): string {
  const line = (label: string, value: string, target: string) =>
    `${`${label}:`.padEnd(30)}${value.padEnd(9)}(target ${target})`;
  const form = Object.entries(r.formByPosition)
    .sort(
      (a, b) =>
        POSITIONS.indexOf(a[0] as Position) -
        POSITIONS.indexOf(b[0] as Position),
    )
    .map(([p, v]) => `${p} ${(v as number).toFixed(2)}`);
  const values = Object.values(r.formByPosition) as number[];
  const spread = values.length ? Math.max(...values) - Math.min(...values) : 0;
  return [
    `Games: ${r.games}`,
    line("Runs per game", r.runsPerGame.toFixed(2), "8.5–9.5"),
    line("Home wins, even teams", pct(r.homeWinRate), "52–55%"),
    line("Games to extra innings", pct(r.extraInningRate), "7–10%"),
    line("Strikeouts per team", r.strikeouts.toFixed(2), "7.5–9"),
    line("Walks per team", r.walks.toFixed(2), "2.8–3.5"),
    line("Home runs per team", r.homeRuns.toFixed(2), "0.9–1.3"),
    line("Batting average", r.battingAverage.toFixed(3), ".240–.255"),
    `Stolen bases per team: ${r.stolenBases.toFixed(2)}   Errors per team: ${r.errors.toFixed(2)}   Starter pitches: ${r.starterPitches.toFixed(0)}`,
    "",
    "Stronger side's win rate by overall gap (target: about 60% at 5, 75% at 10):",
    ...r.byGap.map(
      (g) => `  gap ${String(g.gap).padStart(2)}: ${pct(g.winRate)}`,
    ),
    "",
    `Average game rating by position: ${form.join("  ")}`,
    `  (spread ${spread.toFixed(2)}, target ≤ 0.2)`,
    "",
    `${r.msPerGame.toFixed(3)} ms per game (budget under 1 ms)`,
  ].join("\n");
}
