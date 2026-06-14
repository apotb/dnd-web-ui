"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { availableSpellLevels, spellClassFilterLabel, spellLevelFilterLabel, spellLevelLabel } from "@/lib/dnd/spell-display";

interface SpellPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (spell: CatalogSpellRow) => void;
  /** Limit to a class spell list (e.g. wizard, cleric). */
  defaultClassListId?: string;
  /** Highest spell level the character can cast (limits level filter and results). */
  maxSpellLevel?: number;
  /** Slugs already on the character — hidden from results when adding. */
  excludeSlugs?: string[];
}

function levelLabel(level: number): string {
  if (level === 0) return "Cantrip";
  return `Level ${level}`;
}

function SpellRow({ spell, onSelect }: { spell: CatalogSpellRow; onSelect: () => void }) {
  return (
    <button
      type="button"
      className="w-full flex items-start gap-3 rounded-md border p-3 text-left hover:bg-accent transition-colors"
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{spell.name}</span>
          <Badge variant="outline" className="text-xs">
            {levelLabel(spell.level)}
          </Badge>
        </div>
        <div className="mt-0.5">
          <SpellGlossaryMeta spell={spell} />
        </div>
      </div>
    </button>
  );
}

export function SpellPicker({
  open,
  onClose,
  onSelect,
  defaultClassListId,
  maxSpellLevel,
  excludeSlugs = [],
}: SpellPickerProps) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<string>("all");
  const [classFilter, setClassFilter] = useState(
    defaultClassListId ? "class" : "all"
  );
  const [results, setResults] = useState<CatalogSpellRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && defaultClassListId) {
      setClassFilter("class");
    }
  }, [open, defaultClassListId]);

  const search = useCallback(
    async (q: string, levelFilter: string, listFilter: string) => {
      setLoading(true);
      const spells = await searchSpellsClient(q, {
        level: levelFilter === "all" ? "all" : parseInt(levelFilter, 10),
        classListId:
          listFilter === "class" && defaultClassListId
            ? defaultClassListId
            : undefined,
        limit: 50,
      });
      const excluded = new Set(excludeSlugs);
      const maxLevel = maxSpellLevel ?? 9;
      setResults(
        spells.filter(
          (s) => !excluded.has(s.slug) && s.level <= maxLevel
        )
      );
      setLoading(false);
    },
    [defaultClassListId, excludeSlugs, maxSpellLevel]
  );

  useEffect(() => {
    if (!open) return;
    const tid = setTimeout(() => search(query, level, classFilter), 200);
    return () => clearTimeout(tid);
  }, [open, query, level, classFilter, search]);

  function handleSelect(spell: CatalogSpellRow) {
    onSelect(spell);
    onClose();
    setQuery("");
    setLevel("all");
    setClassFilter(defaultClassListId ? "class" : "all");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Spell from Catalog</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search spells…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="flex-1 min-w-[140px]"
          />
          <Select value={level} onValueChange={(v) => setLevel(v ?? "all")}>
            <SelectTrigger className="w-32">
              <SelectValue>{spellLevelFilterLabel(level)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {availableSpellLevels(maxSpellLevel ?? 9).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n === 0 ? "Cantrips" : spellLevelLabel(n)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {defaultClassListId ? (
            <Select value={classFilter} onValueChange={(v) => setClassFilter(v ?? "all")}>
              <SelectTrigger className="w-36">
                <SelectValue>
                  {spellClassFilterLabel(classFilter, defaultClassListId)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="class">Class list</SelectItem>
                <SelectItem value="all">All spells</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 mt-2 min-h-0">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {query ? "No spells found." : "Start typing to search spells."}
            </p>
          ) : (
            results.map((spell) => (
              <SpellRow
                key={spell.slug}
                spell={spell}
                onSelect={() => handleSelect(spell)}
              />
            ))
          )}
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
