"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { upsertFeatEntry, deleteFeatEntry } from "@/lib/content/catalog";

interface FeatRow {
  slug: string; name: string; description: string; prerequisite: string; source: string;
  extra: Record<string, unknown>;
}

const BLANK: FeatRow = { slug: "", name: "", description: "", prerequisite: "", source: "PHB", extra: {} };

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function FeatsManager({ entries }: { entries: FeatRow[] }) {
  const [list, setList] = useState<FeatRow[]>(entries);
  const [filter, setFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<FeatRow | null>(null);
  const [form, setForm] = useState<FeatRow>({ ...BLANK });
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditRow(null);
    setForm({ ...BLANK });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(row: FeatRow) {
    setEditRow(row);
    setForm({ ...row });
    setFormError(null);
    setDialogOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const slug = form.slug || slugify(form.name);
      const result = await upsertFeatEntry(
        slug, form.name.trim(), form.description.trim(),
        form.prerequisite.trim() || null, form.source.trim() || "Custom", form.extra,
      );
      if (result.error) { setFormError(result.error); return; }
      const row: FeatRow = { ...form, slug, name: form.name.trim() };
      setList((prev) => {
        const next = editRow ? prev.map((r) => r.slug === editRow.slug ? row : r) : [...prev, row];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setDialogOpen(false);
    });
  }

  function handleDelete(row: FeatRow) {
    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteFeatEntry(row.slug);
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
          <Button onClick={openCreate}>+ Add Feat</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{filtered.length} of {list.length} feats</p>
      </div>

      <div className="retro-box" style={{ padding: 0 }}>
        <div className="grid grid-cols-[1fr_160px_80px_160px] gap-0 border-b px-4 py-2 bg-muted/50 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <span>Name</span>
          <span className="pr-4">Prerequisite</span>
          <span className="pr-4">Source</span>
          <span />
        </div>
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No feats found. Click "Seed from PHB" to populate.</p>}
        {filtered.map((row, idx) => (
          <div key={row.slug} className={`grid grid-cols-[1fr_160px_80px_160px] items-center gap-0 px-4 py-2.5 ${idx !== filtered.length - 1 ? "border-b" : ""}`}>
            <div className="min-w-0">
              <span className="font-medium text-sm">{row.name}</span>
              <div className="text-xs text-muted-foreground" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "340px" }}>
                {row.description}
              </div>
            </div>
            <span className="text-sm text-muted-foreground pr-4">{row.prerequisite || "—"}</span>
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
            <DialogTitle className="text-xl">{editRow ? `Edit: ${editRow.name}` : "New Feat"}</DialogTitle>
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
                <Label>Prerequisite (optional)</Label>
                <Input value={form.prerequisite} onChange={(e) => setForm((f) => ({ ...f, prerequisite: e.target.value }))} placeholder="e.g. Str 13, 4th level" />
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Input value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} placeholder="PHB, Custom…" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description *</Label>
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
