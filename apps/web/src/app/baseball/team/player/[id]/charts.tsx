import type { ChartBattedBall, ChartPitch } from "@lfs/sport-baseball";

const CELL = 36;

/** A colour for a cell: blue below 1 (cold), red above (hot). */
function heat(v: number, scale: number): string {
  const t = Math.max(-1, Math.min(1, (v - 1) / scale));
  return t >= 0
    ? `rgba(239, 68, 68, ${0.12 + t * 0.6})`
    : `rgba(59, 130, 246, ${0.12 - t * 0.6})`;
}

const CALL_COLOR: Record<ChartPitch["call"], string> = {
  ball: "#22c55e",
  called: "#f59e0b",
  swinging: "#ef4444",
  foul: "#a855f7",
  inPlay: "#0ea5e9",
};

/**
 * The 5 × 5 zone from the catcher's view: the middle 3 × 3 is the strike
 * zone. Cells shade by the grid (hot and cold, or where he aims) and the
 * recent pitches sit on top, coloured by call.
 */
export function ZoneChart({
  grid,
  pitches,
  mode,
}: {
  grid: number[][];
  pitches: ChartPitch[];
  mode: "batter" | "pitcher";
}) {
  const size = CELL * 5;
  // A pitcher's weights are relative: shade by share of the busiest cell.
  const max = Math.max(...grid.flat());
  const value = (v: number) => (mode === "pitcher" ? 0.5 + v / max : v);
  // Several pitches share a cell: spread them in a small spiral.
  const seen = new Map<string, number>();
  return (
    <svg
      viewBox={`-4 -4 ${size + 8} ${size + 8}`}
      className="h-56 w-56"
      role="img"
    >
      <title>
        {mode === "batter"
          ? "Hot and cold zones, catcher's view"
          : "Where he aims, catcher's view"}
      </title>
      {grid.map((row, r) =>
        row.map((v, c) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed grid
            key={`${r}-${c}`}
            x={c * CELL}
            y={r * CELL}
            width={CELL}
            height={CELL}
            fill={heat(value(v), mode === "pitcher" ? 0.6 : 0.3)}
            className="stroke-zinc-200 dark:stroke-zinc-700"
          />
        )),
      )}
      <rect
        x={CELL}
        y={CELL}
        width={CELL * 3}
        height={CELL * 3}
        fill="none"
        className="stroke-zinc-700 dark:stroke-zinc-300"
        strokeWidth={2}
      />
      {pitches.map((p, i) => {
        const key = `${p.row}-${p.col}`;
        const k = seen.get(key) ?? 0;
        seen.set(key, k + 1);
        const a = k * 2.4;
        const d = Math.min(14, 3 * Math.sqrt(k));
        return (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: pitches in order
            key={i}
            cx={p.col * CELL + CELL / 2 + Math.cos(a) * d}
            cy={p.row * CELL + CELL / 2 + Math.sin(a) * d}
            r={2.6}
            fill={CALL_COLOR[p.call]}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

export const CALL_NAMES: Record<ChartPitch["call"], string> = {
  ball: "Ball",
  called: "Called strike",
  swinging: "Swinging strike",
  foul: "Foul",
  inPlay: "In play",
};
export { CALL_COLOR };

const HIT = new Set(["single", "double", "triple", "homeRun"]);

/**
 * The spray chart: fair territory as a fan, left-field line to right. Each
 * of the 12 directions shades by his spray profile; recent batted balls
 * sit where they landed (hits filled, outs hollow).
 */
export function SprayChart({
  spray,
  batted,
}: {
  spray: number[];
  batted: ChartBattedBall[];
}) {
  const R = 150;
  const cx = 160;
  const cy = 170;
  const max = Math.max(...spray);
  const angle = (d: number) => (-45 + (d / 12) * 90) * (Math.PI / 180);
  const point = (deg: number, r: number) => [
    cx + Math.sin(deg) * r,
    cy - Math.cos(deg) * r,
  ];
  return (
    <svg viewBox="0 0 320 180" className="h-48 w-full max-w-sm" role="img">
      <title>Spray chart, from home plate</title>
      {spray.map((w, d) => {
        const [x1, y1] = point(angle(d), R);
        const [x2, y2] = point(angle(d + 1), R);
        return (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed directions
            key={d}
            d={`M${cx} ${cy} L${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2} Z`}
            fill={`rgba(16, 185, 129, ${0.08 + (w / max) * 0.45})`}
            className="stroke-emerald-700/20"
          />
        );
      })}
      {batted.map((b, i) => {
        const [x, y] = point(
          angle(b.direction + 0.5),
          ((b.depth + 0.5) / 8) * R,
        );
        const hit = HIT.has(b.result);
        return (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: balls in order
            key={i}
            cx={x}
            cy={y}
            r={3.5}
            fill={hit ? "#0ea5e9" : "none"}
            stroke={hit ? "#0369a1" : "#52525b"}
            strokeWidth={1.4}
          >
            <title>{b.result}</title>
          </circle>
        );
      })}
    </svg>
  );
}
