"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import type { CatalogSpellRow } from "@/lib/content/catalog-client";
import {
  getSpellComponentTooltip,
  getSpellSchoolTooltip,
  parseSpellComponentLetters,
  SPELL_FLAG_TOOLTIPS,
  type SpellComponentLetter,
} from "@/lib/dnd/spell-glossary";

function GlossaryTerm({
  label,
  tooltip,
  className = "",
}: {
  label: string;
  tooltip: string;
  className?: string;
}) {
  return (
    <Tooltip content={tooltip}>
      <span
        className={[
          "cursor-default underline decoration-dotted underline-offset-2",
          className,
        ].join(" ")}
      >
        {label}
      </span>
    </Tooltip>
  );
}

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

export function SpellGlossaryMeta({
  spell,
  showCastingTime = true,
}: {
  spell: CatalogSpellRow;
  showCastingTime?: boolean;
}) {
  const letters = parseSpellComponentLetters(spell.components);

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
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
        <Tooltip content={SPELL_FLAG_TOOLTIPS.R}>
          <Badge variant="outline" className="text-xs shrink-0 cursor-default px-1.5">
            R
          </Badge>
        </Tooltip>
      ) : null}

      {spell.concentration ? (
        <Tooltip content={SPELL_FLAG_TOOLTIPS.C}>
          <Badge variant="outline" className="text-xs shrink-0 cursor-default px-1.5">
            C
          </Badge>
        </Tooltip>
      ) : null}

      {showCastingTime && spell.castingTime ? (
        <span className="truncate">
          {spell.school || letters.length > 0 || spell.ritual || spell.concentration
            ? " · "
            : ""}
          {spell.castingTime}
          {spell.range ? ` · ${spell.range}` : ""}
        </span>
      ) : null}
    </div>
  );
}
