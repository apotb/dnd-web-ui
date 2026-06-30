"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveCombatImageUrl } from "@/lib/combat/storage";
import {
  enrichEncountersForList,
  filterEncounters,
  formatTotalCr,
  sortEncounters,
  type EncounterListItem,
  type EncounterSort,
} from "@/lib/combat/saved-encounters";
import type { EnemyRecord } from "@/lib/combat/state-utils";
import type { Encounter } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EncounterLoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enemiesBySlug: Record<string, EnemyRecord>;
  onLoad: (encounter: Encounter, options: { autoPopulateCharacters: boolean }) => void;
}

const SORT_OPTIONS: Array<{ value: EncounterSort; label: string }> = [
  { value: "name", label: "Alphabetically" },
  { value: "totalCr", label: "Total CR" },
  { value: "updatedAt", label: "Last Modified" },
];

export function EncounterLoadDialog({
  open,
  onOpenChange,
  enemiesBySlug,
  onLoad,
}: EncounterLoadDialogProps) {
  const supabase = createClient();
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<EncounterSort>("totalCr");
  const [autoPopulateCharacters, setAutoPopulateCharacters] = useState(false);

  async function fetchEncounters() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("encounters")
      .select("*")
      .order("name");

    if (fetchError) {
      setError(fetchError.message);
      setEncounters([]);
    } else {
      setEncounters((data ?? []) as Encounter[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSort("totalCr");
    setAutoPopulateCharacters(false);
    void fetchEncounters();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when dialog opens
  }, [open]);

  const listItems = useMemo(() => {
    const filtered = filterEncounters(encounters, search, enemiesBySlug);
    const sorted = sortEncounters(filtered, sort);
    return enrichEncountersForList(sorted, enemiesBySlug);
  }, [encounters, enemiesBySlug, search, sort]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl combat-encounter-load-dialog">
        <DialogHeader className="combat-encounter-load-dialog-header">
          <DialogTitle>Load encounter</DialogTitle>
          <label className="combat-encounter-load-auto-populate">
            <Checkbox
              checked={autoPopulateCharacters}
              onCheckedChange={(checked) => setAutoPopulateCharacters(checked === true)}
            />
            <span>Auto-populate</span>
          </label>
        </DialogHeader>

        <div className="combat-encounter-load-controls">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search encounters…"
            aria-label="Search encounters"
          />
          <label className="combat-encounter-load-sort">
            <span>Sort by</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as EncounterSort)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? <p className="retro-muted">Loading encounters…</p> : null}
        {error ? <p className="retro-muted">{error}</p> : null}

        {!loading && listItems.length === 0 ? (
          <p className="retro-muted">
            {encounters.length === 0
              ? "No saved encounters yet."
              : "No encounters match your search."}
          </p>
        ) : null}

        <ul className="combat-encounter-load-list">
          {listItems.map((encounter) => (
            <EncounterListItem
              key={encounter.id}
              encounter={encounter}
              backgroundUrl={
                encounter.background_path
                  ? resolveCombatImageUrl(supabase, encounter.background_path)
                  : null
              }
              onLoad={() => {
                onLoad(encounter, { autoPopulateCharacters });
                onOpenChange(false);
              }}
            />
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function EncounterListItem({
  encounter,
  backgroundUrl,
  onLoad,
}: {
  encounter: EncounterListItem;
  backgroundUrl: string | null;
  onLoad: () => void;
}) {
  return (
    <li className="combat-encounter-load-item retro-box">
      <div className="combat-encounter-load-preview">
        {backgroundUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backgroundUrl} alt="" className="combat-encounter-load-preview-image" />
        ) : (
          <div className="combat-encounter-load-preview-placeholder">No background</div>
        )}
      </div>

      <div className="combat-encounter-load-details">
        <div className="combat-encounter-load-header">
          <h3>{encounter.name}</h3>
          <span className="combat-encounter-load-meta">CR {formatTotalCr(encounter.total_cr)}</span>
        </div>

        {encounter.enemySummary.length > 0 ? (
          <p className="combat-encounter-load-enemies">
            {encounter.enemySummary.join(", ")}
          </p>
        ) : (
          <p className="combat-encounter-load-enemies retro-muted">No enemies</p>
        )}

        <p className="combat-encounter-load-counts retro-muted">
          {encounter.characterSlotCount} character token
          {encounter.characterSlotCount === 1 ? "" : "s"}
          {encounter.markerCount > 0
            ? ` · ${encounter.markerCount} marker${encounter.markerCount === 1 ? "" : "s"}`
            : ""}
        </p>

        <div className="combat-encounter-load-actions">
          <Button type="button" size="sm" onClick={onLoad}>
            Load
          </Button>
        </div>
      </div>
    </li>
  );
}
