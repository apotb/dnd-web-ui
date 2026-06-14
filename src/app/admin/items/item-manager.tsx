"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ITEM_CATEGORIES,
  ITEM_RARITIES,
  categoryLabel,
  rarityLabel,
  RARITY_COLOR,
  type Item,
  type ItemCategory,
  type ItemRarity,
} from "@/lib/schemas/item";

interface ItemManagerProps {
  initialItems: Item[];
  onSave: (item: Omit<Item, "id" | "created_at" | "updated_at"> & { id?: string }) => Promise<Item | null>;
  onDelete: (id: string) => Promise<boolean>;
}

const EMPTY_FORM = {
  slug: "",
  name: "",
  category: "adventuring_gear" as ItemCategory,
  subcategory: "",
  source: "Custom",
  rarity: "common" as ItemRarity,
  weight_lb: "",
  cost_gp: "",
  description: "",
  properties: "{}",
  requires_attunement: false,
  is_magic: false,
};

type FormState = typeof EMPTY_FORM;

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function ItemManager({ initialItems, onSave, onDelete }: ItemManagerProps) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(item: Item) {
    setEditItem(item);
    setForm({
      slug: item.slug,
      name: item.name,
      category: item.category as ItemCategory,
      subcategory: item.subcategory ?? "",
      source: item.source,
      rarity: item.rarity as ItemRarity,
      weight_lb: item.weight_lb != null ? String(item.weight_lb) : "",
      cost_gp: item.cost_gp != null ? String(item.cost_gp) : "",
      description: item.description,
      properties: JSON.stringify(item.properties, null, 2),
      requires_attunement: item.requires_attunement,
      is_magic: item.is_magic,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  function handleSave() {
    let props: Record<string, unknown> = {};
    try {
      props = JSON.parse(form.properties || "{}");
    } catch {
      setFormError("Properties must be valid JSON.");
      return;
    }

    const payload = {
      ...(editItem ? { id: editItem.id } : {}),
      slug: form.slug || slugify(form.name),
      name: form.name.trim(),
      category: form.category,
      subcategory: form.subcategory.trim() || null,
      source: form.source.trim() || "Custom",
      rarity: form.rarity,
      weight_lb: form.weight_lb !== "" ? parseFloat(form.weight_lb) : null,
      cost_gp: form.cost_gp !== "" ? parseFloat(form.cost_gp) : null,
      description: form.description.trim(),
      properties: props,
      requires_attunement: form.requires_attunement,
      is_magic: form.is_magic,
    };

    startTransition(async () => {
      const saved = await onSave(payload);
      if (!saved) {
        setFormError("Failed to save item.");
        return;
      }
      setItems((prev) =>
        editItem
          ? prev.map((it) => (it.id === saved.id ? saved : it))
          : [...prev, saved]
      );
      setDialogOpen(false);
    });
  }

  function handleDelete(item: Item) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const ok = await onDelete(item.id);
      if (ok) setItems((prev) => prev.filter((it) => it.id !== item.id));
    });
  }

  const filtered = items.filter((item) => {
    const matchName = item.name.toLowerCase().includes(filter.toLowerCase());
    const matchCat = categoryFilter === "all" || item.category === categoryFilter;
    return matchName && matchCat;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="retro-box">
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            placeholder="Filter by name…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 min-w-48"
          />
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
            <SelectTrigger className="w-44">
              <SelectValue>
                {categoryFilter === "all" ? "All categories" : categoryLabel(categoryFilter as ItemCategory)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {ITEM_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{categoryLabel(cat)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>+ Add Item</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {filtered.length} item{filtered.length !== 1 ? "s" : ""} shown
          {items.length !== filtered.length ? ` of ${items.length}` : ""}
        </p>
      </div>

      {/* Item list */}
      <div className="retro-box" style={{ padding: 0 }}>
        {/* Header row */}
        <div className="grid grid-cols-[1fr_88px_88px_160px] gap-0 border-b px-4 py-2 bg-muted/50 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <span>Item</span>
          <span className="text-right pr-4">Weight</span>
          <span className="text-right pr-4">Cost</span>
          <span />
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No items found.</p>
        )}

        {filtered.map((item, idx) => (
          <div
            key={item.id}
            className={`grid grid-cols-[1fr_88px_88px_160px] items-center gap-0 px-4 py-2.5 ${idx !== filtered.length - 1 ? "border-b" : ""}`}
          >
            {/* Name + meta */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{item.name}</span>
                {item.rarity !== "common" && (
                  <Badge variant="secondary" className={`text-xs ${RARITY_COLOR[item.rarity as ItemRarity]}`}>
                    {rarityLabel(item.rarity as ItemRarity)}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {categoryLabel(item.category as ItemCategory)}
                {item.source !== "SRD" && ` · ${item.source}`}
                <span className="ml-1 opacity-50">{item.slug}</span>
              </div>
            </div>

            <span className="text-right pr-4 text-sm text-muted-foreground whitespace-nowrap">
              {item.weight_lb != null ? `${item.weight_lb} lb` : "—"}
            </span>
            <span className="text-right pr-4 text-sm text-muted-foreground whitespace-nowrap">
              {item.cost_gp != null ? `${item.cost_gp} gp` : "—"}
            </span>

            <div className="flex gap-1.5 justify-end">
              <Button size="sm" variant="outline" onClick={() => openEdit(item)}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(item)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="w-full sm:max-w-[720px] max-h-[90vh] overflow-y-auto p-8">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl">{editItem ? `Edit: ${editItem.name}` : "New Item"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({ ...f, name, slug: f.slug || slugify(name) }));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Slug (unique ID)</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="auto-generated from name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => v && setForm((f) => ({ ...f, category: v as ItemCategory }))}>
                  <SelectTrigger><SelectValue>{categoryLabel(form.category)}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {ITEM_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{categoryLabel(cat)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Subcategory</Label>
                <Input
                  value={form.subcategory}
                  onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}
                  placeholder="e.g. martial_melee, light_armor"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Rarity</Label>
                <Select value={form.rarity} onValueChange={(v) => v && setForm((f) => ({ ...f, rarity: v as ItemRarity, is_magic: v !== "common" || f.is_magic }))}>
                  <SelectTrigger><SelectValue>{rarityLabel(form.rarity)}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {ITEM_RARITIES.map((r) => (
                      <SelectItem key={r} value={r}>{rarityLabel(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Weight (lb)</Label>
                <Input type="number" value={form.weight_lb} onChange={(e) => setForm((f) => ({ ...f, weight_lb: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Cost (gp)</Label>
                <Input type="number" value={form.cost_gp} onChange={(e) => setForm((f) => ({ ...f, cost_gp: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Input value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} placeholder="SRD, PHB, Custom…" />
              </div>
              <div className="flex gap-6 items-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_magic} onChange={(e) => setForm((f) => ({ ...f, is_magic: e.target.checked }))} className="h-4 w-4" />
                  Magic Item
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.requires_attunement} onChange={(e) => setForm((f) => ({ ...f, requires_attunement: e.target.checked }))} className="h-4 w-4" />
                  Requires Attunement
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label>Properties (JSON)</Label>
              <p className="text-xs text-muted-foreground">
                Weapon: {`{"damage":"1d8","damageType":"slashing","weaponCategory":"martial","weaponRange":"melee","weaponProperties":["versatile"]}`}
                <br />
                Armor: {`{"armorType":"medium","armorClass":14,"dexBonus":true,"maxDexBonus":2,"strengthRequirement":0,"stealthDisadvantage":false}`}
              </p>
              <Textarea rows={5} className="font-mono text-xs" value={form.properties} onChange={(e) => setForm((f) => ({ ...f, properties: e.target.value }))} />
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>

          <DialogFooter className="mt-6 -mx-8 -mb-8">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending || !form.name}>
              {isPending ? "Saving…" : "Save Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
