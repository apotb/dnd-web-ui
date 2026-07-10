"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
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
import { SpellRowTooltipContext } from "@/components/spells/spell-row-tooltip-context";
import { Tooltip } from "@/components/ui/tooltip";
import {
  availableSpellLevels,
  formatSpellPickerTooltip,
  spellLevelBadgeLabel,
  spellLevelFilterLabel,
  spellLevelLabel,
  spellListLabel,
} from "@/lib/dnd/spell-display";

const EMPTY_EXCLUDE_SLUGS: string[] = [];

export interface SpellPreparationPickerProps {
  classListId: string;
  maxSpellLevel: number;
  prepareLimit: number;
  selectedSlugs: string[];
  onSelectedSlugsChange: (slugs: string[]) => void;
  /** Wizard: limit choices to spellbook entries only. */
  spellbookSlugs?: string[];
  /** Slugs the character already knows — hidden from results. */
  excludeSlugs?: string[];
  /** Summary label above filters (defaults to prepared). */
  selectionKind?: "prepared" | "known" | "selected";
  /** When false, skip search and clear transient UI state. */
  active?: boolean;
  /** Show prepared count subtitle above filters. */
  showSummary?: boolean;
  /** contained = inner scroll; parent = grow with outer scroll container. */
  scrollMode?: "contained" | "parent";
  className?: string;
  scrollClassName?: string;
}

function levelHeaderLabel(level: number): string {
  if (level === 0) return "Cantrips";
  return spellLevelLabel(level);
}

function SpellPreparationPickerRow({
  spell,
  checked,
  disabled,
  onToggle,
}: {
  spell: CatalogSpellRow;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const mainTooltip = formatSpellPickerTooltip(spell);
  const [tooltipOverride, setTooltipOverride] = useState<string | null>(null);
  const displayContent = tooltipOverride ?? mainTooltip;

  return (
    <Tooltip content={displayContent}>
      <label
        className={`flex h-full items-start gap-3 rounded-md border p-3 min-w-0 ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:bg-accent"
        } transition-colors`}
        onMouseLeave={() => setTooltipOverride(null)}
      >
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={onToggle}
          className="mt-0.5"
        />
        <SpellRowTooltipContext.Provider value={setTooltipOverride}>
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
        </SpellRowTooltipContext.Provider>
      </label>
    </Tooltip>
  );
}

export function SpellPreparationPicker({
  classListId,
  maxSpellLevel,
  prepareLimit,
  selectedSlugs,
  onSelectedSlugsChange,
  spellbookSlugs,
  excludeSlugs = EMPTY_EXCLUDE_SLUGS,
  selectionKind = "prepared",
  active = true,
  showSummary = true,
  scrollMode = "contained",
  className,
  scrollClassName = "max-h-[min(50vh,28rem)]",
}: SpellPreparationPickerProps) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [results, setResults] = useState<CatalogSpellRow[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedSlugSet = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);
  const selectedCount = selectedSlugs.length;
  const atLimit = selectedCount >= prepareLimit;

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
      let filtered = spells.filter(
        (s) =>
          s.level > 0 &&
          s.level <= maxSpellLevel &&
          !excludeSlugs.includes(s.slug)
      );
      if (spellbookSlugs?.length) {
        if (q.trim()) {
          const normalized = q.trim().toLowerCase();
          filtered = filtered.filter((s) => s.name.toLowerCase().includes(normalized));
        }
        if (levelFilter !== "all") {
          const levelNum = parseInt(levelFilter, 10);
          filtered = filtered.filter((s) => s.level === levelNum);
        }
      }
      setResults(filtered);
      setLoading(false);
    },
    [classListId, excludeSlugs, maxSpellLevel, spellbookSlugs]
  );

  useEffect(() => {
    if (!active) return;
    const tid = setTimeout(() => search(query, level), 200);
    return () => clearTimeout(tid);
  }, [active, query, level, search]);

  useEffect(() => {
    if (active) return;
    setQuery("");
    setLevel("all");
    setResults([]);
    setLoading(false);
  }, [active]);

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
    if (selectedSlugSet.has(slug)) {
      onSelectedSlugsChange(selectedSlugs.filter((id) => id !== slug));
      return;
    }
    if (selectedSlugs.length >= prepareLimit) return;
    onSelectedSlugsChange([...selectedSlugs, slug]);
  }

  const selectionLabel =
    selectionKind === "known"
      ? "Known"
      : selectionKind === "selected"
        ? "Selected"
        : "Prepared";

  return (
    <div className={className}>
      {showSummary ? (
        <p className="text-sm text-muted-foreground mb-3">
          {selectionLabel}: {selectedCount}/{prepareLimit}
          {spellbookSlugs?.length
            ? " · from spellbook"
            : ` · ${spellListLabel(classListId)} list`}
        </p>
      ) : null}

      <div className="space-y-2">
        <Input
          placeholder="Search spells…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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

      <div
        className={`mt-3 space-y-4 pr-1 ${
          scrollMode === "contained" ? `overflow-y-auto ${scrollClassName}` : ""
        }`}
      >
        {loading && results.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No spells found.</p>
        ) : (
          grouped.map(([spellLevel, spells]) => (
            <div key={spellLevel} className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {levelHeaderLabel(spellLevel)}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {spells.map((spell) => {
                  const checked = selectedSlugSet.has(spell.slug);
                  const disabled = !checked && atLimit;
                  return (
                    <SpellPreparationPickerRow
                      key={spell.slug}
                      spell={spell}
                      checked={checked}
                      disabled={disabled}
                      onToggle={() => toggleSpell(spell.slug)}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Resolve selected slugs to catalog rows for confirm handlers. */
export async function resolvePreparedSpellSelection(
  selectedSlugs: string[],
  options: {
    classListId: string;
    maxSpellLevel: number;
    spellbookSlugs?: string[];
  }
): Promise<CatalogSpellRow[]> {
  if (options.spellbookSlugs?.length) {
    const spellMap = await getSpellsBySlugsClient(selectedSlugs);
    return selectedSlugs
      .map((slug) => spellMap[slug])
      .filter(
        (s): s is CatalogSpellRow =>
          s != null && s.level > 0 && s.level <= options.maxSpellLevel
      );
  }
  const all = await searchSpellsClient("", {
    classListId: options.classListId,
    limit: 500,
  });
  return all.filter(
    (s) =>
      selectedSlugs.includes(s.slug) && s.level > 0 && s.level <= options.maxSpellLevel
  );
}
