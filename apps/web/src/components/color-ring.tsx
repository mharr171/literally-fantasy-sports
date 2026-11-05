import { colorMatchups, SOCCER_COLOR_CYCLE } from "@lfs/sport-soccer";
import { CHEMISTRY_COLORS } from "@/lib/chemistry-colors";

/**
 * Soccer's color cycle as a ring (D137, D138): each color points at the two
 * it beats, the next two round the rainbow.
 */
export function ColorRing() {
  const ring = SOCCER_COLOR_CYCLE;
  const size = 260;
  const c = size / 2;
  const r = 96;
  const at = (i: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / ring.length;
    return { x: c + r * Math.cos(angle), y: c + r * Math.sin(angle) };
  };
  const arrow = (from: number, to: number, key: string, far: boolean) => {
    const a = at(from);
    const b = at(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const trim = 24;
    const x1 = a.x + (dx / len) * trim;
    const y1 = a.y + (dy / len) * trim;
    const x2 = b.x - (dx / len) * (trim + 4);
    const y2 = b.y - (dy / len) * (trim + 4);
    return (
      <line
        key={key}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="currentColor"
        strokeOpacity={far ? 0.35 : 0.6}
        strokeWidth={far ? 1.5 : 2}
        markerEnd="url(#beats-arrow)"
      />
    );
  };
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-64 w-64 text-zinc-700 dark:text-zinc-300"
        role="img"
        aria-labelledby="color-ring-title"
      >
        <title id="color-ring-title">
          {ring
            .map((color) => {
              const name = CHEMISTRY_COLORS[color]?.name ?? "?";
              const beats = colorMatchups(color)
                .beats.map((b) => CHEMISTRY_COLORS[b]?.name ?? "?")
                .join(" and ");
              return `${name} beats ${beats}`;
            })
            .join(". ")}
        </title>
        <defs>
          <marker
            id="beats-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
          </marker>
        </defs>
        {ring.flatMap((_, i) => [
          arrow(i, (i + 1) % ring.length, `n${i}`, false),
          arrow(i, (i + 2) % ring.length, `f${i}`, true),
        ])}
        {ring.map((color, i) => {
          const p = at(i);
          const info = CHEMISTRY_COLORS[color];
          return (
            <g key={color}>
              <circle cx={p.x} cy={p.y} r={20} fill={info?.hex ?? "#a1a1aa"} />
              <text
                x={p.x}
                y={p.y + 5}
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                fill="#fff"
              >
                {info?.letter ?? "?"}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-center text-xs text-zinc-500">
        Each arrow points from a color to one it beats.
      </figcaption>
    </figure>
  );
}
