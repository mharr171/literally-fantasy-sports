/**
 * AI clubs (D113, ADR 0002): creating them and running a club's turn. A
 * turn takes the same steps a manager takes, through the same code
 * (season-steps, team-steps, play-week); the AI manager in the engine
 * decides what to do. Decisions only ever see what a manager sees.
 */
import { createRng } from "@lfs/core";
import {
  type AiPlayerView,
  type AiProfile,
  aiSquad,
  chooseKeeps,
  choosePack,
  chooseReleases,
  chooseYouth,
  type GeneratedPlayer,
  pickStarterKeeps,
  rollAiIdentity,
  rosterWarning,
  starterPackPlan,
  weeksThisRun,
  youthIntake,
} from "@lfs/sport-soccer";
import { createServiceClient } from "./db";
import { playOneWeek } from "./play-week";
import {
  liveGenerationSettings,
  liveSoccerConfig,
  loadLatestSeason,
} from "./season";
import { endSeasonFor, startSeasonFor, takeYouthFor } from "./season-steps";
import {
  loadOpenBoughtPack,
  loadRoster,
  loadStarterPacks,
  loadTeamById,
  type MyTeam,
  openedContents,
  SOCCER,
} from "./team";
import {
  buyPackFor,
  confirmStarterSquadFor,
  openStarterPacks,
  removePlayerFor,
  resolvePackFor,
  saveSquadFor,
} from "./team-steps";

/** The AI world's switches (D113, D114). */
export interface AiSettings {
  enabled: boolean;
  poolSize: number;
  runsPerDay: number;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: false,
  poolSize: 250,
  runsPerDay: 12,
};

