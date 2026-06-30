"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  deleteConditionEntry,
  upsertConditionEntry,
} from "@/lib/content/catalog";
import { slugifyConditionName } from "@/lib/dnd/conditions";

interface ConditionRow {
  slug: string;
  name: string;
  description: string;
  isStandard: boolean;
  source: string;
}

const BLANK: ConditionRow = {
  slug: "",
  name: "",
  description: "",
  isStandard: false,
  source: "Custom",
};

export function ConditionsManager({ entries }: { entries: ConditionRow[] }) {
  const [list, setList] = useState<ConditionRow[]>(entries);
  const [filter, setFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<ConditionRow | null>(null);
  const [form, setForm] = useState<ConditionRow>({ ...BLANK });
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditRow(null);
    setForm({ ...BLANK });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(row: ConditionRow) {
    setEditRow(row);
    setForm({ ...row });
    setFormError(null);
    setDialogOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const slug = form.slug || slugifyConditionName(form.name);
      const result = await upsertConditionEntry(
        slug,
        form.name.trim(),
        form.description.trim(),
        editRow?.isStandard ?? form.isStandard,
        form.source.trim() || "Custom"
      );
      if (result.error) {
        setFormError(result.error);
        return;
      }
      const row: ConditionRow = {
        ...form,
        slug,
        name: form.name.trim(),
        description: form.description.trim(),
        isStandard: editRow?.isStandard ?? form.isStandard,
      };
      setList((prev) => {
        const next = editRow
          ? prev.map((r) => (r.slug === editRow.slug ? row : r))
          : [...prev, row];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setDialogOpen(false);
    });
  }

  function handleDelete(row: ConditionRow) {
    if (row.isStandard) return;
    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteConditionEntry(row.slug);
      if (result.error) alert(`Delete failed: ${result.error}`);
      else setList((prev) => prev.filter((r) => r.slug !== row.slug));
    });
  }

  const filtered = list.filter(
    (r) =>
      r.name.toLowerCase().includes(filter.toLowerCase()) ||
      r.slug.includes(filter.toLowerCase())
  );

  const editingStandard = Boolean(editRow?.isStandard);

  return (
    <div className="space-y-4">
      <div className="retro-box">
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            placeholder="Filter conditions…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 min-w-48"
          />
          <Button onClick={openCreate}>+ Add Condition</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {filtered.length} of {list.length} conditions
        </p>
      </div>

      <div className="retro-box" style={{ padding: 0 }}>
        <div className="grid grid-cols-[1fr_80px_80px_160px] gap-0 border-b px-4 py-2 bg-muted/50 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <span>Condition</span>
          <span className="pr-4">Standard</span>
          <span className="pr-4">Source</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No conditions found.
          </p>
        ) : null}

        {filtered.map((row, idx) => (
          <div
            key={row.slug}
            className={`grid grid-cols-[1fr_80px_80px_160px] items-center gap-0 px-4 py-2.5 ${idx !== filtered.length - 1 ? "border-b" : ""}`}
          >
            <div className="min-w-0">
              <span className="font-medium text-sm">{row.name}</span>
              <div className="text-xs text-muted-foreground">
                <span className="opacity-50">{row.slug}</span>
              </div>
            </div>
            <span className="text-sm text-muted-foreground pr-4">
              {row.isStandard ? "Yes" : "—"}
            </span>
            <span className="text-sm text-muted-foreground pr-4">
              {row.source || "—"}
            </span>
            <div className="flex gap-1.5 justify-end">
              <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDelete(row)}
                disabled={isPending || row.isStandard}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editRow ? "Edit condition" : "Add condition"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cond-name">Name</Label>
              <Input
                id="cond-name"
                value={form.name}
                disabled={editingStandard}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cond-slug">Slug</Label>
              <Input
                id="cond-slug"
                value={form.slug || slugifyConditionName(form.name)}
                disabled={editingStandard}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cond-source">Source</Label>
              <Input
                id="cond-source"
                value={form.source}
                disabled={editingStandard}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cond-description">Description (rules text)</Label>
              <Textarea
                id="cond-description"
                rows={8}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending || !form.name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
