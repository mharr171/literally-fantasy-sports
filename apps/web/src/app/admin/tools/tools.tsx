"use client";

import { useState, useTransition } from "react";
import {
  addFunds,
  deleteTeam,
  healSquad,
  playAhead,
  refillEnergy,
  type ToolResult,
} from "./actions";

const button =
  "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
const input =
  "w-28 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700";
const card =
  "flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800";

/** Testing controls for one team. */
export function Tools({
  teamId,
  teamName,
}: {
  teamId: string;
  teamName: string;
}) {
  const [result, setResult] = useState<ToolResult | null>(null);
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(50_000);
  const [weeks, setWeeks] = useState(5);
  const [confirm, setConfirm] = useState("");
  const run = (action: () => Promise<ToolResult>) =>
    start(async () => {
      setResult(null);
      setResult(await action());
    });

  return (
    <div className="flex flex-col gap-3">
      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={`rounded-md p-2 text-sm ${result.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"}`}
        >
          {result.ok ? result.message : result.error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={card}>
          <h3 className="font-semibold">Energy</h3>
          <p className="text-zinc-600 dark:text-zinc-400">
            Fill energy to the maximum.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => refillEnergy(teamId))}
            className={`self-start ${button}`}
          >
            Refill energy
          </button>
        </div>
        <div className={card}>
          <h3 className="font-semibold">Funds</h3>
          <p className="text-zinc-600 dark:text-zinc-400">
            Add funds, e.g. to test bought packs.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={1_000_000}
              step={1000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className={input}
              aria-label="Amount"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => addFunds(teamId, amount))}
              className={button}
            >
              Add funds
            </button>
          </div>
        </div>
        <div className={card}>
          <h3 className="font-semibold">Heal squad</h3>
          <p className="text-zinc-600 dark:text-zinc-400">
            Full fitness, no injuries, no bans.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => healSquad(teamId))}
            className={`self-start ${button}`}
          >
            Heal squad
          </button>
        </div>
        <div className={card}>
          <h3 className="font-semibold">Play ahead</h3>
          <p className="text-zinc-600 dark:text-zinc-400">
            Play weeks without spending energy, stopping when the season ends.
            The matchday squad must be valid.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={20}
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              className={input}
              aria-label="Weeks"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => playAhead(teamId, weeks))}
              className={button}
            >
              {pending
                ? "Working…"
                : `Play ${weeks} week${weeks === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
      <div className={`${card} border-red-300 dark:border-red-900`}>
        <h3 className="font-semibold text-red-700 dark:text-red-400">
          Delete team
        </h3>
        <p className="text-zinc-600 dark:text-zinc-400">
          Removes the team, its players, packs, seasons and ghosts for good, so
          its manager starts again from team creation. Type{" "}
          <strong>{teamName}</strong> to confirm.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`${input} w-56`}
            aria-label="Team name to confirm"
          />
          <button
            type="button"
            disabled={pending || confirm.trim() !== teamName}
            onClick={() => run(() => deleteTeam(teamId, confirm))}
            className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-40"
          >
            Delete team
          </button>
        </div>
      </div>
    </div>
  );
}