export async function loadAiSettings(): Promise<AiSettings> {
  const { data, error } = await createServiceClient()
    .from("ai_settings")
    .select("enabled, pool_size, runs_per_day")
    .eq("sport", SOCCER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_AI_SETTINGS;
  return {
    enabled: data.enabled,
    poolSize: data.pool_size,
    runsPerDay: data.runs_per_day,
  };
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  const { error } = await createServiceClient().from("ai_settings").upsert({
    sport: SOCCER,
    enabled: settings.enabled,
    pool_size: settings.poolSize,
    runs_per_day: settings.runsPerDay,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** An AI club as admins see it. */
export interface AiClub {
  id: string;
  name: string;
  managerName: string;
  profile: AiProfile;
  elo: number;
  funds: number;
  energy: number;
  /** When its energy last changed: oldest first means longest since it played. */
  energyUpdatedAt: string;
  createdAt: string;
}

export async function listAiClubs(): Promise<AiClub[]> {
  const { data, error } = await createServiceClient()
    .from("teams")
    .select(
      "id, name, manager_name, ai, elo, funds, energy, energy_updated_at, created_at",
    )
    .eq("sport", SOCCER)
    .eq("kind", "ai")
    .order("elo", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    managerName: t.manager_name as string,
    profile: t.ai as AiProfile,
    elo: t.elo as number,
    funds: t.funds as number,
    energy: t.energy as number,
    energyUpdatedAt: t.energy_updated_at as string,
    createdAt: t.created_at as string,
  }));
}

/** What the AI may see of a generated player: no hidden potential (D48). */
const view = (p: GeneratedPlayer): AiPlayerView => ({
  age: p.age,
  primaryPosition: p.primaryPosition,
  overall: p.overall,
  potentialRange: p.potentialRange,
});

const profileOf = async (teamId: string): Promise<AiProfile> => {
  const { data, error } = await createServiceClient()
    .from("teams")
    .select("ai")
    .eq("id", teamId)
    .eq("kind", "ai")
    .single();
  if (error) throw new Error(error.message);
  return data.ai as AiProfile;
};

/**
 * Creates one AI club with its 22 starter packs and picks its first squad
 * the way a new manager does (D83). Returns the club's id.
 */
export async function createAiClub(seed: string = crypto.randomUUID()) {
  const db = createServiceClient();
  const { data: names, error: namesError } = await db
    .from("teams")
    .select("name")
    .eq("sport", SOCCER);
  if (namesError) throw new Error(namesError.message);
  const taken = new Set(
    (names ?? []).map((n) => (n.name as string).toLowerCase()),
  );
  const rng = createRng(seed);
  for (let attempt = 0; attempt < 5; attempt++) {
    const identity = rollAiIdentity(rng.fork(`club-${attempt}`), taken);
    const { data: id, error } = await db.rpc("create_ai_team", {
      p_sport: SOCCER,
      p_name: identity.name,
      p_colors: identity.colors,
      p_manager_name: identity.managerName,
      p_ai: identity.profile,
      p_packs: starterPackPlan(),
    });
    if (error) {
      // Another club took the name meanwhile: roll again.
      if (error.message.includes("teams_sport_name")) {
        taken.add(identity.name.toLowerCase());
        continue;
      }
      throw new Error(error.message);
    }
    const team = await loadTeamById(id as string);
    if (!team) throw new Error("The new AI club wasn't saved.");
    await pickFirstSquad(team, identity.profile);
    return team.id;
  }
  throw new Error("Couldn't find a free name for a new AI club.");
}

async function pickFirstSquad(team: MyTeam, profile: AiProfile) {
  const packs = await loadStarterPacks(team.id);
  await openStarterPacks(
    team,
    packs.filter((p) => !p.opened).map((p) => p.id),
  );
  const generation = await liveGenerationSettings();
  const contents = packs.map((p) => openedContents(p, generation));
  const keeps = pickStarterKeeps(
    contents.flat().map(view),
    profile.personality,
  );
  const chosen: Record<string, number[]> = {};
  for (const i of keeps) {
    const pack = packs[Math.floor(i / 5)] as (typeof packs)[number];
    chosen[pack.id] = [...(chosen[pack.id] ?? []), i % 5];
  }
  await confirmStarterSquadFor(team, chosen);
  await saveSquad(team, profile);
}

async function saveSquad(team: MyTeam, profile: AiProfile) {
  const roster = await loadRoster(team.id);
  await saveSquadFor(team, aiSquad(roster, profile));
}

/** Keeps what's worth keeping from an open bought pack, sells the rest. */
async function sortOpenPack(team: MyTeam, profile: AiProfile) {
  const pack = await loadOpenBoughtPack(team.id);
  if (!pack) return false;
  const players = openedContents(pack, await liveGenerationSettings());
  const roster = await loadRoster(team.id);
  await resolvePackFor(
    team,
    pack.id,
    chooseKeeps(players.map(view), roster, profile.personality),
  );
  return true;
}

/** Between seasons: buy and sort a few packs, then trim the roster. */
async function rebuild(team: MyTeam, profile: AiProfile, notes: string[]) {
  const { packs: prices } = (await liveSoccerConfig()).balance;
  for (let i = 0; i < 3; i++) {
    const fresh = (await loadTeamById(team.id)) as MyTeam;
    const roster = await loadRoster(team.id);
    const choice = choosePack(fresh.funds, roster, profile.personality, prices);
    if (!choice) break;
    await buyPackFor(fresh, choice.tier, choice.focus);
    await sortOpenPack(fresh, profile);
    notes.push(`bought a ${choice.tier} pack`);
  }
  await trim(team, profile, notes);
}

async function trim(team: MyTeam, profile: AiProfile, notes: string[]) {
  const roster = await loadRoster(team.id);
  for (const r of chooseReleases(roster, profile.personality)) {
    await removePlayerFor(team, r.id, r.mode);
    notes.push(`${r.mode === "sell" ? "sold" : "released"} a player`);
  }
}

/** What one AI club did in a run, for the admin page and the run log. */
export interface AiTurn {
  teamId: string;
  weeksPlayed: number;
  notes: string[];
  error?: string;
}

/**
 * One AI club's turn (D114): it sorts anything left open, wraps up and
 * starts seasons, and plays up to `weeks` weeks while it has energy. Every
 * step goes through the same code as a manager's; a step the rules refuse
 * (out of energy, for one) ends the turn.
 */
export async function aiClubTurn(
  teamId: string,
  weeks: number,
): Promise<AiTurn> {
  const turn: AiTurn = { teamId, weeksPlayed: 0, notes: [] };
  try {
    const start = await loadTeamById(teamId);
    if (!start || start.kind !== "ai") throw new Error("Not an AI club.");
    const profile = await profileOf(teamId);
    const starter = await loadStarterPacks(teamId);
    if (starter.some((p) => !p.resolved)) {
      await pickFirstSquad(start, profile);
      turn.notes.push("picked its first squad");
    }
    if (await sortOpenPack(start, profile)) turn.notes.push("sorted a pack");
    for (let step = 0; step < weeks + 6; step++) {
      const team = (await loadTeamById(teamId)) as MyTeam;
      const season = await loadLatestSeason(teamId);
      if (season && season.status === "finished" && !season.closed) {
        await endSeasonFor(team);
        turn.notes.push(`ended season ${season.number}`);
        continue;
      }
      if (season?.closed && !season.intakeResolved) {
        const prospects = youthIntake(
          season.seed,
          undefined,
          await liveGenerationSettings(),
        );
        const roster = await loadRoster(teamId);
        const picks = chooseYouth(
          prospects.map(view),
          roster.length,
          profile.personality,
        );
        await takeYouthFor(team, picks);
        turn.notes.push(`took ${picks.length} youth prospects`);
        continue;
      }
      if (!season || season.status === "finished") {
        await rebuild(team, profile, turn.notes);
        await saveSquad(team, profile);
        await startSeasonFor(team);
        turn.notes.push(`started season ${(season?.number ?? 0) + 1}`);
        continue;
      }
      if (turn.weeksPlayed >= weeks) break;
      // Over the roster limit (after a youth intake): trim before playing.
      if (rosterWarning((await loadRoster(teamId)).length))
        await trim(team, profile, turn.notes);
      await saveSquad(team, profile);
      try {
        await playOneWeek(team, { useEnergy: true });
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("Out of energy")) break;
        throw e;
      }
      turn.weeksPlayed++;
    }
  } catch (e) {
    turn.error = e instanceof Error ? e.message : String(e);
  }
  return turn;
}

/** What a batch of AI turns did. */
export interface AiRun {
  /** Clubs that had their turn, and clubs left for next time. */
  ran: number;
  skipped: number;
  weeksPlayed: number;
  turns: AiTurn[];
}

/**
 * Gives AI clubs their turns (D114), a few at a time, and stops starting
 * new ones once `budgetMs` has passed, so a run always finishes inside its
 * time limit. Clubs that waited longest go first, so the rest go first
 * next time. `weeksFor` says how many weeks each club tries.
 */
export async function runAiTurns(
  clubs: readonly Pick<AiClub, "id" | "energyUpdatedAt">[],
  weeksFor: (clubId: string) => number,
  {
    budgetMs,
    concurrency = 4,
    turn = aiClubTurn,
  }: {
    budgetMs: number;
    concurrency?: number;
    /** One club's turn (tests swap it out). */
    turn?: (clubId: string, weeks: number) => Promise<AiTurn>;
  },
): Promise<AiRun> {
  const started = Date.now();
  const queue = [...clubs].sort((a, b) =>
    a.energyUpdatedAt.localeCompare(b.energyUpdatedAt),
  );
  const turns: AiTurn[] = [];
  const worker = async () => {
    for (;;) {
      if (Date.now() - started > budgetMs) return;
      const club = queue.shift();
      if (!club) return;
      turns.push(await turn(club.id, weeksFor(club.id)));
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return {
    ran: turns.length,
    skipped: queue.length,
    weeksPlayed: turns.reduce((n, t) => n + t.weeksPlayed, 0),
    turns,
  };
}

/** One scheduled run, as the admin page shows it. */
export interface AiRunRecord {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  clubs: number;
  created: number;
  ran: number;
  skipped: number;
  weeksPlayed: number;
  errors: string[];
}

export async function listAiRuns(limit = 20): Promise<AiRunRecord[]> {
  const { data, error } = await createServiceClient()
    .from("ai_runs")
    .select(
      "id, started_at, finished_at, clubs, created, ran, skipped, weeks_played, errors",
    )
    .eq("sport", SOCCER)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    startedAt: r.started_at as string,
    finishedAt: (r.finished_at as string | null) ?? null,
    clubs: r.clubs as number,
    created: r.created as number,
    ran: r.ran as number,
    skipped: r.skipped as number,
    weeksPlayed: r.weeks_played as number,
    errors: (r.errors as string[]) ?? [],
  }));
}

