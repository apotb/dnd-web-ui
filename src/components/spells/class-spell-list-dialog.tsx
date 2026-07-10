"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  searchSpellsClient,
  type CatalogSpellRow,
} from "@/lib/content/catalog-client";
import { SpellGlossaryMeta } from "@/components/spells/spell-glossary-meta";
import { Tooltip } from "@/components/ui/tooltip";
import {
  availableSpellLevels,
  formatSpellPickerTooltip,
  spellLevelBadgeLabel,
  spellLevelFilterLabel,
  spellLevelLabel,
  spellListLabel,
} from "@/lib/dnd/spell-display";

interface ClassSpellListDialogProps {
  open: boolean;
  onClose: () => void;
  classListId: string;
  maxSpellLevel: number;
  markedSlugs: string[];
  badgeLabel?: "Prepared" | "Known";
  title?: string;
}

export function ClassSpellListDialog({
  open,
  onClose,
  classListId,
  maxSpellLevel,
  markedSlugs,
  badgeLabel = "Prepared",
  title = "See spells",
}: ClassSpellListDialogProps) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [allSpells, setAllSpells] = useState<CatalogSpellRow[]>([]);
  const [loading, setLoading] = useState(false);

  const markedSlugSet = useMemo(() => new Set(markedSlugs), [markedSlugs]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setLevel("all");
      setAllSpells([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void searchSpellsClient("", { classListId, limit: 500 }).then((spells) => {
      setAllSpells(
        spells.filter((s) => s.level > 0 && s.level <= maxSpellLevel)
      );
      setLoading(false);
    });
  }, [open, classListId, maxSpellLevel]);

  const filtered = useMemo(() => {
    let spells = allSpells;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      spells = spells.filter((s) => s.name.toLowerCase().includes(q));
    }
    if (level !== "all") {
      const levelNum = parseInt(level, 10);
      spells = spells.filter((s) => s.level === levelNum);
    }
    return spells;
  }, [allSpells, query, level]);

  const grouped = useMemo(() => {
    const map = new Map<number, CatalogSpellRow[]>();
    for (const spell of filtered) {
      const bucket = map.get(spell.level) ?? [];
      bucket.push(spell);
      map.set(spell.level, bucket);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [filtered]);

  const classLabel = spellListLabel(classListId);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : allSpells.length === 0
                ? `No leveled spells on your ${classLabel} list yet.`
                : `${allSpells.length} spell${allSpells.length === 1 ? "" : "s"} on your ${classLabel} list`}
          </p>
        </DialogHeader>

        <div className="space-y-2">
          <Input
            placeholder="Search spells…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full"
          />
          <Select value={level} onValueChange={(v) => setLevel(v ?? "all")}>
            <SelectTrigger className="w-full">
              <SelectValue>{spellLevelFilterLabel(level)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {availableSpellLevels(maxSpellLevel)
                .filter((n) => n > 0)
                .map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {spellLevelLabel(n)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No spells found.</p>
          ) : (
            grouped.map(([spellLevel, spells]) => (
              <div key={spellLevel} className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {spellLevelLabel(spellLevel)}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {spells.map((spell) => {
                    const isMarked = markedSlugSet.has(spell.slug);
                    const tooltip = formatSpellPickerTooltip(spell);
                    return (
                      <Tooltip key={spell.slug} content={tooltip}>
                        <div className="rounded-md border p-3 min-w-0 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-sm leading-snug">
                              {spell.name}
                              {spell.ritual ? " ◆" : ""}
                            </span>
                            <div className="flex shrink-0 items-center gap-1">
                              {isMarked ? (
                                <Badge variant="secondary" className="text-xs">
                                  {badgeLabel}
                                </Badge>
                              ) : null}
                              <Badge variant="outline" className="text-xs">
                                {spellLevelBadgeLabel(spell.level)}
                              </Badge>
                            </div>
                          </div>
                          <SpellGlossaryMeta spell={spell} />
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
