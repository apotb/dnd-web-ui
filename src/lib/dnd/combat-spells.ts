import type { CatalogSpellRow } from "@/lib/content/catalog-client";
import { canCastGrantSpell } from "@/lib/character/spell-grant-uses";
import { isManagedGrantSpell } from "@/lib/character/spell-sources";
import {
  buildSpellAttackForCast,
  hasOffensiveSpellAttackMetadata,
  resolveSpellSlug,
} from "@/lib/dnd/attacks";
import { formatBattleAttackRollMetadataLine } from "@/lib/combat/battle-tooltip";
import { formatModifier, getSpellAttackBonus } from "@/lib/dnd/calculations";
import { getSpell } from "@/lib/dnd/phb/spells";
import type { PhbSpell } from "@/lib/dnd/phb/types";
import { formatSpellBattleTooltip, stripRedundantSpellNotes } from "@/lib/dnd/spell-display";
import {
  getSpellCastingCost,
} from "@/lib/dnd/spell-casting-time";

export type { SpellCastingCost } from "@/lib/dnd/spell-casting-time";
export {
  getSpellCastingCost,
  isNonCombatCastingTime,
  isSpellCastableInCombat,
} from "@/lib/dnd/spell-casting-time";
import {
  canCastSpellWithRemainingSlots,
  formatSlotSummary,
} from "@/lib/dnd/spellcasting";
import type { CharacterData, Spell } from "@/lib/schemas/character";

/** Compact button subtitle: spell type + range. Roll math belongs in tooltips. */
export function formatSpellCombatSubtitle(
  level: number,
  range?: string | null,
  options?: { omitLevel?: boolean }
): string {
  const rangePart = range?.trim();
  if (level === 0) {
    return rangePart ? `Cantrip · ${rangePart}` : "Cantrip";
  }
  if (options?.omitLevel) {
    return rangePart ? `Spell · ${rangePart}` : "Spell";
  }
  const label = `Spell ${level}`;
  return rangePart ? `${label} · ${rangePart}` : label;
}

/** Subtitle for declare-cast spell options in combat. */
export function formatDeclareCastSpellSubtitle(
  spell: Spell,
  slug: string,
  options?: { omitSpellLevel?: boolean }
): string {
  const range = getSpell(slug)?.range?.trim() || null;
  return formatSpellCombatSubtitle(spell.level, range, {
    omitLevel: options?.omitSpellLevel,
  });
}

export interface CombatCastableSpell {
  spell: Spell;
  slug: string;
  castingCost: "action" | "bonus-action";
  catalog: PhbSpell;
}

export interface EligibleCastSlot {
  slotLevel: number;
  remaining: number;
  max: number;
}

function isCombatSpellEligible(character: CharacterData, spell: Spell): boolean {
  if (!character.spells.spellcastingAbility) return false;
  if (isManagedGrantSpell(spell) && !canCastGrantSpell(spell, character)) {
    return false;
  }
  if (spell.level > 0 && !spell.prepared) return false;
  if (
    spell.level > 0 &&
    !isManagedGrantSpell(spell) &&
    !canCastSpellWithRemainingSlots(character.spells.slots, spell.level)
  ) {
    return false;
  }
  return true;
}

function resolveCombatCatalogSpell(
  spell: Spell
): { slug: string; catalog: PhbSpell; castingCost: "action" | "bonus-action" } | null {
  const slug = resolveSpellSlug(spell);
  if (!slug) return null;

  const catalog = getSpell(slug);
  if (!catalog) return null;

  const castingCost = getSpellCastingCost(catalog.castingTime);
  if (castingCost !== "action" && castingCost !== "bonus-action") return null;

  return { slug, catalog, castingCost };
}

function sortCombatCastableSpells(entries: CombatCastableSpell[]): CombatCastableSpell[] {
  return entries.sort((a, b) => {
    if (a.spell.level !== b.spell.level) return a.spell.level - b.spell.level;
    return a.spell.name.localeCompare(b.spell.name, undefined, {
      sensitivity: "base",
    });
  });
}

/** Prepared leveled spells for the combat spell picker (includes offensive spells). */
export function listCombatCastableLeveledSpells(
  character: CharacterData,
  options: { castingCost: "action" | "bonus-action" }
): CombatCastableSpell[] {
  const result: CombatCastableSpell[] = [];

  for (const spell of character.spells.known) {
    if (spell.level <= 0) continue;
    if (!isCombatSpellEligible(character, spell)) continue;

    const resolved = resolveCombatCatalogSpell(spell);
    if (!resolved || resolved.castingCost !== options.castingCost) continue;

    result.push({
      spell,
      slug: resolved.slug,
      castingCost: resolved.castingCost,
      catalog: resolved.catalog,
    });
  }

  return sortCombatCastableSpells(result);
}

/** Action spells for the Cast a Spell picker: utility cantrips plus leveled spells. */
export function listCombatCastableActionSpellsForPicker(
  character: CharacterData
): CombatCastableSpell[] {
  return sortCombatCastableSpells([
    ...listCombatCastableCantripSpells(character, { castingCost: "action" }),
    ...listCombatCastableLeveledSpells(character, { castingCost: "action" }),
  ]);
}

export function resolveCombatCastableSpell(
  character: CharacterData,
  spellCast: {
    spellId: string;
    characterSpellId: string;
    castingCost: "action" | "bonus-action";
  }
): CombatCastableSpell | null {
  const spells =
    spellCast.castingCost === "action"
      ? listCombatCastableActionSpellsForPicker(character)
      : listCombatCastableLeveledSpells(character, {
          castingCost: spellCast.castingCost,
        });
  return (
    spells.find(
      (entry) =>
        entry.spell.id === spellCast.characterSpellId || entry.slug === spellCast.spellId
    ) ?? null
  );
}

