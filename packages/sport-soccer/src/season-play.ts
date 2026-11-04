/**
 * Playing a soccer season week by week (D16, D30, D32, D39, D40). Pure: the
 * web app loads the season, calls `playWeek`, and saves what it returns.
 *
 * Teams are identified by their slot in the league (0 = the manager). AI
 * teams are rebuilt from the season seed, so only their ratings are stored.
 * Every match's seed comes from the season seed and the fixture's id, so a
 * match can be replayed exactly.
 */
import {
  aiOpponentRatings,
  createRng,
  DEFAULT_PAYOUTS,
  type Fixture,
  leagueTable,
  matchPayout,
  type PayoutSettings,
  playoffSemis,
  roundRobin,
  type Side,
  type Standing,
  updateElo,
} from "@lfs/core";
import {
  type AiTeam,
  type AiTeamSettings,
  aiTeamName,
  DEFAULT_AI_TEAM_SETTINGS,
  generateAiTeam,
} from "./ai-team";
import {
  type SoccerConfig,
  type SoccerEvent,
  type SoccerTeam,
  simulateMatch,
} from "./match";
import { squadToTeam } from "./matchday";

export const LEAGUE_SIZE = 8;
export const MANAGER_SLOT = 0;

export type Stage = "league" | "semi" | "final";
export type SeasonStatus = "regular" | "playoffs" | "finished";

export interface LeagueSlot {
  slot: number;
  name: string;
  kind: "manager" | "ai";
  /** Rating at season start; AI squads are built from it. */
  startRating: number;
}

export interface NewFixture {
  week: number;
  stage: Stage;
  homeSlot: number;
  awaySlot: number;
}

/** The AI side of a new league (D8, D32): names and ratings, plus the schedule. */
export function newLeague(
  seed: string,
  manager: { name: string; elo: number },
  settings: AiTeamSettings = DEFAULT_AI_TEAM_SETTINGS,
): { slots: LeagueSlot[]; fixtures: NewFixture[] } {
  const ratings = aiOpponentRatings(manager.elo, LEAGUE_SIZE - 1);
  // No two clubs share a name or a place ("X City" and "X United").
  const place = (name: string) =>
    name.slice(0, Math.max(0, name.lastIndexOf(" "))).toLowerCase();
  const used = new Set([manager.name.toLowerCase()]);
  const places = new Set([place(manager.name)]);
  const clash = (name: string) =>
    used.has(name.toLowerCase()) || places.has(place(name));
  const slots: LeagueSlot[] = [
    {
      slot: MANAGER_SLOT,
      name: manager.name,
      kind: "manager",
      startRating: manager.elo,
    },
  ];
  ratings.forEach((rating, i) => {
    const slot = i + 1;
    let name = aiTeam(seed, slot, rating, settings).name;
    for (let k = 0; clash(name); k++)
      name = aiTeamName(createRng(seed).fork(`name-${slot}-${k}`));
    used.add(name.toLowerCase());
    places.add(place(name));
    slots.push({ slot, name, kind: "ai", startRating: rating });
  });
  // Shuffle who plays whom when, so the manager doesn't always start the same way.
  const order = createRng(seed)
    .fork("schedule")
    .shuffle(slots.map((s) => String(s.slot)));
  const fixtures = roundRobin(order).map((f: Fixture) => ({
    week: f.week,
    stage: "league" as const,
    homeSlot: Number(f.home),
    awaySlot: Number(f.away),
  }));
  return { slots, fixtures };
}

/** An AI team's squad, rebuilt from the season seed. */
export function aiTeam(
  seed: string,
  slot: number,
  startRating: number,
  settings: AiTeamSettings = DEFAULT_AI_TEAM_SETTINGS,
): AiTeam {
  return generateAiTeam(
    createRng(seed).fork(`ai-${slot}`),
    startRating,
    `ai${slot}`,
    settings,
  );
}

export interface SeasonFixture extends NewFixture {
  id: string;
  homeScore: number | null;
  awayScore: number | null;
  /** Knockout winner, when the match is played. */
  winner: Side | null;
}