/** What a scheduled run did, or why it did nothing. */
export type AiWorldRun =
  | { status: "disabled" }
  | (AiRunRecord & { status: "done" });

/**
 * One scheduled run of the AI world (D113, D114): adds clubs up to the
 * pool size (a few per run), then gives every AI club a turn of its pace's
 * share of weeks, longest-waiting first, within `budgetMs`. Logged in
 * ai_runs. Does nothing while the AI world is switched off.
 */
export async function runAiWorld({
  budgetMs,
  maxNewClubs = 40,
  concurrency = 6,
}: {
  budgetMs: number;
  maxNewClubs?: number;
  concurrency?: number;
}): Promise<AiWorldRun> {
  const started = Date.now();
  const settings = await loadAiSettings();
  if (!settings.enabled) return { status: "disabled" };
  const db = createServiceClient();
  const { data: row, error } = await db
    .from("ai_runs")
    .insert({ sport: SOCCER })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const runId = row.id as string;
  const errors: string[] = [];

  // Top up the pool, using at most a third of the time.
  const before = await listAiClubs();
  const wanted = Math.min(
    maxNewClubs,
    Math.max(0, settings.poolSize - before.length),
  );
  let created = 0;
  for (let i = 0; i < wanted && Date.now() - started < budgetMs / 3; i++) {
    try {
      await createAiClub();
      created++;
    } catch (e) {
      errors.push(`new club: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Every club's turn, at its pace (D114).
  const clubs = await listAiClubs();
  const pace = new Map(clubs.map((c) => [c.id, c.profile.pace]));
  const run = await runAiTurns(
    clubs,
    (id) =>
      weeksThisRun(
        createRng(`${runId}:${id}`),
        pace.get(id) ?? "normal",
        settings.runsPerDay,
      ),
    { budgetMs: Math.max(0, budgetMs - (Date.now() - started)), concurrency },
  );
  for (const t of run.turns)
    if (t.error) {
      const name = clubs.find((c) => c.id === t.teamId)?.name ?? t.teamId;
      errors.push(`${name}: ${t.error}`);
    }

  const record = {
    finished_at: new Date().toISOString(),
    clubs: clubs.length,
    created,
    ran: run.ran,
    skipped: run.skipped,
    weeks_played: run.weeksPlayed,
    errors: errors.slice(0, 40),
  };
  const { error: saveError } = await db
    .from("ai_runs")
    .update(record)
    .eq("id", runId);
  if (saveError) throw new Error(saveError.message);
  return {
    status: "done",
    id: runId,
    startedAt: new Date(started).toISOString(),
    finishedAt: record.finished_at,
    clubs: record.clubs,
    created,
    ran: run.ran,
    skipped: run.skipped,
    weeksPlayed: run.weeksPlayed,
    errors: record.errors,
  };
}
