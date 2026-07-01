"use client";

import { spellLevelBadgeLabel } from "@/lib/dnd/spell-display";
import { getSpellSlotAtLevel } from "@/lib/dnd/spellcasting";
import type { CharacterData } from "@/lib/schemas/character";
import { cn } from "@/lib/utils";

const SPELL_SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

interface SpellSlotSummaryTableProps {
  slots: CharacterData["spells"]["slots"];
  className?: string;
}

export function SpellSlotSummaryTable({ slots, className }: SpellSlotSummaryTableProps) {
  return (
    <table className={cn("spell-slot-summary-table w-full border-collapse text-center text-xs", className)}>
      <thead>
        <tr>
          {SPELL_SLOT_LEVELS.map((level) => (
            <th
              key={level}
              scope="col"
              className="border border-border px-1 py-1 font-medium text-muted-foreground"
            >
              {spellLevelBadgeLabel(level)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {SPELL_SLOT_LEVELS.map((level) => {
            const info = getSpellSlotAtLevel(slots, level);
            const value = info ? `${info.remaining}/${info.max}` : "—";
            return (
              <td
                key={level}
                className={cn(
                  "border border-border px-1 py-1 tabular-nums",
                  info && info.remaining === 0 ? "text-muted-foreground" : undefined
                )}
              >
                {value}
              </td>
            );
          })}
        </tr>
      </tbody>
    </table>
  );
}
