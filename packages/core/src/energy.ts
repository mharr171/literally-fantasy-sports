/**
 * Energy (D17, D72, D93): playing a game week costs 1 energy, which refills
 * one point at a time up to a maximum. Each sport has its own energy and
 * its own settings, and admins can switch the requirement off per sport.
 */

export interface EnergySettings {
  enabled: boolean;
  /** Minutes for one point to come back. */
  refillMinutes: number;
  max: number;
}

/** Balance defaults (D93): 1 point every 15 minutes, up to 3. */
export const DEFAULT_ENERGY_SETTINGS: EnergySettings = {
  enabled: true,
  refillMinutes: 15,
  max: 3,
};

export interface StoredEnergy {
  energy: number;
  /** When the stored value was last right: refills count from here. */
  updatedAt: Date;
}

export interface EnergyNow {
  energy: number;
  /** The anchor to store with `energy` so refills carry on correctly. */
  updatedAt: Date;
  /** When the next point arrives, or null when full. */
  nextAt: Date | null;
}

/** Energy right now, with refills since it was stored. */
export function currentEnergy(
  stored: StoredEnergy,
  now: Date,
  settings: EnergySettings = DEFAULT_ENERGY_SETTINGS,
): EnergyNow {
  const interval = settings.refillMinutes * 60_000;
  if (!(interval > 0)) throw new RangeError("Refill time must be positive.");
  const start = Math.min(stored.energy, settings.max);
  if (start >= settings.max)
    return { energy: settings.max, updatedAt: now, nextAt: null };
  const elapsed = Math.max(0, now.getTime() - stored.updatedAt.getTime());
  const gained = Math.floor(elapsed / interval);
  const energy = Math.min(settings.max, start + gained);
  if (energy >= settings.max) return { energy, updatedAt: now, nextAt: null };
  const updatedAt = new Date(stored.updatedAt.getTime() + gained * interval);
  return {
    energy,
    updatedAt,
    nextAt: new Date(updatedAt.getTime() + interval),
  };
}

/**
 * Spends one point. Spending from full starts the refill clock now;
 * otherwise the clock keeps running from the last refill.
 */
export function spendEnergy(
  stored: StoredEnergy,
  now: Date,
  settings: EnergySettings = DEFAULT_ENERGY_SETTINGS,
): StoredEnergy {
  const current = currentEnergy(stored, now, settings);
  if (current.energy < 1) throw new Error("Out of energy.");
  return { energy: current.energy - 1, updatedAt: current.updatedAt };
}
