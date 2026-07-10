"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import {
  getSpellsBySlugsClient,
  type CatalogSpellRow,
} from "@/lib/content/catalog-client";
import { SpellGlossaryMeta } from "@/components/spells/spell-glossary-meta";
import {
  formatSpellPickerTooltip,
  spellLevelBadgeLabel,
  spellLevelLabel,
} from "@/lib/dnd/spell-display";
import type { Spell } from "@/lib/schemas/character";

interface SpellbookDialogProps {
  open: boolean;
  onClose: () => void;
  spells: Spell[];
  title?: string;
  countNoun?: string;
  emptyHint?: string;
}

export function SpellbookDialog({
  open,
  onClose,
  spells,
  title = "Spellbook",
  countNoun = "spellbook",
  emptyHint = "Copy spells into your spellbook during downtime, or ask your DM to add them with Edit spells.",
}: SpellbookDialogProps) {
  const [catalogSpells, setCatalogSpells] = useState<Record<string, CatalogSpellRow>>(
    {}
  );
  const [loading, setLoading] = useState(false);

  const slugs = useMemo(
    () =>
      [...new Set(spells.map((spell) => spell.spellId).filter(Boolean))] as string[],
    [spells]
  );

  useEffect(() => {
    if (!open) {
      setCatalogSpells({});
      setLoading(false);
      return;
    }
    if (slugs.length === 0) {
      setCatalogSpells({});
      return;
    }
    setLoading(true);
    void getSpellsBySlugsClient(slugs).then((map) => {
      setCatalogSpells(map);
      setLoading(false);
    });
  }, [open, slugs]);

  const grouped = useMemo(() => {
    const map = new Map<number, Spell[]>();
    for (const spell of spells) {
      const bucket = map.get(spell.level) ?? [];
      bucket.push(spell);
      map.set(spell.level, bucket);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [spells]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {spells.length === 0
              ? `No leveled spells in your ${countNoun} yet.`
              : `${spells.length} spell${spells.length === 1 ? "" : "s"} in your ${countNoun}`}
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              {emptyHint}
            </p>
          ) : (
            grouped.map(([level, levelSpells]) => (
              <div key={level} className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {spellLevelLabel(level)}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {levelSpells.map((spell) => {
                    const catalogSpell = spell.spellId
                      ? catalogSpells[spell.spellId]
                      : undefined;
                    const displayName = catalogSpell?.name ?? spell.name;
                    const tooltip = formatSpellPickerTooltip(
                      catalogSpell ?? { name: displayName }
                    );
                    return (
                      <Tooltip key={spell.id} content={tooltip}>
                        <div className="rounded-md border p-3 min-w-0 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-sm leading-snug">
                              {displayName || "Unknown spell"}
                              {catalogSpell?.ritual ? " ◆" : ""}
                            </span>
                            <div className="flex shrink-0 items-center gap-1">
                              {spell.prepared ? (
                                <Badge variant="secondary" className="text-xs">
                                  Prepared
                                </Badge>
                              ) : null}
                              <Badge variant="outline" className="text-xs">
                                {spellLevelBadgeLabel(spell.level)}
                              </Badge>
                            </div>
                          </div>
                          {catalogSpell ? (
                            <SpellGlossaryMeta spell={catalogSpell} />
                          ) : spell.notes ? (
                            <p className="text-xs text-muted-foreground capitalize truncate">
                              {spell.notes}
                            </p>
                          ) : null}
                        </div>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
