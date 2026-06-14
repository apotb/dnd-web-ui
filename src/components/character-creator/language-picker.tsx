"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import type { Language } from "@/lib/schemas/language";
import { searchLanguagesClient } from "@/lib/languages/catalog-client";
import {
  buildLanguageLookup,
  resolveLanguageName,
  resolveLanguageSlug,
} from "@/lib/languages/resolve";

function toggleSlug(list: string[], slug: string, max: number): string[] {
  if (list.includes(slug)) return list.filter((s) => s !== slug);
  if (list.length >= max) return list;
  return [...list, slug];
}

interface LanguagePickerProps {
  /** Selected language slugs. */
  selected: string[];
  max: number;
  /** Slugs or legacy names that cannot be picked. */
  disabled?: string[];
  /** Limit to PHB standard languages (typical for backgrounds). */
  standardOnly?: boolean;
  /** Preloaded catalog from server (optional fallback for labels). */
  catalog?: Language[];
  onChange: (slugs: string[]) => void;
}

export function LanguagePicker({
  selected,
  max,
  disabled = [],
  standardOnly = false,
  catalog = [],
  onChange,
}: LanguagePickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Language[]>(catalog);
  const [loading, setLoading] = useState(false);

  const lookup = useMemo(() => buildLanguageLookup(catalog), [catalog]);

  const disabledSlugs = useMemo(
    () => new Set(disabled.map((d) => resolveLanguageSlug(d, lookup))),
    [disabled, lookup]
  );

  const search = useCallback(
    async (q: string) => {
      setLoading(true);
      const langs = await searchLanguagesClient(q, { standardOnly, limit: 40 });
      setResults(langs);
      setLoading(false);
    },
    [standardOnly]
  );

  useEffect(() => {
    const tid = setTimeout(() => search(query), 200);
    return () => clearTimeout(tid);
  }, [query, search]);

  const atMax = selected.length >= max;

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="creator-chip-row">
          {selected.map((slug) => (
            <button
              key={slug}
              type="button"
              className="candy-btn candy-btn-sm candy-btn-active"
              onClick={() => onChange(selected.filter((s) => s !== slug))}
            >
              {resolveLanguageName(slug, lookup)} ×
            </button>
          ))}
        </div>
      )}

      <p className="text-xs retro-muted">
        {selected.length}/{max} selected
        {standardOnly ? " · standard languages only" : ""}
      </p>

      <Input
        className="candy-input"
        placeholder="Search languages…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={atMax}
      />

      <div className="creator-chip-row creator-lang-grid">
        {loading && results.length === 0 ? (
          <span className="text-xs retro-muted">Searching…</span>
        ) : null}
        {results.map((lang) => {
          const isSelected = selected.includes(lang.slug);
          const isDisabled =
            disabledSlugs.has(lang.slug) || (atMax && !isSelected);
          return (
            <button
              key={lang.slug}
              type="button"
              disabled={isDisabled}
              className={`candy-btn candy-btn-sm${isSelected ? " candy-btn-active" : ""}`}
              onClick={() => {
                if (!isDisabled) onChange(toggleSlug(selected, lang.slug, max));
              }}
            >
              {lang.name}
            </button>
          );
        })}
        {!loading && results.length === 0 ? (
          <span className="text-xs retro-muted">No languages found.</span>
        ) : null}
      </div>
    </div>
  );
}
