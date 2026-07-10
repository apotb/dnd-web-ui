"use client";

import { Tooltip } from "@/components/ui/tooltip";
import { useSpellRowTooltipOverride } from "@/components/spells/spell-row-tooltip-context";
import { cn } from "@/lib/utils";

export function GlossaryTerm({
  label,
  tooltip,
  className,
  ariaLabel,
}: {
  label: string;
  tooltip: string;
  className?: string;
  ariaLabel?: string;
}) {
  const setRowTooltip = useSpellRowTooltipOverride();
  const termClassName = cn(
    "cursor-default underline decoration-dotted underline-offset-2",
    className
  );

  if (setRowTooltip) {
    return (
      <span
        className={termClassName}
        aria-label={ariaLabel}
        onMouseEnter={() => setRowTooltip(tooltip)}
        onMouseLeave={() => setRowTooltip(null)}
      >
        {label}
      </span>
    );
  }

  return (
    <Tooltip content={tooltip}>
      <span className={termClassName} aria-label={ariaLabel}>
        {label}
      </span>
    </Tooltip>
  );
}
