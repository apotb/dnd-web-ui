"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ITEM_CATEGORIES,
  categoryLabel,
  rarityLabel,
  RARITY_COLOR,
  type Item,
  type ItemCategory,
  getWeaponProperties,
} from "@/lib/schemas/item";
import { searchItemsClient } from "@/lib/items/catalog-client";

export type ItemPickerSelection =
  | { source: "catalog"; item: Item }
  | { source: "custom"; name: string; weightLb?: number };

interface ItemPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: ItemPickerSelection) => void;
  /** Pre-filter to a specific category */
  defaultCategory?: ItemCategory;
  /** When editing a custom inventory row, pre-fill the custom fields. */
  initialCustom?: { name: string; weightLb?: number };
}

function categoryFilterLabel(category: string): string {
  if (category === "all") return "All categories";
  return categoryLabel(category as ItemCategory);
}

function ItemRow({ item, onSelect }: { item: Item; onSelect: () => void }) {
  const weapon = getWeaponProperties(item);
  const subtitle = weapon
    ? `${weapon.damage} ${weapon.damageType} · ${weapon.weaponCategory} ${weapon.weaponRange}`
    : item.category === "armor"
    ? `${(item.properties as Record<string, unknown>)?.armorClass ?? ""}AC armor`
    : item.category === "shield"
    ? "+2 AC shield"
    : categoryLabel(item.category as ItemCategory);

  return (
    <button
      className="w-full flex items-start gap-3 rounded-md border p-3 text-left hover:bg-accent transition-colors"
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{item.name}</span>
          {item.is_magic && (
            <Badge variant="secondary" className={`text-xs ${RARITY_COLOR[item.rarity as keyof typeof RARITY_COLOR]}`}>
              {rarityLabel(item.rarity as keyof typeof RARITY_COLOR)}
            </Badge>
          )}
          {item.requires_attunement && (
            <Badge variant="outline" className="text-xs">Attunement</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
        {item.weight_lb != null && (
          <p className="text-xs text-muted-foreground">{item.weight_lb} lb</p>
        )}
      </div>
      {item.cost_gp != null && (
        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {item.cost_gp % 1 === 0 ? item.cost_gp : item.cost_gp.toFixed(2)} gp
        </span>
      )}
    </button>
  );
}

export function ItemPicker({
  open,
  onClose,
  onSelect,
  defaultCategory,
  initialCustom,
}: ItemPickerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(defaultCategory ?? "all");
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customWeight, setCustomWeight] = useState("");

  const search = useCallback(async (q: string, cat: string) => {
    setLoading(true);
    const items = await searchItemsClient(q, cat === "all" ? undefined : cat, 50);
    setResults(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const tid = setTimeout(() => search(query, category), 200);
    return () => clearTimeout(tid);
  }, [open, query, category, search]);

  useEffect(() => {
    if (!open) return;
    setCustomName(initialCustom?.name ?? "");
    setCustomWeight(
      initialCustom?.weightLb != null ? String(initialCustom.weightLb) : ""
    );
  }, [open, initialCustom?.name, initialCustom?.weightLb]);

  function resetForm() {
    setQuery("");
    setCustomName("");
    setCustomWeight("");
    setCategory(defaultCategory ?? "all");
  }

  function parseCustomWeight(): number | undefined {
    const trimmed = customWeight.trim();
    if (!trimmed) return undefined;
    const n = parseFloat(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }

  function handleSelect(item: Item) {
    onSelect({ source: "catalog", item });
    onClose();
    resetForm();
  }

  function handleAddCustom() {
    const name = customName.trim();
    if (!name) return;
    onSelect({ source: "custom", name, weightLb: parseCustomWeight() });
    onClose();
    resetForm();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{initialCustom ? "Edit Item" : "Add Item"}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Search items…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <Select value={category} onValueChange={(v) => setCategory(v ?? "all")}>
            <SelectTrigger className="w-44">
              <SelectValue>{categoryFilterLabel(category)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {ITEM_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {categoryLabel(cat)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 mt-2 min-h-0">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {query ? "No items found." : "Start typing to search items."}
            </p>
          ) : (
            results.map((item) => (
              <ItemRow key={item.id} item={item} onSelect={() => handleSelect(item)} />
            ))
          )}
        </div>

        <div className="border-t pt-3 space-y-2 shrink-0">
          <p className="text-xs text-muted-foreground">
            Custom item — not in the catalog (optional weight)
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Rusty gate key"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCustom();
                }
              }}
              className="flex-1"
            />
            <Input
              type="number"
              min={0}
              step="0.1"
              placeholder="lb"
              value={customWeight}
              onChange={(e) => setCustomWeight(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCustom();
                }
              }}
              className="w-20"
              aria-label="Weight in pounds"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!customName.trim()}
              onClick={handleAddCustom}
            >
              {initialCustom ? "Save" : "Add"}
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button variant="ghost" onClick={() => { onClose(); resetForm(); }}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
