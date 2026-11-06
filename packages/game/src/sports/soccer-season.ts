/**
 * Soccer's season part behind the sport-neutral interface (ADR 0009 §1).
 * This is soccer's season code as it was before M18, moved here unchanged,
 * so soccer plays and pays exactly as before.
 */
import { playerWorth } from "@lfs/core";
import { moveOffTurnedOff } from "../formations";
import { scoreOnly } from "../match-kept";
import { playerRow } from "../scouting";
import {
  configFor,
  liveGenerationSettings,
  liveSoccerConfig,
  loadGhostTeams,
  loadLeagueCandidates,
  playedIds,
  type StoredManagerTeam,
} from "../season";
import type { SeasonModule } from "../season-module";
import { loadLeagueSize, loadRosterLimits } from "../sport-settings";
import {
  loadAgingPlayers,
  loadRoster,
  loadSquad,
  loadStarterPacks,
  type MyTeam,
} from "../team";
import {
  availableSquad,
  endOfSeason,
  FRESH,
  formModifier,
  isAvailable,
  MANAGER_SLOT,
  type MatchdaySquad,
  matchStats,
  nearestLeague,
  nextCondition,
  nextForm,
  nextMorale,
  type PlayerCondition,
  packEloShift,
  playWeek,
  rosterWarning,
  type SoccerTeam,
  seasonReset,
  seasonStats,
  snapshotTeam,
  squadProblems,
  squadToTeam,
  youthIntake,
} from "./soccer";

interface SoccerReady {
  roster: Awaited<ReturnType<typeof loadRoster>>;
  squad: MatchdaySquad;
}

/**
 * Everything a match needs from a team: a picked starting squad, a roster
 * of 22–30 (D54) and a valid matchday squad (D88).
 */
async function readyToPlay(team: MyTeam): Promise<SoccerReady> {
  const packs = await loadStarterPacks(team.id);
  if (packs.some((p) => !p.resolved))
    throw new Error("Pick your starting squad first.");
  const [roster, saved, limits] = await Promise.all([
    loadRoster(team.id),
    loadSquad(team.id),
    loadRosterLimits(),
  ]);
  const warning = rosterWarning(roster.length, limits);
  if (warning) throw new Error(warning);
  if (!saved) throw new Error("Save a matchday squad first.");
  const squad = await moveOffTurnedOff(team.id, saved, roster);
  const problems = squadProblems(
    squad,
    new Set(roster.map((p) => p.id)),
    undefined,
    limits.benchMax,
  );
  if (problems.length > 0)
    throw new Error(`Fix your matchday squad first: ${problems.join(" ")}`);
  return { roster, squad };
}

