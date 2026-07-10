"use client";

import { useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveCombatImageUrl } from "@/lib/combat/storage";
import {
  cleanupEncounterOwnedImages,
  cloneEncounterPayloadImages,
} from "@/lib/combat/encounter-image-storage";
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
import { parseSavedEncounterBlockedCells, parseSavedEncounterData } from "@/lib/schemas/saved-encounter";
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
      const data = parseSavedEncounterData(row.data);
      const payload = {
        backgroundPath: row.background_path,
        gridWidth: row.grid_width,
        gridHeight: row.grid_height,
        tileFeet: row.tile_feet,
        blockedCells: parseSavedEncounterBlockedCells(row.blocked_cells),
        data,
        totalCr: row.total_cr,
      };

      const { data: inserted, error } = await supabase
        .from("encounters")
        .insert({
          name: duplicateName,
          background_path: payload.backgroundPath,
          grid_width: payload.gridWidth,
          grid_height: payload.gridHeight,
          tile_feet: payload.tileFeet,
          blocked_cells: payload.blockedCells,
          data: payload.data,
          total_cr: payload.totalCr,
        })
        .select("*")
        .single();

      if (error) {
        setMessage(error.message);
        return;
      }
      if (!inserted) return;

      const { payload: clonedPayload, error: cloneError } =
        await cloneEncounterPayloadImages(supabase, inserted.id, payload);

      if (cloneError) {
        setMessage(cloneError);
        setList((current) => [...current, inserted as Encounter]);
        return;
      }

      if (
        clonedPayload.backgroundPath !== payload.backgroundPath ||
        JSON.stringify(clonedPayload.data.markers) !==
          JSON.stringify(payload.data.markers)
      ) {
        const { error: updateError } = await supabase
          .from("encounters")
          .update({
            background_path: clonedPayload.backgroundPath,
            data: clonedPayload.data,
          })
          .eq("id", inserted.id);

        if (updateError) {
          setMessage(updateError.message);
          setList((current) => [...current, inserted as Encounter]);
          return;
        }
      }

      setList((current) => [
        ...current,
        {
          ...(inserted as Encounter),
          background_path: clonedPayload.backgroundPath,
          data: clonedPayload.data,
        },
      ]);
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
      await cleanupEncounterOwnedImages(
        supabase,
        deleteTarget.id,
        deleteTarget.background_path,
        parseSavedEncounterData(deleteTarget.data)
      );
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
