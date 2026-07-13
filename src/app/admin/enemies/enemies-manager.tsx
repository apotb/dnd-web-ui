"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadEnemyPortrait, resolveCombatImageUrl } from "@/lib/combat/storage";
import { deleteEnemyEntry, upsertEnemyEntry } from "@/lib/content/catalog";
import { LazyPortrait } from "@/components/ui/lazy-portrait";
import { EnemyStatForm } from "@/components/admin/enemy-stat-form";
import {
  createDefaultEnemyData,
  parseEnemyData,
  type EnemyData,
} from "@/lib/schemas/enemy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EnemyRow {
  slug: string;
  name: string;
  source: string;
  data: EnemyData;
}

const PAGE_SIZE = 50;

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function EnemiesManager({ entries }: { entries: EnemyRow[] }) {
  const [list, setList] = useState(entries);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [source, setSource] = useState("Custom");
  const [form, setForm] = useState<EnemyData>(createDefaultEnemyData());
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      list.filter(
        (row) =>
          row.name.toLowerCase().includes(filter.toLowerCase()) ||
          row.slug.includes(filter.toLowerCase())
      ),
    [filter, list]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = page * PAGE_SIZE;
  const visibleRows = useMemo(
    () => filtered.slice(pageStart, pageStart + PAGE_SIZE),
    [filtered, pageStart]
  );

  useEffect(() => {
    setPage(0);
  }, [filter]);

  useEffect(() => {
    if (page > pageCount - 1) {
      setPage(Math.max(0, pageCount - 1));
    }
  }, [page, pageCount]);

  function openCreate() {
    setEditSlug(null);
    setName("");
    setSlug("");
    setSource("Custom");
    setForm(createDefaultEnemyData());
    setPortraitFile(null);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(row: EnemyRow) {
    setEditSlug(row.slug);
    setName(row.name);
    setSlug(row.slug);
    setSource(row.source);
    setForm(parseEnemyData(row.data));
    setPortraitFile(null);
    setFormError(null);
    setDialogOpen(true);
  }

  function handleSave() {
    if (!name.trim()) {
      setFormError("Name is required.");
      return;
    }

    startTransition(async () => {
      const nextSlug = slug.trim() || slugify(name);
      let portraitPath = form.portraitPath;

      if (portraitFile) {
        const supabase = createClient();
        const upload = await uploadEnemyPortrait(supabase, nextSlug, portraitFile);
        if (upload.error) {
          setFormError(upload.error);
          return;
        }
        portraitPath = upload.path ?? portraitPath;
      }

      const data = parseEnemyData({ ...form, portraitPath });
      const result = await upsertEnemyEntry(
        nextSlug,
        name.trim(),
        source.trim() || "Custom",
        data
      );

      if (result.error) {
        setFormError(result.error);
        return;
      }

      const row: EnemyRow = {
        slug: nextSlug,
        name: name.trim(),
        source: source.trim() || "Custom",
        data,
      };

      setList((prev) => {
        const next = editSlug
          ? prev.map((entry) => (entry.slug === editSlug ? row : entry))
          : [...prev, row];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setDialogOpen(false);
    });
  }

  function handleDelete(row: EnemyRow) {
    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteEnemyEntry(row.slug);
      if (result.error) alert(`Delete failed: ${result.error}`);
      else setList((prev) => prev.filter((entry) => entry.slug !== row.slug));
    });
  }

  return (
    <div className="space-y-4">
      <div className="retro-box">
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            placeholder="Filter by name…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="flex-1 min-w-48"
          />
          <Button onClick={openCreate}>+ Add Enemy</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {filtered.length === 0
            ? `0 of ${list.length} enemies`
            : filtered.length > PAGE_SIZE
              ? `Showing ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, filtered.length)} of ${filtered.length} (${list.length} total)`
              : `${filtered.length} of ${list.length} enemies`}
        </p>
      </div>

      <div className="retro-box" style={{ padding: 0 }}>
        <div className="grid grid-cols-[40px_1fr_72px_72px_120px_160px] gap-0 border-b px-4 py-2 bg-muted/50 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <span />
          <span>Name</span>
          <span className="pr-4">CR</span>
          <span className="pr-4">HP</span>
          <span className="pr-4">Source</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No enemies found.</p>
        ) : null}

        {visibleRows.map((row, idx) => {
          const supabase = createClient();
          const portraitUrl = row.data.portraitPath
            ? resolveCombatImageUrl(supabase, row.data.portraitPath)
            : null;
          const portraitFallback = (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {row.name.slice(0, 1)}
            </div>
          );

          return (
            <div
              key={row.slug}
              className={`grid grid-cols-[40px_1fr_72px_72px_120px_160px] items-center gap-0 px-4 py-2.5 ${idx !== visibleRows.length - 1 || pageCount > 1 ? "border-b" : ""}`}
            >
              <div className="flex items-center justify-center">
                {portraitUrl ? (
                  <LazyPortrait
                    src={portraitUrl}
                    imageClassName="portrait-cover-top h-8 w-8 rounded-full"
                    fallback={portraitFallback}
                  />
                ) : (
                  portraitFallback
                )}
              </div>
              <div className="min-w-0 pr-4">
                <span className="font-medium text-sm">{row.name}</span>
                <div
                  className="text-xs text-muted-foreground"
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "340px",
                  }}
                >
                  {row.data.sizeType || row.slug}
                </div>
              </div>
              <span className="text-sm text-muted-foreground pr-4">
                {row.data.challengeRating || "—"}
              </span>
              <span className="text-sm text-muted-foreground pr-4">
                {row.data.hitPoints.average || "—"}
              </span>
              <span className="text-sm text-muted-foreground pr-4">{row.source || "—"}</span>
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
          );
        })}

        {pageCount > 1 ? (
          <div className="flex items-center justify-between gap-2 px-4 py-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {pageCount}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto p-8">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl">
              {editSlug ? `Edit: ${name}` : "New Enemy"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="enemy-name">Name *</Label>
              <Input
                id="enemy-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (!editSlug) setSlug(slugify(event.target.value));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enemy-slug">Slug</Label>
              <Input id="enemy-slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enemy-source">Source</Label>
              <Input id="enemy-source" value={source} onChange={(event) => setSource(event.target.value)} />
            </div>
          </div>

          <EnemyStatForm
            form={form}
            onChange={setForm}
            portraitFile={portraitFile}
            onPortraitFileChange={setPortraitFile}
            portraitSlug={slug.trim() || slugify(name)}
          />

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <DialogFooter className="mt-6 -mx-8 -mb-8">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending || !name.trim()}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
