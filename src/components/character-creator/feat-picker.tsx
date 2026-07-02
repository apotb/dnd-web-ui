"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import type { PhbFeat } from "@/lib/dnd/phb/types";
import { PHB_FEATS } from "@/lib/dnd/phb/feats";

interface FeatPickerProps {
  selectedId: string;
  onChange: (featId: string) => void;
  /** Feats the character already has (hidden unless currently selected). */
  excludedIds?: string[];
  feats?: PhbFeat[];
}

export function FeatPicker({
  selectedId,
  onChange,
  excludedIds = [],
  feats = PHB_FEATS,
}: FeatPickerProps) {
  const [query, setQuery] = useState("");

  const excluded = useMemo(() => new Set(excludedIds), [excludedIds]);
  const selectedFeat = feats.find((f) => f.id === selectedId);

  const q = query.trim().toLowerCase();
  const displayed = feats.filter((feat) => {
    if (excluded.has(feat.id) && feat.id !== selectedId) return false;
    if (!q) return true;
    return (
      feat.name.toLowerCase().includes(q) ||
      feat.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-2">
      {selectedFeat ? (
        <div className="creator-chip-row">
          <Tooltip content={selectedFeat.description}>
            <button
              type="button"
              className="candy-btn candy-btn-sm candy-btn-active"
              onClick={() => onChange("")}
            >
              {selectedFeat.name} ×
            </button>
          </Tooltip>
        </div>
      ) : null}

      <p className="text-xs retro-muted">
        {selectedId ? "1/1 selected" : "0/1 selected"} · hover for details
      </p>

      <Input
        className="candy-input"
        placeholder="Search feats…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="creator-chip-row creator-lang-grid">
        {displayed.map((feat) => {
          const isSelected = feat.id === selectedId;
          return (
            <Tooltip key={feat.id} content={feat.description}>
              <button
                type="button"
                className={`candy-btn candy-btn-sm${isSelected ? " candy-btn-active" : ""}`}
                onClick={() => onChange(isSelected ? "" : feat.id)}
              >
                {feat.name}
              </button>
            </Tooltip>
          );
        })}
        {displayed.length === 0 ? (
          <span className="text-xs retro-muted">No feats found.</span>
        ) : null}
      </div>
    </div>
  );
}
