"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  searchSpellsClient,
  getSpellsBySlugsClient,
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

function levelHeaderLabel(level: number): string {
  if (level === 0) return "Cantrips";
  return spellLevelLabel(level);
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
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [results, setResults] = useState<CatalogSpellRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setSelectedSlugs(new Set(currentlyPreparedSlugs));
      setQuery("");
      setLevel("all");
    }
  }, [open, currentlyPreparedSlugs]);

  const search = useCallback(
    async (q: string, levelFilter: string) => {
      setLoading(true);
      let spells: CatalogSpellRow[];
      if (spellbookSlugs?.length) {
        const spellMap = await getSpellsBySlugsClient(spellbookSlugs);
        spells = spellbookSlugs
          .map((slug) => spellMap[slug])
          .filter((s): s is CatalogSpellRow => s != null);
      } else {
        spells = await searchSpellsClient(q, {
          level: levelFilter === "all" ? "all" : parseInt(levelFilter, 10),
          classListId,
          limit: 500,
        });
      }
      let filtered = spells.filter((s) => s.level > 0 && s.level <= maxSpellLevel);
      if (spellbookSlugs?.length) {
        if (q.trim()) {
          const query = q.trim().toLowerCase();
          filtered = filtered.filter((s) => s.name.toLowerCase().includes(query));
        }
        if (levelFilter !== "all") {
          const levelNum = parseInt(levelFilter, 10);
          filtered = filtered.filter((s) => s.level === levelNum);
        }
      }
      setResults(filtered);
      setLoading(false);
    },
    [classListId, maxSpellLevel, spellbookSlugs]
  );

  useEffect(() => {
    if (!open) return;
    const tid = setTimeout(() => search(query, level), 200);
    return () => clearTimeout(tid);
  }, [open, query, level, search]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setLevel("all");
      setResults([]);
      setLoading(false);
    }
  }, [open]);

  const selectedCount = selectedSlugs.size;
  const atLimit = selectedCount >= prepareLimit;

  const grouped = useMemo(() => {
    const map = new Map<number, CatalogSpellRow[]>();
    for (const spell of results) {
      const bucket = map.get(spell.level) ?? [];
      bucket.push(spell);
      map.set(spell.level, bucket);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [results]);

  function toggleSpell(slug: string) {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else if (next.size < prepareLimit) {
        next.add(slug);
      }
      return next;
    });
  }

  function handleConfirm() {
    if (spellbookSlugs?.length) {
      void getSpellsBySlugsClient([...selectedSlugs]).then((spellMap) => {
        onConfirm(
          [...selectedSlugs]
            .map((slug) => spellMap[slug])
            .filter(
              (s): s is CatalogSpellRow =>
                s != null &&
                s.level > 0 &&
                s.level <= maxSpellLevel
            )
        );
        onClose();
      });
      return;
    }
    void searchSpellsClient("", { classListId, limit: 500 }).then((all) => {
      const fromCatalog = all.filter(
        (s) =>
          selectedSlugs.has(s.slug) && s.level > 0 && s.level <= maxSpellLevel
      );
      onConfirm(fromCatalog);
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Prepared: {selectedCount}/{prepareLimit}
            {spellbookSlugs?.length
              ? " · from spellbook"
              : ` · ${spellListLabel(classListId)} list`}
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
                  {levelHeaderLabel(spellLevel)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {spells.map((spell) => {
                    const checked = selectedSlugs.has(spell.slug);
                    const disabled = !checked && atLimit;
                    const tooltip = formatSpellPickerTooltip(spell);
                    return (
                      <Tooltip key={spell.slug} content={tooltip}>
                        <label
                          className={`flex h-full items-start gap-3 rounded-md border p-3 min-w-0 ${
                            disabled
                              ? "cursor-not-allowed opacity-50"
                              : "cursor-pointer hover:bg-accent"
                          } transition-colors`}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={() => toggleSpell(spell.slug)}
                            className="mt-0.5"
                          />
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
                            <SpellGlossaryMeta spell={spell} />
                          </div>
                        </label>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

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
