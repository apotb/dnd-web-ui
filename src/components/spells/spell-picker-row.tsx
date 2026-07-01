"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { SpellGlossaryMeta } from "@/components/spells/spell-glossary-meta";
import { SpellRowTooltipContext } from "@/components/spells/spell-row-tooltip-context";
import type { CatalogSpellRow } from "@/lib/content/catalog-client";
import { formatSpellPickerTooltip, spellLevelBadgeLabel } from "@/lib/dnd/spell-display";
import { cn } from "@/lib/utils";
import { useState } from "react";

/** Shared selected/hover styles for spell and slot picker rows. */
export function spellPickerItemClasses({
  selected = false,
  interactive = true,
  className,
}: {
  selected?: boolean;
  interactive?: boolean;
  className?: string;
}): string {
  return cn(
    "rounded-md border p-3 text-left text-sm transition-all",
    interactive &&
      !selected &&
      "hover:border-muted-foreground/35 hover:bg-accent/80",
    selected
      ? "border-2 border-sky-400 bg-sky-500/20 font-semibold text-foreground ring-2 ring-sky-400/55 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.65),0_0_16px_rgba(56,189,248,0.32)]"
      : "border-border bg-transparent",
    className
  );
}

interface SpellPickerRowProps {
  spell: CatalogSpellRow;
  tooltip?: string;
  onSelect?: () => void;
  selected?: boolean;
  disabled?: boolean;
  /** Highlight material components inline (combat spell pickers). */
  showMaterialLine?: boolean;
}

export function SpellPickerRow({
  spell,
  tooltip,
  onSelect,
  selected,
  disabled,
  showMaterialLine = false,
}: SpellPickerRowProps) {
  const mainContent = tooltip ?? formatSpellPickerTooltip(spell);
  const [tooltipOverride, setTooltipOverride] = useState<string | null>(null);
  const displayContent = tooltipOverride ?? mainContent;
  const interactive = onSelect != null && !disabled;

  const body = (
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm leading-snug">
          {spell.name}
          {spell.ritual ? " ◆" : ""}
        </span>
        <Badge variant="outline" className="text-xs shrink-0">
          {spellLevelBadgeLabel(spell.level)}
        </Badge>
      </div>
      <div className="mt-0.5">
        <SpellGlossaryMeta spell={spell} showMaterialLine={showMaterialLine} />
      </div>
    </div>
  );

  const className = cn(
    "h-full w-full flex items-start",
    spellPickerItemClasses({ selected, interactive }),
    disabled && "cursor-not-allowed opacity-50"
  );

  const row = (
    <SpellRowTooltipContext.Provider value={setTooltipOverride}>
      {body}
    </SpellRowTooltipContext.Provider>
  );

  if (!interactive) {
    return (
      <Tooltip content={displayContent}>
        <div className={className} onMouseLeave={() => setTooltipOverride(null)}>
          {row}
        </div>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={displayContent}>
      <button
        type="button"
        className={className}
        onClick={onSelect}
        disabled={disabled}
        onMouseLeave={() => setTooltipOverride(null)}
      >
        {row}
      </button>
    </Tooltip>
  );
}

export function SpellLevelGroupHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {label}
    </p>
  );
}
