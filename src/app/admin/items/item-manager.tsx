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
  WEAPON_PROPERTIES,
  categoryLabel,
  rarityLabel,
  weaponCategoryLabel,
  weaponRangeLabel,
  armorTypeLabel,
  subcategoryLabel,
  subcategoryOptionsForCategory,
  getWeaponProperties,
  getArmorProperties,
  getShieldProperties,
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
  requires_attunement: false,
  is_magic: false,
  showAdvancedJson: false,
  advancedProperties: "{}",
};

const EMPTY_WEAPON_STATS = {
  damage: "",
  damageType: "",
  versatileDamage: "",
  weaponCategory: "simple" as "simple" | "martial",
  weaponRange: "melee" as "melee" | "ranged",
  weaponProperties: [] as string[],
};

const EMPTY_ARMOR_STATS = {
  armorType: "light" as "light" | "medium" | "heavy",
  armorClass: "11",
  dexBonus: true,
  maxDexBonus: "",
  strengthRequirement: "0",
  stealthDisadvantage: false,
};

type FormState = typeof EMPTY_FORM;

function buildProperties(
  category: ItemCategory,
  weaponStats: typeof EMPTY_WEAPON_STATS,
  armorStats: typeof EMPTY_ARMOR_STATS,
  shieldAc: string,
  advancedJson: string,
  useAdvanced: boolean
): Record<string, unknown> {
  if (useAdvanced) {
    return JSON.parse(advancedJson || "{}") as Record<string, unknown>;
  }
  if (category === "weapon") {
    return {
      damage: weaponStats.damage,
      damageType: weaponStats.damageType,
      ...(weaponStats.versatileDamage
        ? { versatileDamage: weaponStats.versatileDamage }
        : {}),
      weaponCategory: weaponStats.weaponCategory,
      weaponRange: weaponStats.weaponRange,
      weaponProperties: weaponStats.weaponProperties,
    };
  }
  if (category === "armor") {
    return {
      armorType: armorStats.armorType,
      armorClass: parseInt(armorStats.armorClass, 10) || 11,
      dexBonus: armorStats.dexBonus,
      maxDexBonus: armorStats.maxDexBonus
        ? parseInt(armorStats.maxDexBonus, 10)
        : null,
      strengthRequirement: parseInt(armorStats.strengthRequirement, 10) || 0,
      stealthDisadvantage: armorStats.stealthDisadvantage,
    };
  }
  if (category === "shield") {
    return { armorClass: parseInt(shieldAc, 10) || 2 };
  }
  return {};
}

