"use client";

import type { BattleTooltipParts } from "@/lib/combat/battle-tooltip";
import { cn } from "@/lib/utils";

interface CombatBattleTooltipSummaryProps {
  parts: BattleTooltipParts;
  className?: string;
  /** Hide the title line when the modal heading already shows it. */
  omitTitle?: boolean;
}

export function CombatBattleTooltipSummary({
  parts,
  className,
  omitTitle = false,
}: CombatBattleTooltipSummaryProps) {
  const hasContent =
    (!omitTitle && parts.title) ||
    parts.header ||
    parts.metadata.length > 0 ||
    parts.description ||
    (parts.footer?.length ?? 0) > 0;

  if (!hasContent) return null;

  return (
    <div className={cn("combat-battle-tooltip-summary", className)}>
      {!omitTitle && parts.title ? (
        <p className="combat-battle-tooltip-title">{parts.title}</p>
      ) : null}
      {parts.header ? <p className="combat-battle-tooltip-header">{parts.header}</p> : null}
      {parts.metadata.map((line, index) => (
        <p key={`meta-${index}`} className="combat-battle-tooltip-meta">
          {line}
        </p>
      ))}
      {parts.description ? (
        <p className="combat-battle-tooltip-description">{parts.description}</p>
      ) : null}
      {parts.footer?.map((line, index) => (
        <p key={`footer-${index}`} className="combat-battle-tooltip-footer">
          {line}
        </p>
      ))}
    </div>
  );
}
