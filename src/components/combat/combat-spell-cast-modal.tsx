"use client";

import { SpellPickerRow } from "@/components/spells/spell-picker-row";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SpellMaterialPicker,
  isSpellMaterialSelectionComplete,
  type SpellMaterialSelection,
} from "@/components/combat/spell-material-picker";
import type { CombatOption } from "@/lib/combat/combat-options";
import { ACTION_COST_LABELS } from "@/lib/dnd/character-actions";
import { CombatDeclareBeforeEmphasis } from "@/components/combat/combat-declare-before-emphasis";
import {
  combatCastableSpellToCatalogRow,
  formatSlotLevelLabel,
} from "@/lib/dnd/combat-spells";
import type { CombatCastableSpell } from "@/lib/dnd/combat-spells";
import { getSpell } from "@/lib/dnd/phb/spells";
import type { CatalogSpellRow } from "@/lib/content/catalog-client";
import type { CharacterData } from "@/lib/schemas/character";
import type { Item } from "@/lib/schemas/item";
import { useState } from "react";

interface CombatSpellCastModalProps {
  option: CombatOption;
  character: CharacterData;
  catalogItems: Record<string, Item>;
  onCancel: () => void;
  onConfirm: (materialSelections: SpellMaterialSelection[]) => void;
}

function catalogRowFromSpellCast(
  option: CombatOption,
  spellCast: NonNullable<CombatOption["spellCast"]>
): CatalogSpellRow | null {
  const catalog = getSpell(spellCast.spellId);
  if (!catalog) return null;

  const entry: CombatCastableSpell = {
    spell: {
      id: spellCast.characterSpellId,
      name: option.name,
      level: spellCast.level,
      prepared: true,
      notes: "",
      spellId: spellCast.spellId,
    },
    slug: spellCast.spellId,
    castingCost: spellCast.castingCost === "bonus-action" ? "bonus-action" : "action",
    catalog,
  };

  return combatCastableSpellToCatalogRow(entry);
}

export function CombatSpellCastModal({
  option,
  character,
  catalogItems,
  onCancel,
  onConfirm,
}: CombatSpellCastModalProps) {
  const spellCast = option.spellCast;
  const catalogRow = spellCast ? catalogRowFromSpellCast(option, spellCast) : null;
  const catalog = spellCast ? getSpell(spellCast.spellId) : undefined;
  const [materialSelections, setMaterialSelections] = useState<SpellMaterialSelection[]>(
    spellCast?.materialSelections ?? []
  );
  const economyLabel =
    spellCast?.castingCost === "bonus-action"
      ? ACTION_COST_LABELS["bonus-action"]
      : ACTION_COST_LABELS.action;

  const castAtLabel =
    spellCast && spellCast.castSlotLevel > spellCast.level
      ? `Cast at ${formatSlotLevelLabel(spellCast.castSlotLevel)}`
      : spellCast && spellCast.castSlotLevel > 0
        ? `Cast with ${formatSlotLevelLabel(spellCast.castSlotLevel)} slot`
        : null;

  const canConfirm =
    spellCast != null &&
    isSpellMaterialSelectionComplete(
      character,
      spellCast.spellId,
      catalogItems,
      materialSelections
    );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{option.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Declare this cast to the DM <CombatDeclareBeforeEmphasis /> using your{" "}
            {economyLabel}.
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
          {catalogRow ? (
            <>
              <SpellPickerRow spell={catalogRow} showMaterialLine />
              {castAtLabel ? (
                <p className="text-sm text-muted-foreground">{castAtLabel}</p>
              ) : null}
              {spellCast ? (
                <SpellMaterialPicker
                  character={character}
                  spellSlug={spellCast.spellId}
                  catalogItems={catalogItems}
                  value={materialSelections}
                  onChange={setMaterialSelections}
                />
              ) : null}
              {catalog?.description ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {catalog.description}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{option.tooltip}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(materialSelections)}
          >
            {spellCast?.castingCost === "bonus-action" ? "Use Bonus Action" : "Cast Spell"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
