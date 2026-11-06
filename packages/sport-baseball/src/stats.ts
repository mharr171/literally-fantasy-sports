/**
 * Stats, the box score and form (ADR 0008 §7–§8, D202, D204, D214).
 *
 * The box score (about 2 KB) is the only part of a game that is stored;
 * at-bats and pitches are replayed from the seed when needed. It is worked
 * out from the game's events: each batter's line, each pitcher's line, and
 * the win, loss and save, by simplified MLB rules:
 * - win: the winning side's pitcher of record when it took the lead for
 *   good; a starter needs 5 innings (15 outs) for it, otherwise it goes to
 *   the winning side's reliever who pitched best;
 * - loss: the pitcher charged with the run that put the winners ahead for
 *   good;
 * - save: the pitcher who finished the win without getting it, if he
 *   came in with a lead of 3 or fewer or pitched the last 3 innings.
 */
import type { Side, StatDef } from "@lfs/core";
import type { BaseballEvent, BaseballOutput } from "./game";
import type { BatterPosition, Position } from "./positions";

/** The stats baseball keeps, by key (ADR 0007 §2, D202). */
export const BASEBALL_STATS: readonly StatDef[] = [
  { key: "games", label: "Games", short: "G", kind: "total" },
  { key: "atBats", label: "At-bats", short: "AB", kind: "total" },
  { key: "hits", label: "Hits", short: "H", kind: "total" },
  {
    key: "avg",
    label: "Batting average",
    short: "AVG",
    kind: "rate",
    numerator: "hits",
    denominator: "atBats",
    decimals: 3,
  },
  { key: "homeRuns", label: "Home runs", short: "HR", kind: "total" },
  { key: "rbi", label: "Runs batted in", short: "RBI", kind: "total" },
  { key: "stolenBases", label: "Stolen bases", short: "SB", kind: "total" },
  { key: "walks", label: "Walks", short: "BB", kind: "total" },
  { key: "strikeouts", label: "Strikeouts", short: "K", kind: "total" },
  { key: "gamesPitched", label: "Games pitched", short: "GP", kind: "total" },
  { key: "wins", label: "Wins", short: "W", kind: "total" },
  { key: "losses", label: "Losses", short: "L", kind: "total" },
  { key: "outs", label: "Outs recorded", short: "OUTS", kind: "total" },
  { key: "earnedRuns", label: "Earned runs", short: "ER", kind: "total" },
  {
    key: "era",
    label: "Earned run average",
    short: "ERA",
    kind: "rate",
    numerator: "earnedRuns",
    denominator: "outs",
    scale: 27,
    decimals: 2,
  },
  {
    key: "pitchingStrikeouts",
    label: "Strikeouts (pitching)",
    short: "SO",
    kind: "total",
  },
  { key: "saves", label: "Saves", short: "SV", kind: "total" },
];

export interface BatterLine {
  id: string;
  ab: number;
  r: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  bb: number;
  k: number;
  sb: number;
}

export interface PitcherLine {
  id: string;
  outs: number;
  h: number;
  r: number;
  er: number;
  bb: number;
  k: number;
  hr: number;
  pitches: number;
}

export interface BoxScore {
  lineScore: Record<Side, number[]>;
  runs: Record<Side, number>;
  hits: Record<Side, number>;
  errors: Record<Side, number>;
  /** In the order they first came to bat or pitched. */
  batters: Record<Side, BatterLine[]>;
  pitchers: Record<Side, PitcherLine[]>;
  decisions: { win: string; loss: string; save: string | null };
}

const other = (s: Side): Side => (s === "home" ? "away" : "home");
const HITS = new Set(["single", "double", "triple", "homeRun"]);
const NO_AT_BAT = new Set(["walk", "sacFly"]);

