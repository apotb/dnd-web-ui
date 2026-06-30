"use client";

import { useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveCombatImageUrl } from "@/lib/combat/storage";
import {
  EncounterDeleteConfirmModal,
  EncounterRenameModal,
} from "@/components/combat/encounter-action-modals";
import {
  buildDuplicateEncounterName,
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
import { Input } from "@/components/ui/input";

interface EncountersManagerProps {
  entries: Encounter[];
  enemiesBySlug: Record<string, Pick<EnemyRecord, "name">>;
}

const ENCOUNTER_ROW_GRID =
  "grid grid-cols-[56px_minmax(0,12rem)_3.5rem_4.5rem_3.5rem_3.5rem_minmax(16rem,1fr)] gap-x-3";

export function EncountersManager({ entries, enemiesBySlug }: EncountersManagerProps) {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState(entries);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<EncounterSort>("name");
  const [message, setMessage] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<EncounterListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EncounterListItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const searched = filterEncounters(list, filter, enemiesBySlug);
    return enrichEncountersForList(sortEncounters(searched, sort), enemiesBySlug);
  }, [enemiesBySlug, filter, list, sort]);

  function confirmRename(nextName: string) {
    if (!renameTarget) return;
    if (!nextName || nextName === renameTarget.name) {
      setRenameTarget(null);
      return;
    }

    startTransition(async () => {
      setMessage(null);
      const { error } = await supabase
        .from("encounters")
        .update({ name: nextName })
        .eq("id", renameTarget.id);

      if (error) {
        setMessage(error.message);
        return;
      }
      setList((current) =>
        current.map((entry) => (entry.id === renameTarget.id ? { ...entry, name: nextName } : entry))
      );
      setRenameTarget(null);
    });
  }

  function handleDuplicate(row: EncounterListItem) {
    const duplicateName = buildDuplicateEncounterName(
      row.name,
      new Set(list.map((entry) => entry.name))
    );

    startTransition(async () => {
      setMessage(null);
      const { data, error } = await supabase
        .from("encounters")
        .insert({
          name: duplicateName,
          background_path: row.background_path,
          grid_width: row.grid_width,
          grid_height: row.grid_height,
          tile_feet: row.tile_feet,
          blocked_cells: row.blocked_cells,
          data: row.data,
          total_cr: row.total_cr,
        })
        .select("*")
        .single();

      if (error) {
        setMessage(error.message);
        return;
      }
      if (data) {
        setList((current) => [...current, data as Encounter]);
      }
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;

    startTransition(async () => {
      setMessage(null);
      const { error } = await supabase.from("encounters").delete().eq("id", deleteTarget.id);
      if (error) {
        setMessage(error.message);
        return;
      }
      setList((current) => current.filter((entry) => entry.id !== deleteTarget.id));
      setDeleteTarget(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="retro-box">
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            placeholder="Filter by name or enemy…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="flex-1 min-w-48"
          />
          <label className="combat-encounter-load-sort">
            <span>Sort by</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as EncounterSort)}
            >
              <option value="name">Alphabetically</option>
              <option value="totalCr">Total CR</option>
              <option value="updatedAt">Last Modified</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {filtered.length} of {list.length} encounters · Create and edit layouts from the combat
          board.
        </p>
        {message ? <p className="text-xs text-destructive mt-2">{message}</p> : null}
      </div>

      <div className="retro-box" style={{ padding: 0 }}>
        <div
          className={`${ENCOUNTER_ROW_GRID} border-b px-4 py-2 bg-muted/50 text-xs font-bold uppercase tracking-wide text-muted-foreground`}
        >
          <span />
          <span>Name</span>
          <span>CR</span>
          <span>Grid</span>
          <span>Chars</span>
          <span>Markers</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No encounters found.</p>
        ) : null}

        {filtered.map((row, idx) => {
          const backgroundUrl = row.background_path
            ? resolveCombatImageUrl(supabase, row.background_path)
            : null;

          return (
            <div
              key={row.id}
              className={`${ENCOUNTER_ROW_GRID} items-center px-4 py-2.5 ${idx !== filtered.length - 1 ? "border-b" : ""}`}
            >
              <div className="flex items-center justify-center">
                {backgroundUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={backgroundUrl}
                    alt=""
                    className="h-10 w-14 rounded object-cover border border-black/20"
                  />
                ) : (
                  <div className="flex h-10 w-14 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                    —
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <span className="block truncate font-medium text-sm">{row.name}</span>
                <div className="truncate text-xs text-muted-foreground">
                  {row.enemySummary.length > 0 ? row.enemySummary.join(", ") : "No enemies"}
                </div>
              </div>
              <span className="text-sm text-muted-foreground">{formatTotalCr(row.total_cr)}</span>
              <span className="text-sm text-muted-foreground">
                {row.grid_width}×{row.grid_height}
              </span>
              <span className="text-sm text-muted-foreground">{row.characterSlotCount}</span>
              <span className="text-sm text-muted-foreground">{row.markerCount}</span>
              <div className="flex flex-wrap gap-1.5 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRenameTarget(row)}
                  disabled={isPending}
                >
                  Rename
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDuplicate(row)} disabled={isPending}>
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeleteTarget(row)}
                  disabled={isPending}
                >
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <EncounterRenameModal
        encounter={renameTarget}
        submitting={isPending && renameTarget != null}
        onCancel={() => {
          if (isPending) return;
          setRenameTarget(null);
        }}
        onSubmit={confirmRename}
      />
      <EncounterDeleteConfirmModal
        encounter={deleteTarget}
        submitting={isPending && deleteTarget != null}
        onCancel={() => {
          if (isPending) return;
          setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
