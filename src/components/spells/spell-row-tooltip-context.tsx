"use client";

import { createContext, useContext } from "react";

/** When set, spell picker rows show this instead of the full spell tooltip. */
export const SpellRowTooltipContext = createContext<
  ((content: string | null) => void) | null
>(null);

export function useSpellRowTooltipOverride() {
  return useContext(SpellRowTooltipContext);
}