export interface SeasonState {
  seed: string;
  status: SeasonStatus;
  week: number;
  slots: LeagueSlot[];
  /** Current rating of every slot (the manager's is the team's Elo). */
  elo: Record<number, number>;
  fixtures: SeasonFixture[];
}

/** A short record of a match, with names, for the results page. */
export interface MatchSummary {
  possession: Record<Side, number>;
  shots: Record<Side, number>;
  decidedBy?: "extra_time" | "penalties";
  penalties?: Record<Side, number>;
  events: {
    minute: number;
    type: "goal" | "yellow" | "red" | "injury";
    side: Side;
    player: string;
  }[];
}

export interface PlayedFixture {
  id: string;
  homeScore: number;
  awayScore: number;
  winner: Side | null;
  summary: MatchSummary;
}

export interface WeekOutcome {
  played: PlayedFixture[];
  /** New ratings for every slot that played. */
  elo: Record<number, number>;
  /** Funds the manager earns this week: match pay plus any playoff bonus. */
  managerFunds: number;
  /** Playoff fixtures to add (semi-finals or the final). */
  newFixtures: NewFixture[];
  status: SeasonStatus;
  week: number;
}

export interface ManagerSide {
  team: SoccerTeam;
  /** Player names by id, for match summaries. */
  names: ReadonlyMap<string, string>;
}

/**
 * Plays every match of the current week. League weeks run to the last
 * league week, then the top 4 go into single-match semi-finals and a final
 * (D30). Elo moves after every match, AI v AI included (D40).
 */
