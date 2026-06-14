"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import type { SkillKey } from "@/lib/schemas/character";
import { SKILL_LABELS } from "@/lib/dnd/calculations";

function toggleInList<T>(list: T[], value: T, max: number): T[] {
  if (list.includes(value)) return list.filter((v) => v !== value);
  if (list.length >= max) return list;
  return [...list, value];
}

interface SkillPickerProps {
  selected: SkillKey[];
  max: number;
  options?: SkillKey[];
  excluded?: SkillKey[];
  onChange: (skills: SkillKey[]) => void;
}

export function SkillPicker({
  selected,
  max,
  options,
  excluded = [],
  onChange,
}: SkillPickerProps) {
  const [query, setQuery] = useState("");
  const excludedSet = useMemo(() => new Set(excluded), [excluded]);
  const keys = (options ?? (Object.keys(SKILL_LABELS) as SkillKey[])).filter(
    (key) => !excludedSet.has(key)
  );

  const q = query.trim().toLowerCase();
  const displayed = q
    ? keys.filter((key) => SKILL_LABELS[key].toLowerCase().includes(q))
    : keys;

  const atMax = selected.length >= max;

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="creator-chip-row">
          {selected.map((key) => (
            <button
              key={key}
              type="button"
              className="candy-btn candy-btn-sm candy-btn-active"
              onClick={() => onChange(selected.filter((s) => s !== key))}
            >
              {SKILL_LABELS[key]} ×
            </button>
          ))}
        </div>
      )}

      <p className="text-xs retro-muted">
        {selected.length}/{max} selected · no duplicates
      </p>

      <Input
        className="candy-input"
        placeholder="Search skills…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={atMax}
      />

      <div className="creator-chip-row creator-skill-grid">
        {displayed.map((key) => {
          const isSelected = selected.includes(key);
          const isDisabled = atMax && !isSelected;
          return (
            <button
              key={key}
              type="button"
              disabled={isDisabled}
              className={`candy-btn candy-btn-sm${isSelected ? " candy-btn-active" : ""}`}
              onClick={() => {
                if (!isDisabled) onChange(toggleInList(selected, key, max));
              }}
            >
              {SKILL_LABELS[key]}
            </button>
          );
        })}
        {displayed.length === 0 ? (
          <span className="text-xs retro-muted">No skills found.</span>
        ) : null}
      </div>
    </div>
  );
}