function loadStatsFromItem(
  item: Item,
  setWeaponStats: (v: typeof EMPTY_WEAPON_STATS) => void,
  setArmorStats: (v: typeof EMPTY_ARMOR_STATS) => void,
  setShieldAc: (v: string) => void
) {
  if (item.category === "weapon") {
    const w = getWeaponProperties(item);
    if (w) {
      setWeaponStats({
        damage: w.damage ?? "",
        damageType: w.damageType ?? "",
        versatileDamage: w.versatileDamage ?? "",
        weaponCategory: w.weaponCategory ?? "simple",
        weaponRange: w.weaponRange ?? "melee",
        weaponProperties: w.weaponProperties ?? [],
      });
    }
  } else if (item.category === "armor") {
    const a = getArmorProperties(item);
    if (a) {
      setArmorStats({
        armorType: a.armorType ?? "light",
        armorClass: String(a.armorClass ?? 11),
        dexBonus: a.dexBonus ?? true,
        maxDexBonus: a.maxDexBonus != null ? String(a.maxDexBonus) : "",
        strengthRequirement: String(a.strengthRequirement ?? 0),
        stealthDisadvantage: a.stealthDisadvantage ?? false,
      });
    }
  } else if (item.category === "shield") {
    const s = getShieldProperties(item);
    setShieldAc(String(s?.armorClass ?? 2));
  }
}

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
  const [weaponStats, setWeaponStats] = useState(EMPTY_WEAPON_STATS);
  const [armorStats, setArmorStats] = useState(EMPTY_ARMOR_STATS);
  const [shieldAc, setShieldAc] = useState("2");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const subcategoryOptions = subcategoryOptionsForCategory(form.category);
  const selectedSubcategoryHint = subcategoryOptions.find(
    (o) => o.value === form.subcategory
  )?.hint;

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setWeaponStats(EMPTY_WEAPON_STATS);
    setArmorStats(EMPTY_ARMOR_STATS);
    setShieldAc("2");
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
      requires_attunement: item.requires_attunement,
      is_magic: item.is_magic,
      showAdvancedJson: false,
      advancedProperties: JSON.stringify(item.properties, null, 2),
    });
    setWeaponStats(EMPTY_WEAPON_STATS);
    setArmorStats(EMPTY_ARMOR_STATS);
    setShieldAc("2");
    loadStatsFromItem(item, setWeaponStats, setArmorStats, setShieldAc);
    setFormError(null);
    setDialogOpen(true);
  }

  function handleSave() {
    let props: Record<string, unknown>;
    try {
      props = buildProperties(
        form.category,
        weaponStats,
        armorStats,
        shieldAc,
        form.advancedProperties,
        form.showAdvancedJson
      );
    } catch {
      setFormError("Advanced properties must be valid JSON.");
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
          {filtered.length} of {items.length} items
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
                {item.subcategory
                  ? ` · ${subcategoryLabel(item.subcategory)}`
                  : ""}
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
                <Select value={form.category} onValueChange={(v) => v && setForm((f) => ({ ...f, category: v as ItemCategory, subcategory: "" }))}>
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
                {subcategoryOptions.length > 0 ? (
                  <>
                    <Select
                      value={form.subcategory || "__none__"}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          subcategory: v === "__none__" ? "" : (v ?? ""),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {form.subcategory
                            ? subcategoryLabel(form.subcategory)
                            : "None"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {subcategoryOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {selectedSubcategoryHint ??
                        (form.category === "tool"
                          ? "Character creation pickers group tools by subcategory (e.g. Artisan's tools, Musical instrument)."
                          : "Used to filter items in character creation and combat rules.")}
                    </p>
                  </>
                ) : (
                  <>
                    <Input
                      value={form.subcategory}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, subcategory: e.target.value }))
                      }
                      placeholder="Optional"
                    />
                    <p className="text-xs text-muted-foreground">
                      No preset subcategories for this category.
                    </p>
                  </>
                )}
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

            {/* Structured stats (weapons / armor / shield) */}
            {form.category === "weapon" && !form.showAdvancedJson ? (
              <div className="space-y-3 retro-note" style={{ padding: "12px" }}>
                <p className="text-sm font-medium">Weapon stats</p>
                <p className="text-xs text-muted-foreground">
                  Used for attack rolls and the equipment picker. Most gear and tools do not need extra stats.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Damage dice</Label>
                    <Input
                      value={weaponStats.damage}
                      placeholder="1d8"
                      onChange={(e) =>
                        setWeaponStats((s) => ({ ...s, damage: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Damage type</Label>
                    <Input
                      value={weaponStats.damageType}
                      placeholder="slashing"
                      onChange={(e) =>
                        setWeaponStats((s) => ({ ...s, damageType: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Weapon category</Label>
                    <Select
                      value={weaponStats.weaponCategory}
                      onValueChange={(v) =>
                        v &&
                        setWeaponStats((s) => ({
                          ...s,
                          weaponCategory: v as "simple" | "martial",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>{weaponCategoryLabel(weaponStats.weaponCategory)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple">Simple</SelectItem>
                        <SelectItem value="martial">Martial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Range</Label>
                    <Select
                      value={weaponStats.weaponRange}
                      onValueChange={(v) =>
                        v &&
                        setWeaponStats((s) => ({
                          ...s,
                          weaponRange: v as "melee" | "ranged",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>{weaponRangeLabel(weaponStats.weaponRange)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="melee">Melee</SelectItem>
                        <SelectItem value="ranged">Ranged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Versatile damage (optional)</Label>
                    <Input
                      value={weaponStats.versatileDamage}
                      placeholder="1d10"
                      onChange={(e) =>
                        setWeaponStats((s) => ({
                          ...s,
                          versatileDamage: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Properties</Label>
                  <div className="flex flex-wrap gap-2">
                    {WEAPON_PROPERTIES.map((prop) => (
                      <label
                        key={prop}
                        className="flex items-center gap-1.5 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={weaponStats.weaponProperties.includes(prop)}
                          onChange={(e) =>
                            setWeaponStats((s) => ({
                              ...s,
                              weaponProperties: e.target.checked
                                ? [...s.weaponProperties, prop]
                                : s.weaponProperties.filter((p) => p !== prop),
                            }))
                          }
                          className="h-3.5 w-3.5"
                        />
                        {prop}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {form.category === "armor" && !form.showAdvancedJson ? (
              <div className="space-y-3 retro-note" style={{ padding: "12px" }}>
                <p className="text-sm font-medium">Armor stats</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Armor type</Label>
                    <Select
                      value={armorStats.armorType}
                      onValueChange={(v) =>
                        v &&
                        setArmorStats((s) => ({
                          ...s,
                          armorType: v as "light" | "medium" | "heavy",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>{armorTypeLabel(armorStats.armorType)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="heavy">Heavy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Base AC</Label>
                    <Input
                      type="number"
                      value={armorStats.armorClass}
                      onChange={(e) =>
                        setArmorStats((s) => ({ ...s, armorClass: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Max DEX bonus</Label>
                    <Input
                      type="number"
                      value={armorStats.maxDexBonus}
                      placeholder="blank = unlimited"
                      onChange={(e) =>
                        setArmorStats((s) => ({ ...s, maxDexBonus: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>STR requirement</Label>
                    <Input
                      type="number"
                      value={armorStats.strengthRequirement}
                      onChange={(e) =>
                        setArmorStats((s) => ({
                          ...s,
                          strengthRequirement: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={armorStats.dexBonus}
                      onChange={(e) =>
                        setArmorStats((s) => ({ ...s, dexBonus: e.target.checked }))
                      }
                      className="h-4 w-4"
                    />
                    DEX bonus to AC
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={armorStats.stealthDisadvantage}
                      onChange={(e) =>
                        setArmorStats((s) => ({
                          ...s,
                          stealthDisadvantage: e.target.checked,
                        }))
                      }
                      className="h-4 w-4"
                    />
                    Stealth disadvantage
                  </label>
                </div>
              </div>
            ) : null}

            {form.category === "shield" && !form.showAdvancedJson ? (
              <div className="space-y-3 retro-note" style={{ padding: "12px" }}>
                <p className="text-sm font-medium">Shield stats</p>
                <div className="space-y-1.5 max-w-xs">
                  <Label>AC bonus</Label>
                  <Input
                    type="number"
                    value={shieldAc}
                    onChange={(e) => setShieldAc(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {!["weapon", "armor", "shield"].includes(form.category) &&
            !form.showAdvancedJson ? (
              <p className="retro-note text-xs">
                No extra stats needed for{" "}
                {categoryLabel(form.category).toLowerCase()} items — weight, cost,
                and subcategory (for tools) are enough. Set{" "}
                <strong>Category → Tool</strong> and{" "}
                <strong>Subcategory → Artisan&apos;s tools</strong> (for example)
                so the item appears in character creation pickers.
              </p>
            ) : null}

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showAdvancedJson}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, showAdvancedJson: e.target.checked }))
                  }
                  className="h-4 w-4"
                />
                Edit raw JSON (advanced)
              </label>
              {form.showAdvancedJson ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Raw stats stored in the database. Overrides the form fields
                    above when saved. Leave as <code>{"{}"}</code> for simple
                    items with no mechanical stats.
                  </p>
                  <Textarea
                    rows={5}
                    className="font-mono text-xs"
                    value={form.advancedProperties}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, advancedProperties: e.target.value }))
                    }
                  />
                </>
              ) : null}
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
