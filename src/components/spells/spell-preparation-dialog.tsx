"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CatalogSpellRow } from "@/lib/content/catalog-client";
import {
  resolvePreparedSpellSelection,
  SpellPreparationPicker,
} from "@/components/spells/spell-preparation-picker";

interface SpellPreparationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selected: CatalogSpellRow[]) => void;
  classListId: string;
  maxSpellLevel: number;
  prepareLimit: number;
  currentlyPreparedSlugs: string[];
  /** Wizard: limit choices to spellbook entries only. */
  spellbookSlugs?: string[];
  title?: string;
  confirmLabel?: string;
}

export function SpellPreparationDialog({
  open,
  onClose,
  onConfirm,
  classListId,
  maxSpellLevel,
  prepareLimit,
  currentlyPreparedSlugs,
  spellbookSlugs,
  title = "Prepare spells",
  confirmLabel = "Confirm preparation",
}: SpellPreparationDialogProps) {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSelectedSlugs(currentlyPreparedSlugs);
    }
  }, [open, currentlyPreparedSlugs]);

  function handleConfirm() {
    void resolvePreparedSpellSelection(selectedSlugs, {
      classListId,
      maxSpellLevel,
      spellbookSlugs,
    }).then((spells) => {
      onConfirm(spells);
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <SpellPreparationPicker
          active={open}
          classListId={classListId}
          maxSpellLevel={maxSpellLevel}
          prepareLimit={prepareLimit}
          selectedSlugs={selectedSlugs}
          onSelectedSlugsChange={setSelectedSlugs}
          spellbookSlugs={spellbookSlugs}
          className="flex flex-col flex-1 min-h-0"
          scrollClassName="flex-1 min-h-0"
        />

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