/**
 * Cantrips castable in combat that are not offensive attack spells.
 * Offensive cantrips stay as direct attack buttons.
 */
export function listCombatCastableCantripSpells(
  character: CharacterData,
  options: { castingCost: "action" | "bonus-action" }
): CombatCastableSpell[] {
  const result: CombatCastableSpell[] = [];

  for (const spell of character.spells.known) {
    if (spell.level !== 0) continue;
    if (!isCombatSpellEligible(character, spell)) continue;

    const slug = resolveSpellSlug(spell);
    if (!slug || hasOffensiveSpellAttackMetadata(slug)) continue;

    const resolved = resolveCombatCatalogSpell(spell);
    if (!resolved || resolved.castingCost !== options.castingCost) continue;

    result.push({
      spell,
      slug: resolved.slug,
      castingCost: resolved.castingCost,
      catalog: resolved.catalog,
    });
  }

  return sortCombatCastableSpells(result);
}

/** @deprecated Use listCombatCastableLeveledSpells or listCombatCastableCantripSpells. */
export function listCombatCastableSpells(
  character: CharacterData
): CombatCastableSpell[] {
  return [
    ...listCombatCastableCantripSpells(character, { castingCost: "action" }),
    ...listCombatCastableCantripSpells(character, { castingCost: "bonus-action" }),
    ...listCombatCastableLeveledSpells(character, { castingCost: "action" }),
    ...listCombatCastableLeveledSpells(character, { castingCost: "bonus-action" }),
  ];
}

export function getEligibleCastSlotLevels(
  slots: CharacterData["spells"]["slots"],
  minSpellLevel: number
): EligibleCastSlot[] {
  return Object.entries(slots)
    .map(([key, slot]) => ({
      slotLevel: parseInt(key, 10),
      remaining: slot.max - slot.used,
      max: slot.max,
      used: slot.used,
    }))
    .filter(
      ({ slotLevel, max, used }) =>
        Number.isFinite(slotLevel) &&
        slotLevel >= minSpellLevel &&
        max > 0 &&
        used < max
    )
    .sort((a, b) => a.slotLevel - b.slotLevel)
    .map(({ slotLevel, remaining, max }) => ({
      slotLevel,
      remaining,
      max,
    }));
}

export function formatSlotLevelLabel(level: number): string {
  if (level === 1) return "1st-level";
  if (level === 2) return "2nd-level";
  if (level === 3) return "3rd-level";
  return `${level}th-level`;
}

export function formatCastSlotOptionLabel(slot: EligibleCastSlot): string {
  const levelLabel = formatSlotLevelLabel(slot.slotLevel);
  const slotWord = slot.max === 1 ? "slot" : "slots";
  return `${levelLabel} slot (${slot.remaining}/${slot.max} ${slotWord} remaining)`;
}

export function combatCastableSpellToCatalogRow(entry: CombatCastableSpell): CatalogSpellRow {
  const { slug, catalog } = entry;
  return {
    slug,
    name: catalog.name,
    level: catalog.level,
    school: catalog.school ?? "",
    castingTime: catalog.castingTime ?? "",
    range: catalog.range ?? "",
    components: catalog.components ?? "",
    duration: catalog.duration ?? "",
    description: catalog.description ?? "",
    ritual: catalog.ritual ?? false,
    concentration: catalog.concentration ?? false,
    classes: catalog.classes ?? [],
  };
}

function buildSpellCombatRollMetadata(
  entry: CombatCastableSpell,
  character: CharacterData
): string[] {
  if (entry.spell.level > 0) return [];

  const attack = buildSpellAttackForCast(character, entry.spell, entry.spell.level);
  if (attack) {
    const rollLine = formatBattleAttackRollMetadataLine(attack);
    return rollLine ? [rollLine] : [];
  }

  const attackBonus = getSpellAttackBonus(character);
  if (attackBonus != null) {
    return [`To hit: ${formatModifier(attackBonus)}`];
  }

  return [];
}

function formatSpellCatalogCombatTooltip(
  catalog: PhbSpell,
  character: CharacterData,
  entry: CombatCastableSpell,
  footer?: string[]
): string {
  return formatSpellBattleTooltip(catalog, {
    extraMetadata: buildSpellCombatRollMetadata(entry, character),
    footer,
  });
}

/** Combat hover tooltip for declaring a spell cast from the action panel. */
export function formatSpellCastCombatTooltip(
  spell: Spell,
  slug: string,
  character: CharacterData
): string {
  const catalog = getSpell(slug);
  if (!catalog) return spell.notes.trim();

  const entry: CombatCastableSpell = {
    spell,
    slug,
    castingCost: getSpellCastingCost(catalog.castingTime) === "bonus-action"
      ? "bonus-action"
      : "action",
    catalog,
  };

  const noteLine = stripRedundantSpellNotes(spell.notes, catalog);
  const footer = noteLine ? [noteLine] : undefined;
  return formatSpellCatalogCombatTooltip(catalog, character, entry, footer);
}

export function formatSpellPickerCombatTooltip(
  entry: CombatCastableSpell,
  character: CharacterData
): string {
  return formatSpellCatalogCombatTooltip(entry.catalog, character, entry);
}

export function formatSpellSlotSummaryFooter(
  slots: CharacterData["spells"]["slots"]
): string {
  const summary = formatSlotSummary(slots);
  return summary.length > 0 ? summary.join(" · ") : "No spell slots";
}

export function getDefaultCastSlotLevel(
  slots: CharacterData["spells"]["slots"],
  minSpellLevel: number
): number | null {
  const eligible = getEligibleCastSlotLevels(slots, minSpellLevel);
  return eligible[0]?.slotLevel ?? null;
}
