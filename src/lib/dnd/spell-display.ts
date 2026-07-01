import type { Spell } from "@/lib/schemas/character";
import { isManagedGrantSpell } from "@/lib/character/spell-sources";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";

export function spellLevelLabel(level: number): string {
  if (level === 0) return "Cantrips";
  if (level === 1) return "1st Level";
  if (level === 2) return "2nd Level";
  if (level === 3) return "3rd Level";
  return `${level}th Level`;
}

/** Compact level label for spell row badges (e.g. "1st", "2nd"). */
export function spellLevelBadgeLabel(level: number): string {
  if (level === 0) return "Cantrip";
  if (level === 1) return "1st";
  if (level === 2) return "2nd";
  if (level === 3) return "3rd";
  return `${level}th`;
}

/** Highest leveled spell slot the character has (falls back to full-caster progression). */
export function getMaxCastableSpellLevel(
  characterLevel: number,
  slots: Record<string, { max: number; used: number }>
): number {
  const slotLevels = Object.entries(slots)
    .filter(([, slot]) => slot.max > 0)
    .map(([key]) => parseInt(key, 10))
    .filter((n) => Number.isFinite(n) && n >= 1);

  if (slotLevels.length > 0) {
    return Math.max(...slotLevels);
  }

  if (characterLevel < 1) return 0;
  return Math.min(9, Math.ceil(characterLevel / 2));
}

export interface KnownSpellEntry {
  spell: Spell;
  index: number;
  level: number;
}

export interface KnownSpellGroup {
  level: number;
  label: string;
  spells: KnownSpellEntry[];
}

/** Group known spells by level (cantrips first), sorted alphabetically within each level. */
export function groupKnownSpellsByLevel(
  known: Spell[],
  resolveLevel: (spell: Spell) => number
): KnownSpellGroup[] {
  const byLevel = new Map<number, KnownSpellEntry[]>();

  known.forEach((spell, index) => {
    const level = resolveLevel(spell);
    const list = byLevel.get(level) ?? [];
    list.push({ spell, index, level });
    byLevel.set(level, list);
  });

  return [...byLevel.keys()]
    .sort((a, b) => a - b)
    .map((level) => ({
      level,
      label: spellLevelLabel(level),
      spells: (byLevel.get(level) ?? []).sort((a, b) => {
        const aGrant = isManagedGrantSpell(a.spell) ? 0 : 1;
        const bGrant = isManagedGrantSpell(b.spell) ? 0 : 1;
        if (aGrant !== bGrant) return aGrant - bGrant;
        return a.spell.name.localeCompare(b.spell.name, undefined, {
          sensitivity: "base",
        });
      }),
    }));
}

/** Spell levels to offer in pickers: cantrips + 1st through max castable. */
export function availableSpellLevels(maxCastableLevel: number): number[] {
  const levels = [0];
  for (let n = 1; n <= maxCastableLevel; n++) levels.push(n);
  return levels;
}

/** Human-readable label for a class spell list id (e.g. wizard → Wizard). */
export function spellListLabel(listId: string): string {
  const cls = PHB_CLASSES.find((c) => c.spellcasting?.spellListId === listId);
  if (cls) return cls.name;
  return `${listId.charAt(0).toUpperCase()}${listId.slice(1)}`;
}

/** Display label for spell picker level filter value. */
export function spellLevelFilterLabel(level: string): string {
  if (level === "all") return "All levels";
  const n = parseInt(level, 10);
  if (n === 0) return "Cantrips";
  if (Number.isFinite(n)) return spellLevelLabel(n);
  return level;
}

/** Display label for spell picker class scope filter. */
export function spellClassFilterLabel(
  filter: string,
  classListId?: string
): string {
  if (filter === "all") return "All spells";
  if (filter === "class" && classListId) return spellListLabel(classListId);
  return "Class";
}

/** Hover tooltip text for catalog spell rows in pickers. */
export function formatSpellPickerTooltip(spell: {
  name: string;
  school?: string;
  castingTime?: string;
  range?: string;
  components?: string;
  duration?: string;
  description?: string;
  ritual?: boolean;
  concentration?: boolean;
}): string {
  const lines: string[] = [];

  const typeAndComponents: string[] = [];
  if (spell.school) typeAndComponents.push(spell.school);
  if (spell.components) typeAndComponents.push(spell.components);
  if (typeAndComponents.length > 0) {
    lines.push(typeAndComponents.join(" · "));
  }

  const castingAndRange: string[] = [];
  if (spell.castingTime) castingAndRange.push(spell.castingTime);
  if (spell.range) castingAndRange.push(spell.range);
  if (castingAndRange.length > 0) {
    lines.push(castingAndRange.join(" · "));
  }

  const duration = spell.duration?.trim();
  if (duration) {
    lines.push(duration);
  }

  const description = spell.description?.trim();
  if (description) {
    if (lines.length > 0) lines.push("");
    lines.push(description);
  }

  if (lines.length === 0) return spell.name;
  return lines.join("\n");
}
