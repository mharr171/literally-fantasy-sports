"use client";

import { useEffect, useRef } from "react";

const ROWS = 25;
const COLS = 17;

/**
 * Draws an influence grid on a small pitch, attacking upward. Cells are
 * shaded relative to the grid's busiest cell.
 */
export function Heatmap({
  grid,
  width,
  className = "",
  overlay = false,
  label,
}: {
  grid: number[][] | null;
  /** CSS width in pixels; leave out to size the canvas with className. */
  width?: number;
  className?: string;
  /** Transparent background, for drawing over another pitch. */
  overlay?: boolean;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cell = 6;
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const w = COLS * cell;
    const h = ROWS * cell;
    ctx.clearRect(0, 0, w, h);
    if (!overlay) {
      ctx.fillStyle = "#166534";
      ctx.fillRect(0, 0, w, h);
    }
    if (grid) {
      const max = Math.max(1e-9, ...grid.flat());
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          const v = (grid[r]?.[c] ?? 0) / max;
          if (v <= 0.02) continue;
          // Own goal at the bottom: row 0 is drawn last.
          ctx.fillStyle = `rgba(250, 204, 21, ${Math.min(0.95, v * 0.9)})`;
          ctx.fillRect(c * cell, (ROWS - 1 - r) * cell, cell, cell);
        }
    }
    if (!overlay) {
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    }
  }, [grid, overlay]);
  return (
    <canvas
      ref={ref}
      width={COLS * cell}
      height={ROWS * cell}
      role="img"
      aria-label={label}
      style={width ? { width, height: (width * ROWS) / COLS } : undefined}
      className={`rounded-sm ${className}`}
    />
  );
}
