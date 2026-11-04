/**
 * A match's events as a play-by-play log (M5): one line per moment, with
 * names and the score after it, for result pages and their replay.
 */
import type { Side } from "@lfs/core";
import type { SoccerEvent, SubReason } from "./match";

export type PlayKind =
  | "goal"
  | "shot"
  | "card"
  | "sub"
  | "injury"
  | "move"
  | "penalty"
  | "period";

export interface PlayLine {
  minute: number;
  /** The team it's about; null for kick-off, extra time and full time. */
  side: Side | null;
  kind: PlayKind;
  text: string;
  /** Score after this moment (open play and extra time). */
  score: Record<Side, number>;
  /** Shoot-out score after this moment, once the shoot-out has started. */
  penalties?: Record<Side, number>;
}

const SUB_REASONS: Record<SubReason, string> = {
  plan: "",
  injury: " (injury)",
  tired: " (tired)",
  keeper: " (keeper sent off)",
};

/**
 * The log for a match. `names` maps player ids to names and `teams` gives
 * the clubs' names. "Chance" markers are left out: each is followed by the
 * shot it led to.
 */
export function playByPlay(
  events: readonly SoccerEvent[],
  names: ReadonlyMap<string, string>,
  teams: Record<Side, string>,
): PlayLine[] {
  const who = (id: string) => names.get(id) ?? "Unknown";
  const score = { home: 0, away: 0 };
  let penalties: Record<Side, number> | undefined;
  const lines: PlayLine[] = [
    {
      minute: 0,
      side: null,
      kind: "period",
      text: "Kick-off.",
      score: { ...score },
    },
  ];
  const add = (
    e: { minute: number },
    side: Side | null,
    kind: PlayKind,
    text: string,
  ) => {
    const line: PlayLine = {
      minute: e.minute,
      side,
      kind,
      text,
      score: { ...score },
    };
    if (penalties) line.penalties = { ...penalties };
    lines.push(line);
  };
  for (const e of events) {
    switch (e.type) {
      case "chance":
        break;
      case "goal":
        score[e.side]++;
        add(
          e,
          e.side,
          "goal",
          `Goal! ${who(e.playerId)} scores for ${teams[e.side]}.`,
        );
        break;
      case "saved":
        add(e, e.side, "shot", `${who(e.playerId)} shoots: saved.`);
        break;
      case "missed":
        add(e, e.side, "shot", `${who(e.playerId)} shoots: off target.`);
        break;
      case "sub":
        add(
          e,
          e.side,
          "sub",
          `${who(e.inId)} comes on for ${who(e.outId)}${SUB_REASONS[e.reason]}.`,
        );
        break;
      case "position_change":
        add(e, e.side, "move", `${who(e.playerId)} moves to ${e.slot}.`);
        break;
      case "injury":
        add(
          e,
          e.side,
          "injury",
          `${who(e.playerId)} is injured: out ${e.weeks} week${e.weeks === 1 ? "" : "s"}.`,
        );
        break;
      case "yellow":
        add(e, e.side, "card", `${who(e.playerId)} is booked.`);
        break;
      case "red":
        add(
          e,
          e.side,
          "card",
          `${who(e.playerId)} is sent off${e.secondYellow ? " (second yellow)" : ""}.`,
        );
        break;
      case "extra_time":
        add(e, null, "period", "Level after 90 minutes: extra time.");
        break;
      case "penalty":
        if (!penalties) {
          penalties = { home: 0, away: 0 };
          add(e, null, "period", "Still level: penalties.");
        }
        if (e.scored) penalties[e.side]++;
        add(
          e,
          e.side,
          "penalty",
          `${who(e.playerId)} ${e.scored ? "scores" : "misses"} in the shoot-out.`,
        );
        break;
      case "full_time":
        add(e, null, "period", "Full time.");
        break;
    }
  }
  return lines;
}
