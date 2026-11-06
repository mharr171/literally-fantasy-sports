"use client";

import {
  type Position,
  type StoredTemplates,
  type StoredVariants,
  variantAt,
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
 * The grid a player uses in a slot: their own variant at their primary or
 * secondary position (D84, D98, D136), the slot's default otherwise. Null
 * without a provider.
 */
export function useTemplate(
  slot: Position,
  player?: Parameters<typeof variantAt>[0],
): number[][] | null {
  const value = useContext(TemplatesContext);
  if (!value) return null;
  const own = player ? variantAt(player, slot) : undefined;
  const variant = own ? value.variants[slot]?.[own] : undefined;
  return variant ?? value.templates[slot];
}

export function useTemplates(): TemplatesValue | null {
  return useContext(TemplatesContext);
}
