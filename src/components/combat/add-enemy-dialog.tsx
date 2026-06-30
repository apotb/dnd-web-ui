"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveCombatImageUrl } from "@/lib/combat/storage";
import type { EnemyRecord } from "@/lib/combat/state-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;

interface AddEnemyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enemies: EnemyRecord[];
  onSelect: (enemy: EnemyRecord) => void;
}

function enemySearchRank(enemy: EnemyRecord, normalized: string): number {
  const name = enemy.name.toLowerCase();
  const slug = enemy.slug.toLowerCase();

  if (name.startsWith(normalized)) return 0;
  if (slug.startsWith(normalized)) return 1;
  return 2;
}

function filterAndSortEnemies(enemies: EnemyRecord[], query: string): EnemyRecord[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < MIN_SEARCH_LENGTH) return [];

  return enemies
    .filter(
      (enemy) =>
        enemy.name.toLowerCase().includes(normalized) ||
        enemy.slug.includes(normalized)
    )
    .sort((a, b) => {
      const rankDiff = enemySearchRank(a, normalized) - enemySearchRank(b, normalized);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name);
    });
}

export function AddEnemyDialog({
  open,
  onOpenChange,
  enemies,
  onSelect,
}: AddEnemyDialogProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<EnemyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
      setLoading(false);
      return;
    }

    const trimmed = search.trim();
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeoutId = window.setTimeout(() => {
      setResults(filterAndSortEnemies(enemies, search));
      setLoading(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [open, search, enemies]);

  const trimmedSearch = search.trim();
  const hasMinSearch = trimmedSearch.length >= MIN_SEARCH_LENGTH;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add enemy to board</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Search enemies…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          autoFocus
        />

        <div className="combat-enemy-picker">
          {loading ? (
            <p className="retro-note">Searching…</p>
          ) : hasMinSearch && results.length === 0 ? (
            <p className="retro-note">No enemies match your search.</p>
          ) : (
            results.map((enemy) => {
              const portraitUrl = resolveCombatImageUrl(supabase, enemy.data.portraitPath);
              return (
                <button
                  key={enemy.slug}
                  type="button"
                  className="combat-enemy-picker-item"
                  onClick={() => onSelect(enemy)}
                >
                  {portraitUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={portraitUrl} alt="" className="combat-enemy-picker-portrait" />
                  ) : (
                    <div className="combat-enemy-picker-portrait combat-enemy-picker-portrait-fallback">
                      {enemy.name.slice(0, 1)}
                    </div>
                  )}
                  <span className="combat-enemy-picker-name">{enemy.name}</span>
                  <span className="combat-enemy-picker-meta">CR {enemy.data.challengeRating}</span>
                </button>
              );
            })
          )}
        </div>

        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
