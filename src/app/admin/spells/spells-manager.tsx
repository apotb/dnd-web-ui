"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { upsertSpellEntry, deleteSpellEntry } from "@/lib/content/catalog";

interface SpellRow {
  slug: string; name: string; level: number; school: string;
  castingTime: string; range: string; components: string; duration: string;
  description: string; ritual: boolean; concentration: boolean;
  classes: string[]; source: string;
}

const BLANK: SpellRow = {
  slug: "", name: "", level: 0, school: "Evocation",
  castingTime: "1 action", range: "Self", components: "V, S",
  duration: "Instantaneous", description: "", ritual: false, concentration: false,
  classes: [], source: "Custom",
};

const SCHOOLS = ["Abjuration","Conjuration","Divination","Enchantment","Evocation","Illusion","Necromancy","Transmutation"];

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function SpellsManager({ entries }: { entries: SpellRow[] }) {
  const [list, setList] = useState<SpellRow[]>(entries);
  const [filter, setFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<SpellRow | null>(null);
  const [form, setForm] = useState<SpellRow>({ ...BLANK });
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditRow(null);
    setForm({ ...BLANK });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(row: SpellRow) {
    setEditRow(row);
    setForm({ ...row });
    setFormError(null);
    setDialogOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const slug = form.slug || slugify(form.name);
      const result = await upsertSpellEntry(
        slug, form.name.trim(), form.level, form.school,
        form.castingTime, form.range, form.components, form.duration,
        form.description, form.ritual, form.concentration, form.classes,
        form.source.trim() || "Custom",
      );
      if (result.error) { setFormError(result.error); return; }
      const row: SpellRow = { ...form, slug, name: form.name.trim() };
      setList((prev) => {
        const next = editRow ? prev.map((r) => r.slug === editRow.slug ? row : r) : [...prev, row];
        return next.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
      });
      setDialogOpen(false);
    });
  }

  function handleDelete(row: SpellRow) {
    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteSpellEntry(row.slug);
      if (result.error) alert(`Delete failed: ${result.error}`);
      else setList((prev) => prev.filter((r) => r.slug !== row.slug));
    });
  }

  const filtered = list.filter((r) => {
    const q = filter.toLowerCase();
    const matchText = r.name.toLowerCase().includes(q) || r.slug.includes(q);
    const matchLevel = levelFilter === "all" || r.level === Number(levelFilter);
    return matchText && matchLevel;
  });

  return (
    <div className="space-y-4">
      <div className="retro-box">
        <div className="flex gap-2 flex-wrap items-center">
          <Input placeholder="Filter by name…" value={filter} onChange={(e) => setFilter(e.target.value)} className="flex-1 min-w-48" />
          <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v ?? "all")}>
            <SelectTrigger className="w-36">
              <SelectValue>
                {levelFilter === "all" ? "All levels" : levelFilter === "0" ? "Cantrip" : `Level ${levelFilter}`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              <SelectItem value="0">Cantrip</SelectItem>
              {[1,2,3,4,5,6,7,8,9].map((l) => <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>+ Add Spell</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{filtered.length} of {list.length} spells</p>
      </div>

      <div className="retro-box" style={{ padding: 0 }}>
        <div className="grid grid-cols-[1fr_40px_130px_80px_160px] gap-0 border-b px-4 py-2 bg-muted/50 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <span>Name</span>
          <span className="pr-2">Lvl</span>
          <span className="pr-4">School</span>
          <span className="pr-4">Source</span>
          <span />
        </div>
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No spells found.</p>}
        {filtered.map((row, idx) => (
          <div key={row.slug} className={`grid grid-cols-[1fr_40px_130px_80px_160px] items-center gap-0 px-4 py-2.5 ${idx !== filtered.length - 1 ? "border-b" : ""}`}>
            <div className="min-w-0">
              <span className="font-medium text-sm">{row.name}</span>
              <div className="text-xs text-muted-foreground">{row.classes.join(", ") || "—"}</div>
            </div>
            <span className="text-sm text-muted-foreground pr-4">{row.level === 0 ? "C" : row.level}</span>
            <span className="text-sm text-muted-foreground pr-4">{row.school}</span>
            <span className="text-sm text-muted-foreground pr-4">{row.source}</span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => openEdit(row)}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(row)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="w-full sm:max-w-[720px] max-h-[90vh] overflow-y-auto p-8">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl">{editRow ? `Edit: ${editRow.name}` : "New Spell"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => { const name = e.target.value; setForm((f) => ({ ...f, name, slug: f.slug || slugify(name) })); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="auto-generated" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Level (0 = cantrip)</Label>
                <Input type="number" min={0} max={9} value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>School</Label>
                <Select value={form.school} onValueChange={(v) => v && setForm((f) => ({ ...f, school: v }))}>
                  <SelectTrigger><SelectValue>{form.school}</SelectValue></SelectTrigger>
                  <SelectContent>{SCHOOLS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Input value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} placeholder="PHB, Custom…" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Casting Time</Label>
                <Input value={form.castingTime} onChange={(e) => setForm((f) => ({ ...f, castingTime: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Range</Label>
                <Input value={form.range} onChange={(e) => setForm((f) => ({ ...f, range: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Components</Label>
                <Input value={form.components} onChange={(e) => setForm((f) => ({ ...f, components: e.target.value }))} placeholder="V, S, M (…)" />
              </div>
              <div className="space-y-1.5">
                <Label>Duration</Label>
                <Input value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Spell Lists (comma-separated class IDs)</Label>
              <Input value={form.classes.join(", ")} onChange={(e) => setForm((f) => ({ ...f, classes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))} placeholder="bard, cleric, wizard" />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.ritual} onChange={(e) => setForm((f) => ({ ...f, ritual: e.target.checked }))} className="h-4 w-4" /> Ritual
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.concentration} onChange={(e) => setForm((f) => ({ ...f, concentration: e.target.checked }))} className="h-4 w-4" /> Concentration
              </label>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter className="mt-6 -mx-8 -mb-8">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending || !form.name}>{isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
