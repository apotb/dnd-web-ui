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
  deleteLanguageEntry,
  upsertLanguageEntry,
} from "@/lib/content/catalog";

interface LanguageRow {
  slug: string;
  name: string;
  script: string;
  isStandard: boolean;
  source: string;
  description: string;
}

const BLANK: LanguageRow = {
  slug: "",
  name: "",
  script: "",
  isStandard: false,
  source: "Custom",
  description: "",
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function LanguagesManager({ entries }: { entries: LanguageRow[] }) {
  const [list, setList] = useState<LanguageRow[]>(entries);
  const [filter, setFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<LanguageRow | null>(null);
  const [form, setForm] = useState<LanguageRow>({ ...BLANK });
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditRow(null);
    setForm({ ...BLANK });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(row: LanguageRow) {
    setEditRow(row);
    setForm({ ...row });
    setFormError(null);
    setDialogOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const slug = form.slug || slugify(form.name);
      const result = await upsertLanguageEntry(
        slug,
        form.name.trim(),
        form.script.trim() || null,
        form.isStandard,
        form.source.trim() || "Custom",
        form.description.trim()
      );
      if (result.error) {
        setFormError(result.error);
        return;
      }
      const row: LanguageRow = {
        ...form,
        slug,
        name: form.name.trim(),
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

  function handleDelete(row: LanguageRow) {
    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteLanguageEntry(row.slug);
      if (result.error) alert(`Delete failed: ${result.error}`);
      else setList((prev) => prev.filter((r) => r.slug !== row.slug));
    });
  }

  const filtered = list.filter(
    (r) =>
      r.name.toLowerCase().includes(filter.toLowerCase()) ||
      r.slug.includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="retro-box">
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            placeholder="Filter languages…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 min-w-48"
          />
          <Button onClick={openCreate}>+ Add Language</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {filtered.length} of {list.length} languages
        </p>
      </div>

      <div className="retro-box" style={{ padding: 0 }}>
        <div className="grid grid-cols-[1fr_120px_80px_80px_160px] gap-0 border-b px-4 py-2 bg-muted/50 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <span>Language</span>
          <span className="pr-4">Script</span>
          <span className="pr-4">Standard</span>
          <span className="pr-4">Source</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No languages found.
          </p>
        ) : null}

        {filtered.map((row, idx) => (
          <div
            key={row.slug}
            className={`grid grid-cols-[1fr_120px_80px_80px_160px] items-center gap-0 px-4 py-2.5 ${idx !== filtered.length - 1 ? "border-b" : ""}`}
          >
            <div className="min-w-0">
              <span className="font-medium text-sm">{row.name}</span>
              <div className="text-xs text-muted-foreground">
                <span className="opacity-50">{row.slug}</span>
              </div>
            </div>
            <span className="text-sm text-muted-foreground pr-4">
              {row.script || "—"}
            </span>
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
                disabled={isPending}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editRow ? "Edit language" : "Add language"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="lang-name">Name</Label>
              <Input
                id="lang-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="lang-slug">Slug</Label>
              <Input
                id="lang-slug"
                value={form.slug}
                placeholder={slugify(form.name) || "auto-generated"}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="lang-script">Script (optional)</Label>
              <Input
                id="lang-script"
                value={form.script}
                onChange={(e) => setForm({ ...form, script: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isStandard}
                onChange={(e) => setForm({ ...form, isStandard: e.target.checked })}
              />
              Standard language (background picks)
            </label>
            <div>
              <Label htmlFor="lang-source">Source</Label>
              <Input
                id="lang-source"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="lang-desc">Description</Label>
              <Textarea
                id="lang-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
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
