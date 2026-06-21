"use client";

import { useMemo, useState } from "react";
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

interface AddEnemyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enemies: EnemyRecord[];
  onSelect: (enemy: EnemyRecord) => void;
}

export function AddEnemyDialog({
  open,
  onOpenChange,
  enemies,
  onSelect,
}: AddEnemyDialogProps) {
  const [search, setSearch] = useState("");
  const supabase = useMemo(() => createClient(), []);

  const filtered = enemies.filter(
    (enemy) =>
      enemy.name.toLowerCase().includes(search.toLowerCase()) ||
      enemy.slug.includes(search.toLowerCase())
  );

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
        />

        <div className="combat-enemy-picker">
          {filtered.map((enemy) => {
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
          })}
          {filtered.length === 0 ? (
            <p className="retro-note">No enemies match your search.</p>
          ) : null}
        </div>

        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
