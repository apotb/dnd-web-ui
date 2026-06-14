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
  seedLanguages,
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

  function handleSeed() {
    startTransition(async () => {
      const result = await seedLanguages();
      if (result.error) {
        alert(`Seed failed: ${result.error}`);
        return;
      }
      alert(`Seeded ${result.seeded} languages.`);
      window.location.reload();
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
            className="max-w-xs"
          />
          <Button onClick={openCreate}>Add language</Button>
          <Button variant="outline" onClick={handleSeed} disabled={isPending}>
            Seed PHB languages
          </Button>
        </div>
      </div>

      <div className="retro-box space-y-2">
        {filtered.map((row) => (
          <div
            key={row.slug}
            className="flex items-center justify-between gap-3 border-b border-border/50 pb-2 last:border-0 last:pb-0"
          >
            <div>
              <p className="font-medium text-sm">
                {row.name}
                {row.isStandard ? (
                  <span className="text-xs text-muted-foreground ml-2">standard</span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.slug}
                {row.script ? ` · ${row.script} script` : ""}
                {row.source ? ` · ${row.source}` : ""}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
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
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No languages found.</p>
        ) : null}
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