/** The box score of a game, from its events and result. */
export function boxScore(game: BaseballOutput): BoxScore {
  const { result, events } = game;
  const batters: Record<Side, Map<string, BatterLine>> = {
    home: new Map(),
    away: new Map(),
  };
  const pitchers: Record<Side, Map<string, PitcherLine>> = {
    home: new Map(),
    away: new Map(),
  };
  const bat = (side: Side, id: string) => {
    let line = batters[side].get(id);
    if (!line) {
      line = {
        id,
        ab: 0,
        r: 0,
        h: 0,
        doubles: 0,
        triples: 0,
        hr: 0,
        rbi: 0,
        bb: 0,
        k: 0,
        sb: 0,
      };
      batters[side].set(id, line);
    }
    return line;
  };
  const arm = (side: Side, id: string) => {
    let line = pitchers[side].get(id);
    if (!line) {
      line = {
        id,
        outs: result.pitcherOuts[id] ?? 0,
        h: 0,
        r: 0,
        er: 0,
        bb: 0,
        k: 0,
        hr: 0,
        pitches: result.pitches[id] ?? 0,
      };
      pitchers[side].set(id, line);
    }
    return line;
  };

  // Running score, lead changes and when each pitcher came in.
  const score: Record<Side, number> = { home: 0, away: 0 };
  let goAhead: { side: Side; run: { pitcher: string } } | null = null;
  const onMound: Record<Side, string | null> = { home: null, away: null };
  const pitcherWhenAhead: Record<Side, string | null> = {
    home: null,
    away: null,
  };
  const entryLead = new Map<string, number>();

  const visit = (e: BaseballEvent) => {
    const fielding = other(e.batting);
    if (e.type === "pitch") {
      if (!onMound[fielding]) {
        onMound[fielding] = e.pitcher;
        entryLead.set(e.pitcher, 0);
      }
      arm(fielding, e.pitcher);
      bat(e.batting, e.batter);
      return;
    }
    if (e.type === "pitchingChange") {
      onMound[e.side] = e.in;
      entryLead.set(e.in, score[e.side] - score[other(e.side)]);
      arm(e.side, e.in);
      return;
    }
    if (e.type === "steal") {
      if (e.safe) bat(e.batting, e.runner).sb++;
      return;
    }
    if (e.type !== "play") return;
    const b = bat(e.batting, e.batter);
    const p = arm(fielding, e.pitcher);
    if (!NO_AT_BAT.has(e.result)) b.ab++;
    if (HITS.has(e.result)) {
      b.h++;
      p.h++;
    }
    if (e.result === "double") b.doubles++;
    if (e.result === "triple") b.triples++;
    if (e.result === "homeRun") {
      b.hr++;
      p.hr++;
    }
    if (e.result === "walk") {
      b.bb++;
      p.bb++;
    }
    if (e.result === "strikeout") {
      b.k++;
      p.k++;
    }
    b.rbi += e.rbi;
    for (const run of e.scored) {
      bat(e.batting, run.runner).r++;
      const charged = arm(fielding, run.pitcher);
      charged.r++;
      if (run.earned) charged.er++;
      const before = score[e.batting] - score[fielding];
      score[e.batting]++;
      // A run that puts the batting side ahead: the go-ahead run, for now.
      if (before === 0) {
        goAhead = { side: e.batting, run };
        pitcherWhenAhead[e.batting] = onMound[e.batting];
      }
    }
  };
  for (const e of events) visit(e);

  const winner = result.winner as Side;
  const loser = other(winner);
  const ahead = goAhead as { side: Side; run: { pitcher: string } } | null;
  const winPitchers = [...pitchers[winner].values()];
  const starter = winPitchers[0] as PitcherLine;
  // The winners' pitcher of record when they went ahead for good: the one
  // who pitched the half before, or their starter if they led from the top.
  let win = pitcherWhenAhead[winner] ?? starter.id;
  if (win === starter.id && starter.outs < 15) {
    const relievers = winPitchers.slice(1);
    const best = [...relievers].sort(
      (a, b) => b.outs - 3 * b.r - (a.outs - 3 * a.r) || b.outs - a.outs,
    )[0];
    if (best) win = best.id;
  }
  const loss =
    ahead && ahead.side === winner
      ? ahead.run.pitcher
      : ([...pitchers[loser].values()][0] as PitcherLine).id;
  const finisher = winPitchers[winPitchers.length - 1] as PitcherLine;
  const lead = entryLead.get(finisher.id) ?? 0;
  const save =
    finisher.id !== win &&
    finisher.id !== starter.id &&
    ((lead >= 1 && lead <= 3) || finisher.outs >= 9)
      ? finisher.id
      : null;

  return {
    lineScore: result.lineScore,
    runs: result.score,
    hits: result.hits,
    errors: result.errors,
    batters: {
      home: [...batters.home.values()],
      away: [...batters.away.values()],
    },
    pitchers: {
      home: [...pitchers.home.values()],
      away: [...pitchers.away.values()],
    },
    decisions: { win, loss, save },
  };
}

