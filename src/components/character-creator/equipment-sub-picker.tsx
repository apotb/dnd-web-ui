"use client";

import { useEffect, useState } from "react";
import {
  searchItemsClient,
  getItemsBySlugsClient,
} from "@/lib/items/catalog-client";
import type { Item } from "@/lib/schemas/item";

// ─── Filter types ────────────────────────────────────────────────────────────

export type PlaceholderFilter =
  | {
      kind: "weapon";
      weaponCategory?: "simple" | "martial";
      weaponRange?: "melee" | "ranged";
    }
  | { kind: "instrument" }
  | { kind: "focus" };

const INSTRUMENT_SLUGS = [
  "bagpipes",
  "drum",
  "dulcimer",
  "flute",
  "lute",
  "lyre",
  "horn",
  "pan-flute",
  "shawm",
  "viol",
];

/**
 * Returns a filter for "open-ended" item placeholder strings used in PHB
 * equipment lists (e.g. "simple weapon", "any musical instrument").
 * Returns null if the item name is a concrete item.
 */
export function getEquipmentPlaceholderFilter(
  itemName: string
): PlaceholderFilter | null {
  const key = itemName.toLowerCase().replace(/^any\s+/, "").trim();
  switch (key) {
    case "simple weapon":
      return { kind: "weapon", weaponCategory: "simple" };
    case "simple melee weapon":
      return { kind: "weapon", weaponCategory: "simple", weaponRange: "melee" };
    case "martial weapon":
      return { kind: "weapon", weaponCategory: "martial" };
    case "martial melee weapon":
      return {
        kind: "weapon",
        weaponCategory: "martial",
        weaponRange: "melee",
      };
    case "musical instrument":
      return { kind: "instrument" };
    case "arcane focus":
      return { kind: "focus" };
    default:
      return null;
  }
}

function filterLabel(filter: PlaceholderFilter): string {
  if (filter.kind === "instrument") return "Choose a musical instrument";
  if (filter.kind === "focus") return "Choose an arcane focus";
  const parts: string[] = ["Choose a"];
  if (filter.weaponCategory) parts.push(filter.weaponCategory);
  if (filter.weaponRange) parts.push(filter.weaponRange);
  parts.push("weapon");
  return parts.join(" ");
}

// ─── Component ───────────────────────────────────────────────────────────────

interface EquipmentSubPickerProps {
  filter: PlaceholderFilter;
  value: string | null;
  onSelect: (name: string) => void;
}

export function EquipmentSubPicker({
  filter,
  value,
  onSelect,
}: EquipmentSubPickerProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const filterKey = JSON.stringify(filter);

  useEffect(() => {
    setLoading(true);
    setItems([]);

    const f: PlaceholderFilter = JSON.parse(filterKey);

    (async () => {
      if (f.kind === "instrument") {
        const bySlug = await getItemsBySlugsClient(INSTRUMENT_SLUGS);
        setItems(
          Object.values(bySlug).sort((a, b) => a.name.localeCompare(b.name))
        );
      } else if (f.kind === "focus") {
        const results = await searchItemsClient("", "focus", 50);
        setItems(results);
      } else {
        const all = await searchItemsClient("", "weapon", 100);
        setItems(
          all.filter((item) => {
            const props = item.properties as Record<string, unknown>;
            if (f.weaponCategory && props.weaponCategory !== f.weaponCategory)
              return false;
            if (f.weaponRange && props.weaponRange !== f.weaponRange)
              return false;
            return true;
          })
        );
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const displayed = query.trim()
    ? items.filter((i) =>
        i.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : items;

  return (
    <div className="creator-sub-picker">
      <p className="candy-label">{filterLabel(filter)}</p>
      {value && (
        <p className="creator-sub-picker-selection">
          Selected: <strong>{value}</strong>
        </p>
      )}
      <input
        className="candy-input creator-sub-picker-search"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="creator-sub-picker-list">
        {loading && <span className="retro-muted">Loading…</span>}
        {!loading && displayed.length === 0 && (
          <span className="retro-muted">No items found.</span>
        )}
        {displayed.map((item) => (
          <button
            key={item.slug}
            type="button"
            className={`candy-btn candy-btn-sm${
              value === item.name ? " candy-btn-active" : ""
            }`}
            onClick={() => onSelect(item.name)}
          >
            {item.name}
          </button>
        ))}
      </div>
    </div>
  );
}
