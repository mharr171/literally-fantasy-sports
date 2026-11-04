"use client";

import type {
  Position,
  StoredTemplates,
  StoredVariants,
} from "@lfs/sport-soccer";
import { createContext, type ReactNode, useContext } from "react";

export interface TemplatesValue {
  templates: StoredTemplates;
  variants: StoredVariants;
}

const TemplatesContext = createContext<TemplatesValue | null>(null);

/** Makes the live influence templates available to player cards and heatmaps. */
export function TemplatesProvider({
  value,
  children,
}: {
  value: TemplatesValue;
  children: ReactNode;
}) {
  return (
    <TemplatesContext.Provider value={value}>
      {children}
    </TemplatesContext.Provider>
  );
}

/**
 * The grid a player uses in a slot: their own variant at their primary
 * position (D84, D98), the slot's default otherwise. Null without a provider.
 */
export function useTemplate(
  slot: Position,
  player?: { primaryPosition: Position; templateVariant?: string },
): number[][] | null {
  const value = useContext(TemplatesContext);
  if (!value) return null;
  const variant =
    player?.templateVariant && player.primaryPosition === slot
      ? value.variants[slot]?.[player.templateVariant]
      : undefined;
  return variant ?? value.templates[slot];
}

export function useTemplates(): TemplatesValue | null {
  return useContext(TemplatesContext);
}