export function playWeek(
  state: SeasonState,
  manager: ManagerSide,
  config: SoccerConfig,
  payouts: PayoutSettings = DEFAULT_PAYOUTS,
  aiSettings: AiTeamSettings = DEFAULT_AI_TEAM_SETTINGS,
): WeekOutcome {
  if (state.status === "finished") throw new Error("This season is over.");
  const fixtures = state.fixtures.filter(
    (f) => f.week === state.week && f.homeScore === null,
  );
  if (fixtures.length === 0)
    throw new Error(`Nothing to play in week ${state.week}.`);

  const teams = new Map<number, SoccerTeam>();
  const names = new Map<string, string>(manager.names);
  const teamFor = (slot: number): SoccerTeam => {
    const cached = teams.get(slot);
    if (cached) return cached;
    let team: SoccerTeam;
    if (slot === MANAGER_SLOT) team = manager.team;
    else {
      const info = state.slots.find((s) => s.slot === slot);
      if (!info) throw new Error(`No team in slot ${slot}.`);
      const ai = aiTeam(state.seed, slot, info.startRating, aiSettings);
      for (const p of ai.players) names.set(p.id, p.displayName);
      team = squadToTeam(
        `slot-${slot}`,
        ai.squad,
        new Map(ai.players.map((p) => [p.id, p])),
      );
    }
    teams.set(slot, team);
    return team;
  };

  const elo = { ...state.elo };
  let managerFunds = 0;
  const played: PlayedFixture[] = [];
  for (const f of fixtures) {
    const knockout = f.stage !== "league";
    const { result, events } = simulateMatch(
      {
        home: teamFor(f.homeSlot),
        away: teamFor(f.awaySlot),
        mode: knockout ? "knockout" : "league",
        config,
      },
      `${state.seed}:${f.id}`,
    );
    const homeScore = result.score.home;
    const awayScore = result.score.away;
    const score =
      result.winner === "home" ? 1 : result.winner === "away" ? 0 : 0.5;
    const change = updateElo(
      elo[f.homeSlot] as number,
      elo[f.awaySlot] as number,
      score,
    );
    elo[f.homeSlot] = change.rating;
    elo[f.awaySlot] = change.opponent;
    const managerSide: Side | null =
      f.homeSlot === MANAGER_SLOT
        ? "home"
        : f.awaySlot === MANAGER_SLOT
          ? "away"
          : null;
    if (managerSide)
      managerFunds += matchPayout(
        result.winner === null
          ? "draw"
          : result.winner === managerSide
            ? "win"
            : "loss",
        payouts,
      );
    played.push({
      id: f.id,
      homeScore,
      awayScore,
      winner: knockout ? result.winner : null,
      summary: summarize(result, events, names),
    });
  }

  // What happens next.
  const after = state.fixtures.map((f) => {
    const p = played.find((x) => x.id === f.id);
    return p
      ? {
          ...f,
          homeScore: p.homeScore,
          awayScore: p.awayScore,
          winner: p.winner,
        }
      : f;
  });
  const lastLeagueWeek = Math.max(
    ...after.filter((f) => f.stage === "league").map((f) => f.week),
  );
  let status: SeasonStatus = state.status;
  let week = state.week + 1;
  const newFixtures: NewFixture[] = [];
  const stage = fixtures[0]?.stage;
  if (stage === "league" && state.week === lastLeagueWeek) {
    const semis = playoffSemis(table(state.slots, after));
    status = "playoffs";
    for (const s of semis)
      newFixtures.push({
        week,
        stage: "semi",
        homeSlot: Number(s.home),
        awaySlot: Number(s.away),
      });
    if (
      newFixtures.some(
        (f) => f.homeSlot === MANAGER_SLOT || f.awaySlot === MANAGER_SLOT,
      )
    )
      managerFunds += payouts.playoffs;
  } else if (stage === "semi") {
    const winners = played.map((p) => {
      const f = fixtures.find((x) => x.id === p.id) as SeasonFixture;
      return p.winner === "home" ? f.homeSlot : f.awaySlot;
    });
    newFixtures.push({
      week,
      stage: "final",
      homeSlot: winners[0] as number,
      awaySlot: winners[1] as number,
    });
    if (winners.includes(MANAGER_SLOT)) managerFunds += payouts.final;
  } else if (stage === "final") {
    status = "finished";
    week = state.week;
    const p = played[0] as PlayedFixture;
    const f = fixtures[0] as SeasonFixture;
    if ((p.winner === "home" ? f.homeSlot : f.awaySlot) === MANAGER_SLOT)
      managerFunds += payouts.champion;
  }

  const changed: Record<number, number> = {};
  for (const f of fixtures) {
    changed[f.homeSlot] = elo[f.homeSlot] as number;
    changed[f.awaySlot] = elo[f.awaySlot] as number;
  }
  return { played, elo: changed, managerFunds, newFixtures, status, week };
}

/** The league table from the league fixtures played so far. */
export function table(
  slots: readonly LeagueSlot[],
  fixtures: readonly SeasonFixture[],
): Standing[] {
  return leagueTable(
    slots.map((s) => String(s.slot)),
    fixtures
      .filter(
        (f) =>
          f.stage === "league" && f.homeScore !== null && f.awayScore !== null,
      )
      .map((f) => ({
        home: String(f.homeSlot),
        away: String(f.awaySlot),
        homeScore: f.homeScore as number,
        awayScore: f.awayScore as number,
      })),
  );
}

function summarize(
  result: {
    possession: Record<Side, number>;
    shots: Record<Side, number>;
    decidedBy?: "extra_time" | "penalties";
    penalties?: Record<Side, number>;
  },
  events: readonly SoccerEvent[],
  names: ReadonlyMap<string, string>,
): MatchSummary {
  const kept: MatchSummary["events"] = [];
  for (const e of events)
    if (
      e.type === "goal" ||
      e.type === "yellow" ||
      e.type === "red" ||
      e.type === "injury"
    )
      kept.push({
        minute: e.minute,
        type: e.type,
        side: e.side,
        player: names.get(e.playerId) ?? "Unknown",
      });
  return {
    possession: result.possession,
    shots: result.shots,
    ...(result.decidedBy ? { decidedBy: result.decidedBy } : {}),
    ...(result.penalties ? { penalties: result.penalties } : {}),
    events: kept,
  };
}
