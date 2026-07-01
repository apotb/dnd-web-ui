"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { CatalogFeaturesEditor } from "@/components/admin/catalog-features-editor";
import { upsertClassEntry, deleteClassEntry } from "@/lib/content/catalog";
import type { CatalogFeatureEntry } from "@/lib/dnd/catalog-feature-mechanics";
import type { ContentEntry } from "../content-manager";

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function ClassesManager({ entries }: { entries: ContentEntry[] }) {
  const [list, setList] = useState<ContentEntry[]>(entries);
  const [filter, setFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<ContentEntry | null>(null);
  const [form, setForm] = useState({
    slug: "",
    name: "",
    source: "PHB",
    hitDie: 8,
    jsonData: "{}",
    features: [] as CatalogFeatureEntry[],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditRow(null);
    setForm({ slug: "", name: "", source: "PHB", hitDie: 8, jsonData: "{}", features: [] });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(row: ContentEntry) {
    setEditRow(row);
    const hitDie = (row.extra?.hitDie as number) ?? 8;
    const { hitDie: _hd, features, ...rest } = row.extra ?? {};
    setForm({
      slug: row.slug,
      name: row.name,
      source: row.source,
      hitDie,
      jsonData: JSON.stringify(rest, null, 2),
      features: Array.isArray(features) ? (features as CatalogFeatureEntry[]) : [],
    });
    setFormError(null);
    setDialogOpen(true);
  }

  function handleSave() {
    let data: unknown;
    try {
      data = { ...JSON.parse(form.jsonData || "{}"), features: form.features };
    } catch {
      setFormError("Invalid JSON.");
      return;
    }
    startTransition(async () => {
      const slug = form.slug || slugify(form.name);
      const result = await upsertClassEntry(slug, form.name.trim(), form.hitDie, form.source.trim() || "Custom", data);
      if (result.error) { setFormError(result.error); return; }
      const row: ContentEntry = { slug, name: form.name.trim(), source: form.source.trim() || "Custom", extra: { ...(data as Record<string, unknown>), hitDie: form.hitDie } };
      setList((prev) => {
        const next = editRow ? prev.map((r) => r.slug === editRow.slug ? row : r) : [...prev, row];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setDialogOpen(false);
    });
  }

  function handleDelete(row: ContentEntry) {
    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteClassEntry(row.slug);
      if (result.error) alert(`Delete failed: ${result.error}`);
      else setList((prev) => prev.filter((r) => r.slug !== row.slug));
    });
  }

  const filtered = list.filter((r) =>
    r.name.toLowerCase().includes(filter.toLowerCase()) || r.slug.includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="retro-box">
        <div className="flex gap-2 flex-wrap items-center">
          <Input placeholder="Filter by name…" value={filter} onChange={(e) => setFilter(e.target.value)} className="flex-1 min-w-48" />
          <Button onClick={openCreate}>+ Add Class</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{filtered.length} of {list.length} classes</p>
      </div>

      <div className="retro-box" style={{ padding: 0 }}>
        <div className="grid grid-cols-[1fr_80px_80px_160px] gap-0 border-b px-4 py-2 bg-muted/50 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <span>Name</span>
          <span className="pr-4">Hit Die</span>
          <span className="pr-4">Source</span>
          <span />
        </div>
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No classes found.</p>}
        {filtered.map((row, idx) => (
          <div key={row.slug} className={`grid grid-cols-[1fr_80px_80px_160px] items-center gap-0 px-4 py-2.5 ${idx !== filtered.length - 1 ? "border-b" : ""}`}>
            <div className="min-w-0">
              <span className="font-medium text-sm">{row.name}</span>
              <div className="text-xs text-muted-foreground">{row.slug}</div>
            </div>
            <span className="text-sm text-muted-foreground pr-4">d{String(row.extra?.hitDie ?? "?")}</span>
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
            <DialogTitle className="text-xl">{editRow ? `Edit: ${editRow.name}` : "New Class"}</DialogTitle>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Hit Die</Label>
                <Input type="number" min={4} max={12} step={2} value={form.hitDie} onChange={(e) => setForm((f) => ({ ...f, hitDie: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Input value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} placeholder="PHB, Custom…" />
              </div>
            </div>
            <CatalogFeaturesEditor
              label="Class features"
              features={form.features}
              onChange={(features) => setForm((f) => ({ ...f, features }))}
            />
            <div className="space-y-1.5">
              <Label>Other data (JSON — PhbClass without features)</Label>
              <p className="text-xs text-muted-foreground">{`{ "savingThrows": ["str","con"], "skillChoiceCount": 2, "skillOptions": [...], "fixedEquipment": [...], "equipmentChoices": [...], "subclasses": [...] }`}</p>
              <Textarea rows={10} className="font-mono text-xs" value={form.jsonData} onChange={(e) => setForm((f) => ({ ...f, jsonData: e.target.value }))} />
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
