"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { SpellPickerRow } from "@/components/spells/spell-picker-row";
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
  /** Dialog title (defaults to spell-list add flow). */
  title?: string;
  /** Initial level filter value (e.g. "0" for cantrips). */
  initialLevel?: string;
  /** Keep the level filter fixed to initialLevel. */
  lockLevelFilter?: boolean;
  /** Keep the class filter fixed to the class list (requires defaultClassListId). */
  lockClassFilter?: boolean;
}

const EMPTY_EXCLUDE_SLUGS: readonly string[] = [];

function excludeSlugsKey(slugs: readonly string[]): string {
  return slugs.length === 0 ? "" : slugs.join("\0");
}

export function SpellPicker({
  open,
  onClose,
  onSelect,
  defaultClassListId,
  maxSpellLevel,
  excludeSlugs,
  title = "Add Spell from Catalog",
  initialLevel = "all",
  lockLevelFilter = false,
  lockClassFilter = false,
}: SpellPickerProps) {
  const resolvedExcludeSlugs = excludeSlugs ?? EMPTY_EXCLUDE_SLUGS;
  const excludedKey = excludeSlugsKey(resolvedExcludeSlugs);
  const initialClassFilter = defaultClassListId ? "class" : "all";
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState(initialLevel);
  const [classFilter, setClassFilter] = useState(initialClassFilter);
  const [results, setResults] = useState<CatalogSpellRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLevel(initialLevel);
      setClassFilter(initialClassFilter);
    }
  }, [open, initialLevel, initialClassFilter]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setLevel(initialLevel);
      setClassFilter(initialClassFilter);
      setResults([]);
      setLoading(false);
    }
  }, [open, initialLevel, initialClassFilter]);

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
      const excluded = new Set(
        excludedKey ? excludedKey.split("\0") : []
      );
      const maxLevel = maxSpellLevel ?? 9;
      setResults(
        spells.filter(
          (s) => !excluded.has(s.slug) && s.level <= maxLevel
        )
      );
      setLoading(false);
    },
    [defaultClassListId, excludedKey, maxSpellLevel]
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
    setLevel(initialLevel);
    setClassFilter(initialClassFilter);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Input
            placeholder="Search spells…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full"
          />
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Select
                value={level}
                onValueChange={lockLevelFilter ? undefined : (v) => setLevel(v ?? "all")}
              >
                <SelectTrigger className="w-full" disabled={lockLevelFilter}>
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
            </div>
            {defaultClassListId ? (
              <div className="min-w-0 flex-1">
                <Select
                  value={classFilter}
                  onValueChange={lockClassFilter ? undefined : (v) => setClassFilter(v ?? "all")}
                >
                  <SelectTrigger className="w-full" disabled={lockClassFilter}>
                    <SelectValue>
                      {spellClassFilterLabel(classFilter, defaultClassListId)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">Class</SelectItem>
                    <SelectItem value="all">All spells</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mt-2 min-h-0">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {query ? "No spells found." : "Start typing to search spells."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {results.map((spell) => (
                <SpellPickerRow
                  key={spell.slug}
                  spell={spell}
                  onSelect={() => handleSelect(spell)}
                />
              ))}
            </div>
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
