/**
 * Seeded pseudo-random numbers. Every random roll in the engine comes from an
 * `Rng`, so the same seed always produces the same match (replays, D7/Step 4).
 *
 * Generator: mulberry32 (32-bit state, fast, good enough for games).
 * String seeds are hashed to 32 bits with cyrb53's low word.
 */

export type Seed = number | string;

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  float(min: number, max: number): number;
  /** True with probability `p` (clamped to [0, 1]). */
  chance(p: number): boolean;
  /** One element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Index chosen with probability proportional to its weight. */
  weightedIndex(weights: readonly number[]): number;
  /** A shuffled copy of the array (Fisher–Yates); the input is not changed. */
  shuffle<T>(items: readonly T[]): T[];
  /** Normally distributed value (Box–Muller). */
  normal(mean?: number, sd?: number): number;
  /**
   * An independent generator derived from this one's seed and a label, e.g.
   * `rng.fork("injuries")`. Forks don't consume numbers from the parent, so
   * adding a new fork doesn't change existing rolls.
   */
  fork(label: string): Rng;
}

/** Hashes a string to an unsigned 32-bit integer (cyrb53, low word). */
export function hashSeed(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return h1 >>> 0;
}

function normalizeSeed(seed: Seed): number {
  if (typeof seed === "string") return hashSeed(seed);
  if (!Number.isFinite(seed)) throw new RangeError(`Invalid seed: ${seed}`);
  return Math.trunc(seed) >>> 0;
}

export function createRng(seed: Seed): Rng {
  const base = normalizeSeed(seed);
  let state = base;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Invalid int range [${min}, ${max}]`);
    }
    return min + Math.floor(next() * (max - min + 1));
  };

  return {
    next,
    int,
    float(min, max) {
      if (!(max >= min)) throw new RangeError(`Invalid range [${min}, ${max})`);
      return min + next() * (max - min);
    },
    chance(p) {
      return next() < Math.min(1, Math.max(0, p));
    },
    pick(items) {
      if (items.length === 0)
        throw new RangeError("Cannot pick from an empty array");
      return items[int(0, items.length - 1)] as (typeof items)[number];
    },
    weightedIndex(weights) {
      let total = 0;
      for (const w of weights) {
        if (!(w >= 0) || !Number.isFinite(w)) {
          throw new RangeError(`Invalid weight: ${w}`);
        }
        total += w;
      }
      if (total <= 0)
        throw new RangeError("Weights must include a positive value");
      let roll = next() * total;
      let lastPositive = -1;
      for (let i = 0; i < weights.length; i++) {
        const w = weights[i] as number;
        if (w > 0) lastPositive = i;
        roll -= w;
        if (roll < 0) return i;
      }
      // Only reachable through floating-point rounding: use the last index
      // that could have been chosen.
      /* v8 ignore next */
      return lastPositive;
    },
    shuffle(items) {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [
          out[j] as (typeof out)[number],
          out[i] as (typeof out)[number],
        ];
      }
      return out;
    },
    normal(mean = 0, sd = 1) {
      // 1 - next() is in (0, 1], so log() is finite.
      const u = 1 - next();
      const v = next();
      return (
        mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
      );
    },
    fork(label) {
      return createRng(hashSeed(`${base}:${label}`));
    },
  };
}
