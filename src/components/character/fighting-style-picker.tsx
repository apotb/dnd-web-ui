"use client";

import type { ChoiceOption } from "@/lib/character/feature-choices";
import { cn } from "@/lib/utils";

interface FightingStylePickerProps {
  options: readonly ChoiceOption[];
  value: string | undefined;
  onChange: (value: string) => void;
  label?: string;
}

export function FightingStylePicker({
  options,
  value,
  onChange,
  label = "Fighting Style",
}: FightingStylePickerProps) {
  return (
    <div className="fighting-style-picker">
      <p className="candy-label">{label}</p>
      <div className="fighting-style-picker-list" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={cn(
                "retro-box level-up-feature-card fighting-style-picker-card",
                selected && "fighting-style-picker-card-selected"
              )}
              onClick={() => onChange(option.value)}
            >
              <p className="level-up-feature-name">{option.label}</p>
              {option.description ? (
                <p className="level-up-feature-desc retro-muted">{option.description}</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