export const soccerSeason: SeasonModule<SoccerReady> = {
  readyToPlay,

  async newSeason(team, seed) {
    const { label } = await liveSoccerConfig();
    // The clubs nearest its Elo (D115), as many as the sport's league holds.
    const league = nearestLeague(
      seed,
      { name: team.name, elo: team.elo, teamId: team.id },
      await loadLeagueCandidates(team.elo, team.id),
      await loadLeagueSize(),
    );
    return {
      configVersion: label,
      slots: league.slots.map((s) => ({
        slot: s.slot,
        kind: s.kind,
        name: s.name,
        start_rating: s.startRating,
        // start_season copies these clubs as they are now (D115).
        source_team_id: s.ghostId ?? null,
      })),
      fixtures: league.fixtures.map((f) => ({
        week: f.week,
        stage: f.stage,
        home_slot: f.homeSlot,
        away_slot: f.awaySlot,
      })),
    };
  },

  async playWeek(team, { roster, squad }, season) {
    // The season plays and pays by the settings version it started with.
    const { config, balance } = await configFor(season.configVersion);
    // Injured and suspended players sit out; the best fit players step in.
    const condition = new Map(roster.map((p) => [p.id, p.condition]));
    const { squad: playing } = availableSquad(squad, roster, (id) =>
      isAvailable(condition.get(id) ?? FRESH),
    );
    const elo = Object.fromEntries(season.slots.map((s) => [s.slot, s.elo]));
    elo[MANAGER_SLOT] = team.elo;
    const managerTeam: SoccerTeam = {
      ...squadToTeam(team.id, playing, new Map(roster.map((p) => [p.id, p]))),
      fitness: Object.fromEntries(
        roster.map((p) => [p.id, p.condition.fitness]),
      ),
      // Form and morale nudge skill a little (M4).
      modifiers: Object.fromEntries(
        roster.map((p) => [
          p.id,
          formModifier(p.form, team.morale, balance.form),
        ]),
      ),
    };
    const managerNames = new Map(roster.map((p) => [p.id, p.displayName]));
    const outcome = playWeek(
      {
        seed: season.seed,
        status: season.status,
        week: season.week,
        slots: season.slots,
        elo,
        fixtures: season.fixtures,
      },
      {
        team: managerTeam,
        names: managerNames,
        ghosts: await loadGhostTeams(season.id),
      },
      config,
      balance.payouts,
    );
    // Kept with the manager's result so the match can be replayed (M5).
    const keptTeam: StoredManagerTeam = {
      team: managerTeam,
      names: Object.fromEntries(
        playedIds(managerTeam).map((id) => [id, managerNames.get(id) ?? "?"]),
      ),
    };
    const isMine = (id: string) => {
      const f = season.fixtures.find((x) => x.id === id);
      return f?.homeSlot === MANAGER_SLOT || f?.awaySlot === MANAGER_SLOT;
    };
    return {
      status: outcome.status,
      args: {
        p_results: outcome.played.map((p) => ({
          id: p.id,
          home_score: p.homeScore,
          away_score: p.awayScore,
          winner: p.winner,
          // Other clubs' matches keep only their score (D120).
          summary: isMine(p.id) ? p.summary : scoreOnly(p.summary),
          // AI clubs never keep replay details (ADR 0002).
          manager_team: isMine(p.id) && team.kind === "human" ? keptTeam : null,
        })),
        p_elo: Object.fromEntries(
          Object.entries(outcome.elo).map(([slot, rating]) => [slot, rating]),
        ),
        p_funds: outcome.managerFunds,
        p_new_fixtures: outcome.newFixtures.map((f) => ({
          week: f.week,
          stage: f.stage,
          home_slot: f.homeSlot,
          away_slot: f.awaySlot,
        })),
        p_status: outcome.status,
        p_next_week: outcome.week,
        p_morale: nextMorale(team.morale, outcome.managerResult, balance.form),
        p_players: roster.map((p) => {
          const next = nextCondition(
            p.condition,
            outcome.managerReports[p.id],
            balance.condition,
          );
          return {
            id: p.id,
            fitness: next.fitness,
            injured_days: next.injuredDays,
            suspended_games: next.suspendedGames,
            yellow_cards: next.yellowCards,
            form: nextForm(
              p.form,
              outcome.managerReports[p.id],
              outcome.managerResult,
              balance.form,
              {
                position: p.primaryPosition,
                conceded: outcome.managerConceded,
              },
            ),
            // Career totals for the retirement record (D120, D143). Only the
            // club's own match counts, never its copies in other leagues.
            appeared: (outcome.managerReports[p.id]?.minutes ?? 0) > 0,
            // Playing time this season, for growth at season end (D154).
            minutes: Math.round(outcome.managerReports[p.id]?.minutes ?? 0),
            // The week's stat deltas by key (ADR 0009 §5).
            stats: matchStats(
              outcome.managerReports[p.id],
              outcome.managerResult,
            ),
          };
        }),
      },
    };
  },

  async closeSeason(team, season) {
    const [players, roster, squad] = await Promise.all([
      loadAgingPlayers(team.id),
      loadRoster(team.id),
      loadSquad(team.id),
    ]);
    // The team as it finished the season: its ghost, if it's its best (D116).
    const ghost = snapshotTeam(
      roster.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        attributes: p.attributes,
        primaryPosition: p.primaryPosition,
        secondaryPosition: p.secondaryPosition,
        chemistryColor: p.chemistryColor,
        overall: p.overall,
        templateVariant: p.templateVariant,
        secondaryTemplateVariant: p.secondaryTemplateVariant,
      })),
      squad,
    );
    const snapshot = {
      players: ghost.players,
      squad: ghost.squad,
      stats: seasonStats(season.slots, season.fixtures),
      game_version: process.env.GAME_VERSION ?? "unknown",
    };
    // Young players grow with their minutes, if the season's settings say so (D154).
    const { balance } = await configFor(season.configVersion);
    const ownMatches = season.fixtures.filter(
      (f) =>
        f.homeScore !== null &&
        (f.homeSlot === MANAGER_SLOT || f.awaySlot === MANAGER_SLOT),
    ).length;
    const result = endOfSeason(season.seed, players, undefined, undefined, {
      weight: balance.condition.playingTimeGrowth,
      clubMinutes: ownMatches * 90,
    });
    const byId = new Map(players.map((p) => [p.id, p]));
    const updates = result.aged.map((a) => {
      const p = byId.get(a.id) as (typeof players)[number];
      return {
        id: a.id,
        age: a.age,
        attributes: a.attributes,
        overall: a.overall,
        worth: playerWorth({
          overall: a.overall,
          age: a.age,
          potentialRange: p.potentialRange,
        }),
        ...conditionRow(
          seasonReset(roster.find((r) => r.id === a.id)?.condition ?? FRESH),
        ),
      };
    });
    const review = {
      retired: result.retired.map((id) => {
        const p = byId.get(id) as (typeof players)[number];
        return {
          name: p.displayName,
          position: p.primaryPosition,
          age: p.age + 1,
          overall: p.overall,
        };
      }),
      changes: result.aged
        .map((a) => {
          const p = byId.get(a.id) as (typeof players)[number];
          return {
            name: p.displayName,
            position: p.primaryPosition,
            age: a.age,
            from: p.overall,
            to: a.overall,
          };
        })
        .filter((c) => c.from !== c.to)
        .sort((x, y) => y.to - y.from - (x.to - x.from)),
    };
    // The playoff finish earns a free pack (D181), at the club's Elo now.
    const { balance: live } = await liveSoccerConfig();
    return {
      p_updates: updates,
      p_retired: result.retired,
      p_review: review,
      p_snapshot: snapshot,
      p_elo_shift: packEloShift(team.elo, live.packs),
    };
  },

  async youthRows(seed) {
    return youthIntake(seed, undefined, await liveGenerationSettings()).map(
      (p) => playerRow(p),
    );
  },
};

function conditionRow(c: PlayerCondition) {
  return {
    fitness: c.fitness,
    injured_days: c.injuredDays,
    suspended_games: c.suspendedGames,
    yellow_cards: c.yellowCards,
  };
}
