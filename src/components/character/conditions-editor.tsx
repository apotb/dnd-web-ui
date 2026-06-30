"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import {
  getConditionDisplayName,
  getConditionTooltip,
  type PhbCondition,
} from "@/lib/dnd/conditions";

interface ConditionsEditorProps {
  conditions: string[];
  catalog: PhbCondition[];
  editable?: boolean;
  onChange?: (conditions: string[]) => void;
}

export function ConditionsEditor({
  conditions,
  catalog,
  editable = false,
  onChange,
}: ConditionsEditorProps) {
  const [query, setQuery] = useState("");

  const appliedSet = useMemo(() => new Set(conditions), [conditions]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = catalog.filter((c) => !appliedSet.has(c.slug));
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
      );
    }
    return list.slice(0, 30);
  }, [appliedSet, catalog, query]);

  function removeCondition(slug: string) {
    if (!editable || !onChange) return;
    onChange(conditions.filter((c) => c !== slug));
  }

  function addCondition(slug: string) {
    if (!editable || !onChange || appliedSet.has(slug)) return;
    onChange([...conditions, slug]);
    setQuery("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {conditions.length === 0 ? (
          <span className="text-sm text-muted-foreground">None</span>
        ) : (
          conditions.map((slug) => {
            const label = getConditionDisplayName(slug, catalog);
            const tooltip = getConditionTooltip(slug, catalog);
            const chip = (
              <Badge
                key={slug}
                variant="secondary"
                className={editable ? "cursor-pointer" : undefined}
                onClick={editable ? () => removeCondition(slug) : undefined}
              >
                {label}
              </Badge>
            );
            return tooltip ? (
              <Tooltip key={slug} content={tooltip}>
                {chip}
              </Tooltip>
            ) : (
              chip
            );
          })
        )}
      </div>

      {editable && onChange ? (
        <div className="space-y-2">
          <Input
            placeholder="Search conditions to add…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim() && matches.length > 0 ? (
            <div className="max-h-40 overflow-y-auto rounded-md border bg-background">
              {matches.map((condition) => (
                <button
                  key={condition.slug}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/60"
                  onClick={() => addCondition(condition.slug)}
                >
                  {condition.name}
                </button>
              ))}
            </div>
          ) : null}
          {query.trim() && matches.length === 0 ? (
            <p className="text-xs text-muted-foreground">No matching conditions.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
