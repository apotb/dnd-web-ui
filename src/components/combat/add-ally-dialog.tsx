"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveCombatImageUrl } from "@/lib/combat/storage";
import type { PartyAlly } from "@/lib/schemas/party";

interface AddAllyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allies: PartyAlly[];
  presentAllyIds: Set<string>;
  onConfirm: (allies: PartyAlly[]) => void;
}

export function AddAllyDialog({
  open,
  onOpenChange,
  allies,
  presentAllyIds,
  onConfirm,
}: AddAllyDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const supabase = useMemo(() => createClient(), []);

  const available = useMemo(
    () =>
      [...allies]
        .filter((ally) => !presentAllyIds.has(ally.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allies, presentAllyIds]
  );

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
    }
  }, [open]);

  if (!open) return null;

  function toggleAlly(allyId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(allyId)) {
        next.delete(allyId);
      } else {
        next.add(allyId);
      }
      return next;
    });
  }

  function handleConfirm() {
    const selected = available.filter((ally) => selectedIds.has(ally.id));
    onConfirm(selected);
    onOpenChange(false);
  }

  return (
    <div className="supply-picker-overlay">
      <div className="supply-picker-modal retro-box add-party-member-modal">
        <p className="retro-box-title">Add allies</p>
        <p className="retro-muted add-party-member-summary">
          Select allies to place on the combat board.
        </p>

        {allies.length === 0 ? (
          <p className="retro-muted">
            No allies on the campaign roster yet. Add allies from the Overview page
            first, then return here to place them on the board.
          </p>
        ) : available.length === 0 ? (
          <p className="retro-muted">Every ally is already on the board.</p>
        ) : (
          <ul className="add-party-member-list">
            {available.map((ally) => {
              const portraitPath = ally.data.portraitPath;
              const portraitUrl = portraitPath
                ? resolveCombatImageUrl(supabase, portraitPath)
                : null;
              const checked = selectedIds.has(ally.id);

              return (
                <li key={ally.id}>
                  <label className="add-party-member-item">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAlly(ally.id)}
                    />
                    {portraitUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={portraitUrl}
                        alt=""
                        className="add-party-member-portrait portrait-cover-top"
                      />
                    ) : (
                      <span className="add-party-member-portrait add-party-member-portrait-fallback">
                        {ally.name.slice(0, 1)}
                      </span>
                    )}
                    <span className="add-party-member-name">{ally.name}</span>
                    <span className="add-party-member-meta">
                      HP {ally.currentHp}/{ally.data.hitPoints.average}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="supply-picker-actions">
          <button type="button" className="candy-btn" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="candy-btn"
            disabled={selectedIds.size === 0}
            onClick={handleConfirm}
          >
            Add selected
          </button>
        </div>
      </div>
    </div>
  );
}
