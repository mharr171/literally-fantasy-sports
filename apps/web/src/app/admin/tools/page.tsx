import { currentEnergy } from "@lfs/core";
import { isAvailable } from "@lfs/sport-soccer";
import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { loadLatestSeason } from "@/lib/season";
import { loadEnergySettings } from "@/lib/sport-settings";
import { createServiceClient } from "@/lib/supabase/service";
import { listTeams, loadMyTeam, loadRoster, loadTeamById } from "@/lib/team";
import { TeamPicker } from "../team-picker";
import { SoftReset } from "./soft-reset";
import { Tools } from "./tools";

export const metadata: Metadata = { title: "Testing tools" };

// Playing ahead can run up to 20 weeks in one go.
export const maxDuration = 60;

export default function ToolsPage({ searchParams }: PageProps<"/admin/tools">) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Testing tools</h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Shortcuts for testing a team. Every use is logged below, so boosted
          test teams stay easy to spot.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Content({
  searchParams,
}: Pick<PageProps<"/admin/tools">, "searchParams">) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const requested = Array.isArray(params.team) ? params.team[0] : params.team;
  const [teams, mine] = await Promise.all([listTeams(), loadMyTeam(admin.id)]);
  const teamId = requested ?? mine?.id ?? teams[0]?.id;
  const team = teamId ? await loadTeamById(teamId) : null;

  return (
    <div className="flex flex-col gap-4">
      {teams.length === 0 ? (
        <p className="text-sm text-zinc-500">No teams yet.</p>
      ) : (
        <TeamPicker
          value={team?.id ?? null}
          teams={teams.map((t) => ({
            value: t.id,
            label: t.name,
            hint:
              t.id === mine?.id
                ? "(you)"
                : t.kind === "ai"
                  ? "(AI)"
                  : undefined,
            group: t.kind === "ai" ? "ai" : "real",
          }))}
          hrefPrefix="/admin/tools?team="
        />
      )}
      {team && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Showing <strong>{team.name}</strong>
          {team.kind === "ai" ? " (AI)" : ""}
          {team.id === mine?.id ? " (you)" : ""}
        </p>
      )}
      {team && <TeamStatus teamId={team.id} />}
      {team && <Tools key={team.id} teamId={team.id} teamName={team.name} />}
      <SoftReset backupUrl="https://github.com/mharr171/literally-fantasy-sports/actions/workflows/backup.yml" />
      <Log />
    </div>
  );
}

async function TeamStatus({ teamId }: { teamId: string }) {
  const [team, roster, season, energy] = await Promise.all([
    loadTeamById(teamId),
    loadRoster(teamId),
    loadLatestSeason(teamId),
    loadEnergySettings("soccer"),
  ]);
  if (!team) return null;
  const now = currentEnergy(
    { energy: team.energy, updatedAt: new Date(team.energyUpdatedAt) },
    new Date(),
    energy,
  );
  const out = roster.filter((p) => !isAvailable(p.condition)).length;
  const fitness = roster.length
    ? Math.round(
        roster.reduce((a, p) => a + p.condition.fitness, 0) / roster.length,
      )
    : 100;
  const item = (label: string, value: string) => (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 p-4 text-sm sm:grid-cols-6 dark:border-zinc-800">
      {item("Energy", energy.enabled ? `${now.energy}/${energy.max}` : "off")}
      {item("Funds", team.funds.toLocaleString("en-US"))}
      {item("Elo", String(team.elo))}
      {item("Players", String(roster.length))}
      {item("Fitness / out", `${fitness}% / ${out}`)}
      {item(
        "Season",
        season
          ? `${season.number}: ${season.status === "regular" ? `week ${season.week}` : season.status}`
          : "none",
      )}
    </dl>
  );
}

async function Log() {
  const { data } = await createServiceClient()
    .from("admin_actions")
    .select("id, team_name, action, details, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const rows = data ?? [];
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Recent admin actions</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing yet.</p>
      ) : (
        <ul className="flex flex-col text-sm">
          {rows.map((r) => (
            <li
              key={r.id}
              className="border-t border-zinc-200 py-1 dark:border-zinc-800"
            >
              <span className="text-zinc-500">
                {new Date(r.created_at).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>{" "}
              · {r.team_name} · <code>{r.action}</code>
              {r.details && Object.keys(r.details).length > 0 && (
                <span className="text-zinc-500">
                  {" "}
                  {JSON.stringify(r.details)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
