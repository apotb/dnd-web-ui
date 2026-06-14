"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getHumanoidSpeciesName,
  searchHumanoidSpecies,
} from "@/lib/dnd/phb/favored-enemy-humanoids";

function toggleId(list: string[], id: string, max: number): string[] {
  if (list.includes(id)) return list.filter((s) => s !== id);
  if (list.length >= max) return list;
  return [...list, id];
}

interface HumanoidSpeciesPickerProps {
  selected: string[];
  max?: number;
  onChange: (ids: string[]) => void;
  /** Creator uses retro chip styling; sheet uses default buttons. */
  variant?: "creator" | "sheet";
}

export function HumanoidSpeciesPicker({
  selected,
  max = 2,
  onChange,
  variant = "sheet",
}: HumanoidSpeciesPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(() => searchHumanoidSpecies(""));

  useEffect(() => {
    const tid = setTimeout(() => setResults(searchHumanoidSpecies(query)), 150);
    return () => clearTimeout(tid);
  }, [query]);

  const atMax = selected.length >= max;
  const isCreator = variant === "creator";

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className={isCreator ? "creator-chip-row" : "flex flex-wrap gap-1.5"}>
          {selected.map((id) =>
            isCreator ? (
              <button
                key={id}
                type="button"
                className="candy-btn candy-btn-sm candy-btn-active"
                onClick={() => onChange(selected.filter((s) => s !== id))}
              >
                {getHumanoidSpeciesName(id)} ×
              </button>
            ) : (
              <Button
                key={id}
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
                onClick={() => onChange(selected.filter((s) => s !== id))}
              >
                {getHumanoidSpeciesName(id)} ×
              </Button>
            )
          )}
        </div>
      )}

      <p className={isCreator ? "text-xs retro-muted" : "text-xs text-muted-foreground"}>
        {selected.length}/{max} selected · no duplicates
      </p>

      <Input
        className={isCreator ? "candy-input" : "h-9"}
        placeholder="Search humanoid species…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={atMax}
      />

      <div
        className={
          isCreator
            ? "creator-chip-row creator-lang-grid"
            : "flex flex-wrap gap-1.5 max-h-40 overflow-y-auto"
        }
      >
        {results.map((option) => {
          const isSelected = selected.includes(option.id);
          const isDisabled = atMax && !isSelected;

          if (isCreator) {
            return (
              <button
                key={option.id}
                type="button"
                disabled={isDisabled}
                className={`candy-btn candy-btn-sm${isSelected ? " candy-btn-active" : ""}`}
                onClick={() => {
                  if (!isDisabled) onChange(toggleId(selected, option.id, max));
                }}
              >
                {option.name}
              </button>
            );
          }

          return (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={isSelected ? "default" : "outline"}
              disabled={isDisabled}
              className="h-7 text-xs"
              onClick={() => {
                if (!isDisabled) onChange(toggleId(selected, option.id, max));
              }}
            >
              {option.name}
            </Button>
          );
        })}
        {results.length === 0 ? (
          <span className={isCreator ? "text-xs retro-muted" : "text-xs text-muted-foreground"}>
            No species found.
          </span>
        ) : null}
      </div>
    </div>
  );
}
