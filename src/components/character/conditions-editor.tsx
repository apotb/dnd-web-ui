"use client";

import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import {
  getConditionDisplayName,
  getConditionTooltip,
  type PhbCondition,
} from "@/lib/dnd/conditions";
import { getProtectedConditionNote } from "@/lib/combat/combat-conditions";

interface ConditionsEditorProps {
  conditions: string[];
  catalog: PhbCondition[];
  editable?: boolean;
  protectedSlugs?: string[];
  onChange?: (conditions: string[]) => void;
}

function toggleCondition(conditions: string[], slug: string): string[] {
  if (conditions.includes(slug)) return conditions.filter((entry) => entry !== slug);
  return [...conditions, slug];
}

function resolveConditionTooltip(
  slug: string,
  catalog: PhbCondition[],
  isProtected: boolean
): string | null {
  const description = getConditionTooltip(slug, catalog);
  if (isProtected) {
    const note = getProtectedConditionNote(slug);
    return description ? `${description}\n\n${note}` : note;
  }
  return description;
}

function wrapConditionTooltip(
  tooltip: string | null,
  node: ReactElement,
  wrapForDisabled = false
) {
  if (!tooltip) return node;
  const child = wrapForDisabled ? (
    <span className="inline-flex">{node}</span>
  ) : (
    node
  );
  return <Tooltip content={tooltip}>{child}</Tooltip>;
}

export function ConditionsEditor({
  conditions,
  catalog,
  editable = false,
  protectedSlugs = [],
  onChange,
}: ConditionsEditorProps) {
  const [query, setQuery] = useState("");

  const appliedSet = useMemo(() => new Set(conditions), [conditions]);
  const protectedSet = useMemo(() => new Set(protectedSlugs), [protectedSlugs]);

  const visibleCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (condition) =>
        condition.name.toLowerCase().includes(q) ||
        condition.slug.toLowerCase().includes(q)
    );
  }, [catalog, query]);

  if (!editable || !onChange) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {conditions.length === 0 ? (
          <span className="text-sm text-muted-foreground">None</span>
        ) : (
          conditions.map((slug) => {
            const label = getConditionDisplayName(slug, catalog);
            const tooltip = getConditionTooltip(slug, catalog);
            const chip = (
              <Badge key={slug} variant="secondary">
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
    );
  }

  return (
    <div className="space-y-2">
      {conditions.length > 0 ? (
        <div className="creator-chip-row">
          {          conditions.map((slug) => {
            const label = getConditionDisplayName(slug, catalog);
            const isProtected = protectedSet.has(slug);
            const tooltip = resolveConditionTooltip(slug, catalog, isProtected);
            if (isProtected) {
              return (
                <span key={slug} className="inline-flex">
                  {wrapConditionTooltip(
                    tooltip,
                    <button
                      type="button"
                      className="candy-btn candy-btn-sm candy-btn-active"
                      disabled
                    >
                      {label}
                    </button>,
                    true
                  )}
                </span>
              );
            }
            return (
              <span key={slug} className="inline-flex">
                {wrapConditionTooltip(
                  tooltip,
                  <button
                    type="button"
                    className="candy-btn candy-btn-sm candy-btn-active"
                    onClick={() => onChange(conditions.filter((entry) => entry !== slug))}
                  >
                    {label} ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      ) : null}

      <Input
        className="candy-input"
        placeholder="Search conditions…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="creator-chip-row creator-lang-grid max-h-48 overflow-y-auto">
        {visibleCatalog.map((condition) => {
          const isSelected = appliedSet.has(condition.slug);
          const isProtected = protectedSet.has(condition.slug);
          const isDisabled = isProtected && isSelected;
          const tooltip = resolveConditionTooltip(
            condition.slug,
            catalog,
            isDisabled
          );
          return (
            <span key={condition.slug} className="inline-flex">
              {wrapConditionTooltip(
                tooltip,
                <button
                  type="button"
                  disabled={isDisabled}
                  className={`candy-btn candy-btn-sm${isSelected ? " candy-btn-active" : ""}`}
                  onClick={() => {
                    if (isDisabled) return;
                    onChange(toggleCondition(conditions, condition.slug));
                  }}
                >
                  {condition.name}
                </button>,
                isDisabled
              )}
            </span>
          );
        })}
        {visibleCatalog.length === 0 ? (
          <span className="text-xs retro-muted">No conditions found.</span>
        ) : null}
      </div>
    </div>
  );
}
