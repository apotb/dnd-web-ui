"use client";

import { GlossaryTerm } from "@/components/ui/glossary-term";
import type { CheckRollMode } from "@/lib/character/check-roll-mode";

export function CheckRollModeIndicator({
  mode,
  tooltip,
}: {
  mode: Exclude<CheckRollMode, null>;
  tooltip: string;
}) {
  const label = mode === "advantage" ? "A" : "D";
  const ariaLabel =
    mode === "advantage" ? "Advantage on this check" : "Disadvantage on this check";

  return (
    <GlossaryTerm
      label={label}
      tooltip={tooltip}
      ariaLabel={ariaLabel}
      className="font-mono text-xs font-medium shrink-0"
    />
  );
}