/** Each player's stat totals from one game, by stat key (ADR 0007 §2). */
export function gameStats(
  box: BoxScore,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  const add = (id: string, key: string, n: number) => {
    if (n === 0) return;
    const row = out[id] ?? {};
    row[key] = (row[key] ?? 0) + n;
    out[id] = row;
  };
  for (const side of ["home", "away"] as const) {
    for (const b of box.batters[side]) {
      add(b.id, "games", 1);
      add(b.id, "atBats", b.ab);
      add(b.id, "hits", b.h);
      add(b.id, "homeRuns", b.hr);
      add(b.id, "rbi", b.rbi);
      add(b.id, "stolenBases", b.sb);
      add(b.id, "walks", b.bb);
      add(b.id, "strikeouts", b.k);
    }
    for (const p of box.pitchers[side]) {
      add(p.id, "gamesPitched", 1);
      add(p.id, "outs", p.outs);
      add(p.id, "earnedRuns", p.er);
      add(p.id, "pitchingStrikeouts", p.k);
    }
  }
  add(box.decisions.win, "wins", 1);
  add(box.decisions.loss, "losses", 1);
  if (box.decisions.save) add(box.decisions.save, "saves", 1);
  return out;
}

/** What a game rating counts, and each position's offset (tuned so every position averages the same, D202). */
export interface FormWeights {
  batter: {
    base: number;
    hit: number;
    extraBase: number;
    walk: number;
    rbi: number;
    run: number;
    steal: number;
    strikeout: number;
    out: number;
  };
  pitcher: {
    base: number;
    out: number;
    earnedRun: number;
    hitOrWalk: number;
    strikeout: number;
    win: number;
    save: number;
  };
  /** Added to each position's ratings so every position averages the same. */
  offset: Partial<Record<Position, number>>;
}

export const DEFAULT_FORM_WEIGHTS: FormWeights = {
  batter: {
    base: 6,
    hit: 0.6,
    extraBase: 0.3,
    walk: 0.35,
    rbi: 0.25,
    run: 0.25,
    steal: 0.3,
    strikeout: 0.2,
    out: 0.15,
  },
  pitcher: {
    base: 6,
    out: 0.08,
    earnedRun: 0.55,
    hitOrWalk: 0.12,
    strikeout: 0.1,
    win: 0.4,
    save: 0.4,
  },
  // From the harness (10,000 games): pitchers averaged 0.67 below batters.
  offset: { P: 0.67 },
};

const clampRating = (r: number) =>
  Math.min(10, Math.max(1, Math.round(r * 10) / 10));

/** A batter's game rating, 1–10. */
export function batterRating(
  b: BatterLine,
  position: BatterPosition,
  w: FormWeights = DEFAULT_FORM_WEIGHTS,
): number {
  const x = w.batter;
  const extraBases = b.doubles + 2 * b.triples + 3 * b.hr;
  const outs = b.ab - b.h;
  return clampRating(
    x.base +
      b.h * x.hit +
      extraBases * x.extraBase +
      b.bb * x.walk +
      b.rbi * x.rbi +
      b.r * x.run +
      b.sb * x.steal -
      b.k * x.strikeout -
      outs * x.out +
      (w.offset[position] ?? 0),
  );
}

/** A pitcher's game rating, 1–10. */
export function pitcherRating(
  p: PitcherLine,
  decisions: BoxScore["decisions"],
  w: FormWeights = DEFAULT_FORM_WEIGHTS,
): number {
  const x = w.pitcher;
  return clampRating(
    x.base +
      p.outs * x.out -
      p.er * x.earnedRun -
      (p.h + p.bb) * x.hitOrWalk +
      p.k * x.strikeout +
      (decisions.win === p.id ? x.win : 0) +
      (decisions.save === p.id ? x.save : 0) +
      (w.offset.P ?? 0),
  );
}
