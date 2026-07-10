"use client";

import { useMemo } from "react";
import type { CharacterData } from "@/lib/schemas/character";
import type { Item } from "@/lib/schemas/item";
import { getSpellMaterialSpec } from "@/lib/dnd/spell-material-requirements";
import { resolveSpellMaterialEligibility } from "@/lib/dnd/spell-materials";
import { getSpell } from "@/lib/dnd/phb/spells";

export interface SpellMaterialSelection {
  groupIndex: number;
  inventoryItemId: string;
}

interface SpellMaterialPickerProps {
  character: CharacterData;
  spellSlug: string;
  catalogItems: Record<string, Item>;
  value: SpellMaterialSelection[];
  onChange: (selections: SpellMaterialSelection[]) => void;
}

export function SpellMaterialPicker({
  character,
  spellSlug,
  catalogItems,
  value,
  onChange,
}: SpellMaterialPickerProps) {
  const catalog = getSpell(spellSlug);
  const spec = getSpellMaterialSpec(spellSlug);
  const eligibility = useMemo(
    () =>
      resolveSpellMaterialEligibility(
        character.inventory.items,
        spellSlug,
        catalogItems,
        catalog?.components
      ),
    [character.inventory.items, spellSlug, catalogItems, catalog?.components]
  );

  if (!spec || spec.choiceGroups.length === 0) return null;
  if (eligibility.satisfiedByFocus) {
    return (
      <p className="text-sm text-muted-foreground">
        Material components satisfied by your spellcasting focus or component pouch.
      </p>
    );
  }

  function updateSelection(groupIndex: number, inventoryItemId: string) {
    const next = [
      ...value.filter((entry) => entry.groupIndex !== groupIndex),
      { groupIndex, inventoryItemId },
    ];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {eligibility.groups.map((group) => {
        const selected = value.find((entry) => entry.groupIndex === group.groupIndex);
        return (
          <div key={group.groupIndex} className="space-y-1">
            <label className="text-sm font-medium" htmlFor={`material-${spellSlug}-${group.groupIndex}`}>
              {group.label}
              {group.consumed ? " (consumed)" : ""}
            </label>
            {group.options.length === 0 ? (
              <p className="text-sm text-destructive">Not in inventory.</p>
            ) : (
              <select
                id={`material-${spellSlug}-${group.groupIndex}`}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selected?.inventoryItemId ?? ""}
                onChange={(event) =>
                  updateSelection(group.groupIndex, event.target.value)
                }
              >
                <option value="" disabled>
                  Choose material…
                </option>
                {group.options.map((option) => (
                  <option key={option.inventoryItemId} value={option.inventoryItemId}>
                    {option.itemName}
                    {option.quantityRequired > 1 ? ` ×${option.quantityRequired}` : ""}
                    {option.quantityAvailable > 1
                      ? ` (${option.quantityAvailable} available)`
                      : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function isSpellMaterialSelectionComplete(
  character: CharacterData,
  spellSlug: string,
  catalogItems: Record<string, Item>,
  selections: SpellMaterialSelection[]
): boolean {
  const catalog = getSpell(spellSlug);
  const eligibility = resolveSpellMaterialEligibility(
    character.inventory.items,
    spellSlug,
    catalogItems,
    catalog?.components
  );
  if (eligibility.satisfiedByFocus) return true;
  if (!eligibility.canCast) return false;
  return eligibility.groups.every((group) =>
    selections.some(
      (selection) =>
        selection.groupIndex === group.groupIndex &&
        group.options.some((option) => option.inventoryItemId === selection.inventoryItemId)
    )
  );
}
