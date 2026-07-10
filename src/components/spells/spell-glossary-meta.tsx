"use client";

import { Badge } from "@/components/ui/badge";
import { GlossaryTerm } from "@/components/ui/glossary-term";
import { Tooltip } from "@/components/ui/tooltip";
import type { CatalogSpellRow } from "@/lib/content/catalog-client";
import {
  formatSpellMaterialLine,
  formatSpellDurationForDisplay,
  getSpellComponentTooltip,
  getSpellMaterialNotice,
  getSpellSchoolTooltip,
  parseSpellComponentLetters,
  SPELL_FLAG_TOOLTIPS,
  type SpellComponentLetter,
} from "@/lib/dnd/spell-glossary";
import { useSpellRowTooltipOverride } from "@/components/spells/spell-row-tooltip-context";
import { cn } from "@/lib/utils";

function ComponentLetter({
  letter,
  components,
}: {
  letter: SpellComponentLetter;
  components: string;
}) {
  return (
    <GlossaryTerm
      label={letter}
      tooltip={getSpellComponentTooltip(letter, components)}
      className="font-mono"
    />
  );
}

export function SpellMaterialLine({
  components,
  className,
}: {
  components: string;
  className?: string;
}) {
  const notice = getSpellMaterialNotice(components);
  const setRowTooltip = useSpellRowTooltipOverride();
  const materialTooltip = formatSpellMaterialLine(components);
  if (!notice) return null;

  return (
    <div
      className={cn(
        "rounded-md border border-amber-500/45 bg-amber-500/10 px-2 py-1 text-xs leading-snug text-amber-950 dark:text-amber-100",
        className
      )}
      onMouseEnter={
        setRowTooltip && materialTooltip
          ? () => setRowTooltip(materialTooltip)
          : undefined
      }
      onMouseLeave={setRowTooltip ? () => setRowTooltip(null) : undefined}
    >
      <span className="font-semibold">Material:</span> {notice.description}
      {notice.consumed ? (
        <span className="text-amber-800/80 dark:text-amber-200/80"> (consumed)</span>
      ) : null}
    </div>
  );
}

export function SpellGlossaryMeta({
  spell,
  showCastingTime = true,
  showDuration = false,
  showMaterialLine = false,
  usageLabel,
}: {
  spell: CatalogSpellRow;
  showCastingTime?: boolean;
  showDuration?: boolean;
  /** Show material requirements inline (recommended in combat). */
  showMaterialLine?: boolean;
  /** e.g. innate spell frequency shown after casting time and range. */
  usageLabel?: string;
}) {
  const setRowTooltip = useSpellRowTooltipOverride();
  const letters = parseSpellComponentLetters(spell.components);
  const hasPrimaryMeta =
    !!spell.school ||
    letters.length > 0 ||
    spell.ritual ||
    spell.concentration;
  const actionRangeLine = [
    showCastingTime ? spell.castingTime : "",
    spell.range ?? "",
    showDuration
      ? formatSpellDurationForDisplay(spell.duration ?? "", {
          concentration: spell.concentration,
        })
      : "",
    usageLabel ?? "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-0.5 text-xs text-muted-foreground">
      {hasPrimaryMeta ? (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {spell.school ? (
            <GlossaryTerm
              label={spell.school}
              tooltip={getSpellSchoolTooltip(spell.school) ?? spell.school}
              className="capitalize"
            />
          ) : null}

          {letters.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              {letters.map((letter, index) => (
                <span key={letter} className="inline-flex items-center gap-1">
                  {index > 0 ? <span aria-hidden="true">·</span> : null}
                  <ComponentLetter letter={letter} components={spell.components} />
                </span>
              ))}
            </span>
          ) : null}

          {spell.ritual ? (
            setRowTooltip ? (
              <Badge
                variant="outline"
                className="text-xs shrink-0 cursor-default px-1.5"
                onMouseEnter={() => setRowTooltip(SPELL_FLAG_TOOLTIPS.R)}
                onMouseLeave={() => setRowTooltip(null)}
              >
                R
              </Badge>
            ) : (
              <Tooltip content={SPELL_FLAG_TOOLTIPS.R}>
                <Badge variant="outline" className="text-xs shrink-0 cursor-default px-1.5">
                  R
                </Badge>
              </Tooltip>
            )
          ) : null}

          {spell.concentration ? (
            setRowTooltip ? (
              <Badge
                variant="outline"
                className="text-xs shrink-0 cursor-default px-1.5"
                onMouseEnter={() => setRowTooltip(SPELL_FLAG_TOOLTIPS.C)}
                onMouseLeave={() => setRowTooltip(null)}
              >
                C
              </Badge>
            ) : (
              <Tooltip content={SPELL_FLAG_TOOLTIPS.C}>
                <Badge variant="outline" className="text-xs shrink-0 cursor-default px-1.5">
                  C
                </Badge>
              </Tooltip>
            )
          ) : null}
        </div>
      ) : null}

      {actionRangeLine ? (
        <div className="truncate">{actionRangeLine}</div>
      ) : null}

      {showMaterialLine ? (
        <SpellMaterialLine components={spell.components} className="mt-1" />
      ) : null}
    </div>
  );
}
