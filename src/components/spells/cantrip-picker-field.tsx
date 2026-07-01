"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SpellPicker } from "@/components/spells/spell-picker";
import { SpellGlossaryMeta } from "@/components/spells/spell-glossary-meta";
import type { CatalogSpellRow } from "@/lib/content/catalog-client";
import { getSpell } from "@/lib/dnd/phb/spells";
import type { PhbSpell } from "@/lib/dnd/phb/types";

function phbSpellToCatalogRow(spell: PhbSpell): CatalogSpellRow {
  return {
    slug: spell.id,
    name: spell.name,
    level: spell.level,
    school: spell.school,
    castingTime: spell.castingTime,
    range: spell.range,
    components: spell.components,
    duration: spell.duration,
    description: spell.description,
    ritual: spell.ritual ?? false,
    concentration: spell.concentration ?? false,
    classes: [],
  };
}

interface CantripPickerFieldProps {
  value: string;
  onChange: (spellId: string) => void;
  classListId: string;
  placeholder?: string;
  /** Sheet uses shadcn buttons; creator uses candy-btn styling. */
  variant?: "sheet" | "creator";
}

export function CantripPickerField({
  value,
  onChange,
  classListId,
  placeholder = "Select cantrip",
  variant = "sheet",
}: CantripPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? getSpell(value) : undefined;
  const selectedRow = selected ? phbSpellToCatalogRow(selected) : null;
  const label = selected?.name ?? placeholder;

  return (
    <div className="space-y-2">
      {variant === "creator" ? (
        <button
          type="button"
          className={`candy-btn candy-btn-sm${value ? " candy-btn-active" : ""}`}
          onClick={() => setOpen(true)}
        >
          {label}
        </button>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          {label}
        </Button>
      )}

      {selectedRow ? (
        <div
          className={
            variant === "creator"
              ? "rounded-md border border-border/60 bg-muted/20 p-3 space-y-2 text-sm"
              : "rounded-md border bg-muted/20 p-3 space-y-2 text-sm"
          }
        >
          <SpellGlossaryMeta spell={selectedRow} />
          <p className="text-muted-foreground whitespace-pre-wrap">{selectedRow.description}</p>
        </div>
      ) : null}

      {open ? (
        <SpellPicker
          open={open}
          onClose={() => setOpen(false)}
          onSelect={(spell) => onChange(spell.slug)}
          defaultClassListId={classListId}
          maxSpellLevel={0}
          initialLevel="0"
          lockLevelFilter
          lockClassFilter
        />
      ) : null}
    </div>
  );
}
