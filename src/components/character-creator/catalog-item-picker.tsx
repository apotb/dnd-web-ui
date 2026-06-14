"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Item } from "@/lib/schemas/item";
import {
  catalogPickerFilterLabel,
  loadCatalogPickerItems,
  type CatalogPickerFilter,
} from "@/lib/items/catalog-picker-filter";

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function toggleName(list: string[], name: string, max: number): string[] {
  if (list.some((n) => namesMatch(n, name))) {
    return list.filter((n) => !namesMatch(n, name));
  }
  if (list.length >= max) return list;
  return [...list, name];
}

function resolveSelectedLabel(name: string, items: Item[]): string {
  const match = items.find((item) => namesMatch(item.name, name) || item.slug === name);
  return match?.name ?? name;
}

interface CatalogItemPickerProps {
  filter: CatalogPickerFilter;
  selected: string[];
  max?: number;
  label?: string;
  placeholder?: string;
  onChange: (names: string[]) => void;
  variant?: "creator" | "sheet";
}

export function CatalogItemPicker({
  filter,
  selected,
  max = 1,
  label,
  placeholder = "Search items…",
  onChange,
  variant = "creator",
}: CatalogItemPickerProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const filterKey = JSON.stringify(filter);
  const isCreator = variant === "creator";
  const atMax = selected.length >= max;

  useEffect(() => {
    setLoading(true);
    setItems([]);
    setQuery("");

    loadCatalogPickerItems(JSON.parse(filterKey) as CatalogPickerFilter)
      .then((loaded) => {
        setItems(loaded.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .finally(() => setLoading(false));
  }, [filterKey]);

  const displayed = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="space-y-2">
      {label ? (
        <p className={isCreator ? "candy-label" : "text-xs font-medium"}>{label}</p>
      ) : null}

      {selected.length > 0 && (
        <div className={isCreator ? "creator-chip-row" : "flex flex-wrap gap-1.5"}>
          {selected.map((name) =>
            isCreator ? (
              <button
                key={name}
                type="button"
                className="candy-btn candy-btn-sm candy-btn-active"
                onClick={() => onChange(selected.filter((n) => !namesMatch(n, name)))}
              >
                {resolveSelectedLabel(name, items)} ×
              </button>
            ) : (
              <Button
                key={name}
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
                onClick={() => onChange(selected.filter((n) => !namesMatch(n, name)))}
              >
                {resolveSelectedLabel(name, items)} ×
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
        placeholder={placeholder}
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
        {loading && displayed.length === 0 ? (
          <span className={isCreator ? "text-xs retro-muted" : "text-xs text-muted-foreground"}>
            Loading…
          </span>
        ) : null}
        {displayed.map((item) => {
          const isSelected = selected.some(
            (name) => namesMatch(name, item.name) || name === item.slug
          );
          const isDisabled = atMax && !isSelected;

          if (isCreator) {
            return (
              <button
                key={item.slug}
                type="button"
                disabled={isDisabled}
                className={`candy-btn candy-btn-sm${isSelected ? " candy-btn-active" : ""}`}
                onClick={() => {
                  if (!isDisabled) onChange(toggleName(selected, item.name, max));
                }}
              >
                {item.name}
              </button>
            );
          }

          return (
            <Button
              key={item.slug}
              type="button"
              size="sm"
              variant={isSelected ? "default" : "outline"}
              disabled={isDisabled}
              className="h-7 text-xs"
              onClick={() => {
                if (!isDisabled) onChange(toggleName(selected, item.name, max));
              }}
            >
              {item.name}
            </Button>
          );
        })}
        {!loading && displayed.length === 0 ? (
          <span className={isCreator ? "text-xs retro-muted" : "text-xs text-muted-foreground"}>
            No items found.
          </span>
        ) : null}
      </div>
    </div>
  );
}

export { catalogPickerFilterLabel };
