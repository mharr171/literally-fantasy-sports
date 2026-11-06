/**
 * The check before Elo-scaled packs are switched on (ADR 0006 §4): AI clubs
 * play seasons, earn match money, age, take youth and buy packs at their
 * Elo. The gap in squad strength between the strongest and weakest clubs
 * must not grow season on season.
 */
import {
  createRng,
  DEFAULT_PAYOUTS,
  matchPayout,
  playerWorth,
  resalePrice,
  updateElo,
} from "@lfs/core";
import {
  type AiProfile,
  aiSquad,
  chooseKeeps,
  choosePack,
  chooseReleases,
  chooseYouth,
  PERSONALITIES,
} from "./ai-manager";
import { generateAiTeam } from "./ai-team";
import { FRESH } from "./condition";
import type { GeneratedPlayer } from "./generation";
import { defaultSoccerConfig, simulateMatch } from "./match";
import { squadToTeam } from "./matchday";
import {
  DEFAULT_PACK_PRICES,
  type PackPrices,
  packContents,
  packEloShift,
  packPrice,
} from "./roster";
import { endOfSeason, youthIntake } from "./season-end";

type Player = GeneratedPlayer & { id: string; fromStarterPack: boolean };

interface Club {
  id: string;
  elo: number;
  funds: number;
  profile: AiProfile;
  players: Player[];
}

export interface PackSpreadSeason {
  season: number;
  /** Mean starting-XI overall of the top and bottom quarter of clubs. */
  top: number;
  bottom: number;
  /** top − bottom. */
  spread: number;
  /** Elo of the highest and lowest club. */
  eloHigh: number;
  eloLow: number;
}

const view = (p: Player) => ({ ...p, condition: FRESH, form: 0 });

/** The club's best XI by its own auto-pick, and its mean overall. */
function strength(club: Club) {
  const squad = aiSquad(club.players.map(view), club.profile);
  const byId = new Map(club.players.map((p) => [p.id, p]));
  const xi = squad.lineup
    .map((id) => byId.get(id)?.overall)
    .filter((o): o is number => o !== undefined);
  return {
    squad,
    byId,
    mean: xi.reduce((a, b) => a + b, 0) / Math.max(1, xi.length),
  };
}

/**
 * Plays `seasons` seasons of `clubs` AI clubs, Elo spread from 1200 to 1800,
 * each a single round robin. Between seasons clubs age, take youth, buy up
 * to three packs at their Elo with `prices`, and trim their rosters.
 */
export function runPackSpread(options: {
  seasons: number;
  clubs: number;
  seed: string;
  prices?: PackPrices;
}): PackSpreadSeason[] {
  const prices = options.prices ?? DEFAULT_PACK_PRICES;
  const config = defaultSoccerConfig();
  const root = createRng(`${options.seed}:pack-spread`);
  const clubs: Club[] = Array.from({ length: options.clubs }, (_, i) => {
    const elo = Math.round(1200 + (600 * i) / Math.max(1, options.clubs - 1));
    const team = generateAiTeam(root.fork(`club-${i}`), elo, `c${i}`);
    return {
      id: `c${i}`,
      elo,
      funds: 10_000,
      profile: {
        personality: PERSONALITIES[
          i % PERSONALITIES.length
        ] as AiProfile["personality"],
        pace: "normal",
        formation: "4-4-2",
      },
      players: team.players.map((p) => ({ ...p, fromStarterPack: true })),
    };
  });
  const report = (season: number): PackSpreadSeason => {
    const means = clubs.map((c) => strength(c).mean).sort((a, b) => b - a);
    const q = Math.max(1, Math.round(clubs.length / 4));
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const top = avg(means.slice(0, q));
    const bottom = avg(means.slice(-q));
    const elos = clubs.map((c) => c.elo);
    return {
      season,
      top,
      bottom,
      spread: top - bottom,
      eloHigh: Math.max(...elos),
      eloLow: Math.min(...elos),
    };
  };
  const out = [report(0)];
  for (let season = 1; season <= options.seasons; season++) {
    // The season: everyone plays everyone once.
    const teams = clubs.map((c) => {
      const { squad, byId } = strength(c);
      return squadToTeam(c.id, squad, byId);
    });
    for (let a = 0; a < clubs.length; a++)
      for (let b = a + 1; b < clubs.length; b++) {
        const home = clubs[a] as Club;
        const away = clubs[b] as Club;
        const { result } = simulateMatch(
          {
            home: teams[a] as ReturnType<typeof squadToTeam>,
            away: teams[b] as ReturnType<typeof squadToTeam>,
            mode: "league",
            config,
          },
          `${options.seed}:s${season}:${a}-${b}`,
        );
        const score =
          result.winner === "home" ? 1 : result.winner === "away" ? 0 : 0.5;
        const elo = updateElo(home.elo, away.elo, score);
        home.elo = elo.rating;
        away.elo = elo.opponent;
        const outcome = (s: number) =>
          s === 1 ? "win" : s === 0 ? "loss" : "draw";
        home.funds += matchPayout(outcome(score), DEFAULT_PAYOUTS);
        away.funds += matchPayout(outcome(1 - score), DEFAULT_PAYOUTS);
      }
    // Between seasons: age, youth, packs, trim.
    for (const club of clubs) {
      const seed = `${options.seed}:s${season}:${club.id}`;
      const aged = endOfSeason(seed, club.players);
      const byId = new Map(aged.aged.map((a) => [a.id, a]));
      club.players = club.players
        .filter((p) => byId.has(p.id))
        .map((p) => ({ ...p, ...(byId.get(p.id) as object) }));
      const prospects = youthIntake(seed);
      const youth = chooseYouth(
        prospects,
        club.players.length,
        club.profile.personality,
      );
      for (const i of youth)
        club.players.push({
          ...(prospects[i] as GeneratedPlayer),
          id: `${seed}:y${i}`,
          fromStarterPack: true,
        });
      for (let n = 0; n < 3; n++) {
        const shift = packEloShift(club.elo, prices);
        const choice = choosePack(
          club.funds,
          club.players,
          club.profile.personality,
          prices,
          shift,
        );
        if (!choice) break;
        club.funds -= packPrice(choice.tier, choice.focus, prices, {
          eloShift: shift,
        });
        const pack = packContents(
          `${seed}:p${n}`,
          choice.focus,
          choice.tier,
          undefined,
          { eloShift: shift },
        );
        const keep = new Set(
          chooseKeeps(pack, club.players, club.profile.personality),
        );
        pack.forEach((p, i) => {
          if (keep.has(i))
            club.players.push({
              ...p,
              id: `${seed}:p${n}:${i}`,
              fromStarterPack: false,
            });
          else club.funds += resalePrice(playerWorth(p));
        });
      }
      const releases = new Set(
        chooseReleases(club.players, club.profile.personality).map((r) => r.id),
      );
      club.players = club.players.filter((p) => !releases.has(p.id));
    }
    out.push(report(season));
  }
  return out;
}

export function formatPackSpread(
  label: string,
  rows: readonly PackSpreadSeason[],
): string {
  const f = (x: number) => x.toFixed(1);
  return [
    label,
    "  season  top-quarter XI  bottom-quarter XI  spread  Elo range",
    ...rows.map(
      (r) =>
        `  ${String(r.season).padStart(6)}  ${f(r.top).padStart(14)}  ${f(r.bottom).padStart(17)}  ${f(r.spread).padStart(6)}  ${r.eloLow}–${r.eloHigh}`,
    ),
  ].join("\n");
}
