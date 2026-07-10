"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { SpellLevelGroupHeader, SpellPickerRow, spellPickerItemClasses } from "@/components/spells/spell-picker-row";
import { SpellSlotSummaryTable } from "@/components/spells/spell-slot-summary-table";
import { SpellMaterialLine } from "@/components/spells/spell-glossary-meta";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CombatCastableSpell } from "@/lib/dnd/combat-spells";
import {
  combatCastableSpellToCatalogRow,
  formatCastSlotOptionLabel,
  formatSpellPickerCombatTooltip,
  getDefaultCastSlotLevel,
  getEligibleCastSlotLevels,
  listCombatCastableActionSpellsForPicker,
  listCombatCastableLeveledSpells,
} from "@/lib/dnd/combat-spells";
import { spellLevelLabel } from "@/lib/dnd/spell-display";
import {
  SpellMaterialPicker,
  isSpellMaterialSelectionComplete,
  type SpellMaterialSelection,
} from "@/components/combat/spell-material-picker";
import type { Item } from "@/lib/schemas/item";
import type { CharacterData } from "@/lib/schemas/character";
import { cn } from "@/lib/utils";

export interface CombatSpellPickerSelection {
  entry: CombatCastableSpell;
  castSlotLevel: number;
  materialSelections: SpellMaterialSelection[];
}

interface CombatSpellPickerModalProps {
  character: CharacterData;
  catalogItems: Record<string, Item>;
  castingCost: "action" | "bonus-action";
  /** When set, skip spell list and only ask for slot level. */
  preselectedEntry?: CombatCastableSpell;
  onCancel: () => void;
  onConfirm: (selection: CombatSpellPickerSelection) => void;
}

function groupSpellsByLevel(
  spells: CombatCastableSpell[]
): { level: number; label: string; spells: CombatCastableSpell[] }[] {
  const byLevel = new Map<number, CombatCastableSpell[]>();
  for (const entry of spells) {
    const list = byLevel.get(entry.spell.level) ?? [];
    list.push(entry);
    byLevel.set(entry.spell.level, list);
  }

  return [...byLevel.keys()]
    .sort((a, b) => a - b)
    .map((level) => ({
      level,
      label: spellLevelLabel(level),
      spells: (byLevel.get(level) ?? []).sort((a, b) =>
        a.spell.name.localeCompare(b.spell.name, undefined, { sensitivity: "base" })
      ),
    }));
}

export function CombatSpellPickerModal({
  character,
  catalogItems,
  castingCost,
  preselectedEntry,
  onCancel,
  onConfirm,
}: CombatSpellPickerModalProps) {
  const spells = useMemo(() => {
    if (preselectedEntry) return [preselectedEntry];
    return castingCost === "action"
      ? listCombatCastableActionSpellsForPicker(character, catalogItems)
      : listCombatCastableLeveledSpells(character, { castingCost, catalogItems });
  }, [character, catalogItems, castingCost, preselectedEntry]);
  const groups = useMemo(() => groupSpellsByLevel(spells), [spells]);

  const [selected, setSelected] = useState<CombatCastableSpell | null>(
    () => preselectedEntry ?? null
  );
  const [castSlotLevel, setCastSlotLevel] = useState<number | null>(() =>
    preselectedEntry
      ? getDefaultCastSlotLevel(character.spells.slots, preselectedEntry.spell.level)
      : null
  );

  const [materialSelections, setMaterialSelections] = useState<SpellMaterialSelection[]>([]);

  const slotOnly = preselectedEntry != null;
  const step = selected == null ? "spell" : "slot";
  const eligibleSlots = selected
    ? getEligibleCastSlotLevels(character.spells.slots, selected.spell.level)
    : [];
  const showSlotTable = step === "spell" && spells.some((entry) => entry.spell.level > 0);

  function handleSelectSpell(entry: CombatCastableSpell) {
    if (entry.spell.level === 0) {
      setSelected(entry);
      setCastSlotLevel(0);
      setMaterialSelections([]);
      return;
    }
    setSelected(entry);
    setMaterialSelections([]);
    setCastSlotLevel(
      getDefaultCastSlotLevel(character.spells.slots, entry.spell.level)
    );
  }

  function handleBack() {
    if (slotOnly) {
      onCancel();
      return;
    }
    setSelected(null);
    setCastSlotLevel(null);
  }

  function handleConfirm() {
    if (!selected || castSlotLevel == null) return;
    onConfirm({ entry: selected, castSlotLevel, materialSelections });
  }

  const canConfirm =
    selected != null &&
    castSlotLevel != null &&
    isSpellMaterialSelectionComplete(
      character,
      selected.slug,
      catalogItems,
      materialSelections
    );

  const title =
    step === "slot" && selected
      ? selected.spell.name
      : "Cast a Spell";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {step === "slot" ? (
            <p className="text-sm text-muted-foreground">
              Choose the spell slot level to cast at.
            </p>
          ) : null}
          {showSlotTable ? (
            <SpellSlotSummaryTable slots={character.spells.slots} className="mt-2" />
          ) : null}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {step === "spell" ? (
            spells.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No spells available.</p>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => (
                  <div key={group.level} className="space-y-2">
                    <SpellLevelGroupHeader label={group.label} />
                    <div className="grid grid-cols-2 gap-2">
                      {group.spells.map((entry) => (
                        <SpellPickerRow
                          key={entry.spell.id}
                          spell={combatCastableSpellToCatalogRow(entry)}
                          tooltip={formatSpellPickerCombatTooltip(entry, character)}
                          showMaterialLine
                          onSelect={() => handleSelectSpell(entry)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-4">
              {selected ? (
                <SpellMaterialLine components={selected.catalog.components ?? ""} />
              ) : null}
              {selected ? (
                <SpellMaterialPicker
                  character={character}
                  spellSlug={selected.slug}
                  catalogItems={catalogItems}
                  value={materialSelections}
                  onChange={setMaterialSelections}
                />
              ) : null}
              {selected && selected.spell.level > 0 ? (
                <div className="space-y-2">
              {eligibleSlots.map((slot) => {
                const isSelected = castSlotLevel === slot.slotLevel;
                return (
                <button
                  key={slot.slotLevel}
                  type="button"
                  className={spellPickerItemClasses({
                    selected: isSelected,
                    className: "w-full flex items-center gap-3",
                  })}
                  onClick={() => setCastSlotLevel(slot.slotLevel)}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      isSelected
                        ? "border-sky-300 bg-sky-400 text-slate-950"
                        : "border-muted-foreground/40 bg-transparent"
                    )}
                    aria-hidden
                  >
                    {isSelected ? <Check className="size-3.5 stroke-[3]" /> : null}
                  </span>
                  <span>{formatCastSlotOptionLabel(slot)}</span>
                </button>
                );
              })}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          {step === "slot" ? (
            <Button type="button" variant="outline" onClick={handleBack}>
              {slotOnly ? "Cancel" : "Back"}
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {step === "slot" ? (
            <Button
              type="button"
              disabled={!canConfirm}
              onClick={handleConfirm}
            >
              Continue
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
