"use client";

import { useState } from "react";

export interface ContentEntry {
  slug: string;
  name: string;
  source: string;
  extra?: Record<string, unknown>;
}

interface ContentManagerProps {
  title: string;
  entries: ContentEntry[];
  onSeed: () => Promise<{ seeded: number; error?: string }>;
  onDelete: (slug: string) => Promise<{ error?: string }>;
  /** Returns error string or undefined on success */
  onSave: (entry: ContentEntry & { jsonData: string }) => Promise<{ error?: string }>;
  /** Extra columns to show in the list */
  extraColumns?: { key: string; label: string }[];
  /** Schema hint shown in the JSON editor placeholder */
  jsonHint?: string;
  /** Whether to show a dedicated "name" edit field (vs extracting from JSON) */
  hasJsonEditor?: boolean;
}

export function ContentManager({
  title,
  entries,
  onSeed,
  onDelete,
  onSave,
  extraColumns = [],
  jsonHint,
  hasJsonEditor = true,
}: ContentManagerProps) {
  const [list, setList] = useState<ContentEntry[]>(entries);
  const [editing, setEditing] = useState<(ContentEntry & { jsonData: string }) | null>(null);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = list.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.slug.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSeed() {
    setSeeding(true);
    setSeedStatus(null);
    const result = await onSeed();
    if (result.error) {
      setSeedStatus(`Error: ${result.error}`);
    } else {
      setSeedStatus(`Seeded ${result.seeded} entries from built-in PHB data.`);
    }
    setSeeding(false);
  }

  function startNew() {
    setEditing({ slug: "", name: "", source: "Custom", extra: {}, jsonData: "{}" });
    setSaveError(null);
  }

  function startEdit(entry: ContentEntry) {
    setEditing({
      ...entry,
      jsonData: JSON.stringify(entry.extra ?? {}, null, 2),
    });
    setSaveError(null);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    const result = await onSave(editing);
    if (result.error) {
      setSaveError(result.error);
    } else {
      const updated = list.filter((e) => e.slug !== editing.slug);
      updated.push({ slug: editing.slug, name: editing.name, source: editing.source, extra: editing.extra });
      updated.sort((a, b) => a.name.localeCompare(b.name));
      setList(updated);
      setEditing(null);
    }
    setSaving(false);
  }

  async function handleDelete(slug: string) {
    if (!confirm(`Delete "${slug}"? This cannot be undone.`)) return;
    const result = await onDelete(slug);
    if (result.error) {
      alert(`Delete failed: ${result.error}`);
    } else {
      setList((prev) => prev.filter((e) => e.slug !== slug));
      if (editing?.slug === slug) setEditing(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
        <button className="candy-btn" onClick={startNew}>+ New entry</button>
        <button className="candy-btn" onClick={handleSeed} disabled={seeding}>
          {seeding ? "Seeding…" : "Seed from built-in PHB data"}
        </button>
        {seedStatus && (
          <span className="retro-muted" style={{ fontSize: "12px" }}>{seedStatus}</span>
        )}
      </div>

      {editing && (
        <div className="retro-box" style={{ marginBottom: "16px" }}>
          <p className="retro-box-title">{editing.slug ? `Edit: ${editing.slug}` : "New Entry"}</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
            <label style={{ flex: "1 1 180px" }}>
              <span className="candy-label">Slug (unique ID)</span>
              <input
                className="retro-input"
                style={{ width: "100%", boxSizing: "border-box" }}
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })}
                placeholder="e.g. my-homebrew-class"
              />
            </label>
            <label style={{ flex: "1 1 180px" }}>
              <span className="candy-label">Name</span>
              <input
                className="retro-input"
                style={{ width: "100%", boxSizing: "border-box" }}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Display name"
              />
            </label>
            <label style={{ flex: "1 1 120px" }}>
              <span className="candy-label">Source</span>
              <input
                className="retro-input"
                style={{ width: "100%", boxSizing: "border-box" }}
                value={editing.source}
                onChange={(e) => setEditing({ ...editing, source: e.target.value })}
                placeholder="PHB, Custom, etc."
              />
            </label>
          </div>
          {hasJsonEditor && (
            <label>
              <span className="candy-label">Data (JSON)</span>
              <textarea
                className="retro-input"
                style={{ width: "100%", boxSizing: "border-box", fontFamily: "monospace", fontSize: "12px", minHeight: "180px" }}
                value={editing.jsonData}
                onChange={(e) => setEditing({ ...editing, jsonData: e.target.value })}
                placeholder={jsonHint ?? "{}"}
              />
            </label>
          )}
          {saveError && <p style={{ color: "#c00", marginTop: "4px", fontSize: "13px" }}>{saveError}</p>}
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button className="candy-btn" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="candy-btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: "8px" }}>
        <input
          className="retro-input"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "260px" }}
        />
      </div>

      <p className="retro-muted" style={{ marginBottom: "6px" }}>{filtered.length} entries</p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #aaa" }}>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>Slug</th>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>Name</th>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>Source</th>
              {extraColumns.map((c) => (
                <th key={c.key} style={{ textAlign: "left", padding: "4px 8px" }}>{c.label}</th>
              ))}
              <th style={{ padding: "4px 8px" }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.slug} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: "11px" }}>{entry.slug}</td>
                <td style={{ padding: "4px 8px" }}>{entry.name}</td>
                <td style={{ padding: "4px 8px", color: "#666" }}>{entry.source}</td>
                {extraColumns.map((c) => (
                  <td key={c.key} style={{ padding: "4px 8px" }}>
                    {String(entry.extra?.[c.key] ?? "")}
                  </td>
                ))}
                <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>
                  <button className="retro-inline-link" style={{ marginRight: "8px" }} onClick={() => startEdit(entry)}>edit</button>
                  <button className="retro-inline-link" style={{ color: "#c00" }} onClick={() => handleDelete(entry.slug)}>delete</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3 + extraColumns.length + 1} style={{ padding: "12px 8px", color: "#999" }}>
                  No entries yet. Click "Seed from built-in PHB data" to populate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
