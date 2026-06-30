import type { AbilityKey, CharacterData, Spell } from "@/lib/schemas/character";
import { isManagedGrantSpell } from "@/lib/character/spell-sources";
import { abilityModifier } from "@/lib/dnd/calculations";
import type { PhbClass } from "@/lib/dnd/phb/types";

/** Full-caster spell slots by character level (index 0 = level 1). */
const FULL_CASTER_SLOTS: number[][] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Warlock pact slot level and count by character level. */
const WARLOCK_PACT: { slotLevel: number; count: number }[] = [
  { slotLevel: 1, count: 1 },
  { slotLevel: 1, count: 2 },
  { slotLevel: 2, count: 2 },
  { slotLevel: 2, count: 2 },
  { slotLevel: 3, count: 2 },
  { slotLevel: 3, count: 2 },
  { slotLevel: 4, count: 2 },
  { slotLevel: 4, count: 2 },
  { slotLevel: 5, count: 2 },
  { slotLevel: 5, count: 2 },
  { slotLevel: 5, count: 3 },
  { slotLevel: 5, count: 3 },
  { slotLevel: 5, count: 3 },
  { slotLevel: 5, count: 3 },
  { slotLevel: 5, count: 3 },
  { slotLevel: 5, count: 3 },
  { slotLevel: 5, count: 4 },
  { slotLevel: 5, count: 4 },
  { slotLevel: 5, count: 4 },
  { slotLevel: 5, count: 4 },
];

const CANTrips_BY_CLASS: Record<string, number[]> = {
  bard: [2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  cleric: [3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  druid: [2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  sorcerer: [4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  warlock: [2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  wizard: [3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
};

const SPELLS_KNOWN_BY_CLASS: Record<string, number[]> = {
  bard: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24],
  sorcerer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 12, 13, 13, 13, 14, 14, 14, 15],
  warlock: [2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
};

function levelIndex(characterLevel: number): number {
  return Math.min(Math.max(characterLevel, 1), 20) - 1;
}

function tableAt(table: number[], characterLevel: number): number {
  return table[levelIndex(characterLevel)] ?? table[0];
}

export function isPreparedCaster(cls: PhbClass): boolean {
  return cls.spellcasting?.preparedCaster === true;
}

export function isKnownCaster(cls: PhbClass): boolean {
  const sc = cls.spellcasting;
  if (!sc || sc.preparedCaster) return false;
  return sc.spellsKnown !== undefined;
}

export function isWizard(cls: PhbClass): boolean {
  return cls.id === "wizard" && cls.spellcasting?.preparedCaster === true;
}

export function getCantripsKnownLimit(cls: PhbClass, characterLevel: number): number {
  const table = CANTrips_BY_CLASS[cls.id];
  if (table) return tableAt(table, characterLevel);
  return cls.spellcasting?.cantripsKnown ?? 0;
}

export function getSpellsKnownLimit(cls: PhbClass, characterLevel: number): number | null {
  if (isPreparedCaster(cls) && !isWizard(cls)) {
    return null;
  }
  if (isWizard(cls)) {
    return null;
  }
  const table = SPELLS_KNOWN_BY_CLASS[cls.id];
  if (table) return tableAt(table, characterLevel);
  return cls.spellcasting?.spellsKnown ?? null;
}

/** Prepared leveled spells = spellcasting ability mod + character level (min 1). */
export function getPreparedSpellLimit(
  cls: PhbClass,
  characterLevel: number,
  abilityScores: CharacterData["abilityScores"]
): number {
  const ability = cls.spellcasting?.ability;
  if (!ability) return 0;
  const mod = abilityModifier(abilityScores[ability]);
  return Math.max(1, mod + characterLevel);
}

export function buildSpellSlots(
  cls: PhbClass,
  characterLevel: number,
  existing?: CharacterData["spells"]["slots"]
): CharacterData["spells"]["slots"] {
  const prev = existing ?? {};
  const slots: CharacterData["spells"]["slots"] = {};

  if (cls.id === "warlock") {
    const pact = WARLOCK_PACT[levelIndex(characterLevel)] ?? WARLOCK_PACT[0];
    const key = String(pact.slotLevel);
    const used = prev[key]?.used ?? 0;
    slots[key] = { max: pact.count, used: Math.min(used, pact.count) };
    return slots;
  }

  const row = FULL_CASTER_SLOTS[levelIndex(characterLevel)] ?? FULL_CASTER_SLOTS[0];
  row.forEach((max, index) => {
    const key = String(index + 1);
    const used = prev[key]?.used ?? 0;
    slots[key] = { max, used: Math.min(used, max) };
  });
  return slots;
}

export interface SpellcastingLimits {
  cantripsKnown: number;
  spellsKnown: number | null;
  preparedSpells: number | null;
  usesPreparedList: boolean;
  isWizard: boolean;
}

export function getSpellcastingLimits(
  cls: PhbClass,
  characterLevel: number,
  abilityScores: CharacterData["abilityScores"]
): SpellcastingLimits {
  const usesPreparedList = isPreparedCaster(cls);
  return {
    cantripsKnown: getCantripsKnownLimit(cls, characterLevel),
    spellsKnown: getSpellsKnownLimit(cls, characterLevel),
    preparedSpells: usesPreparedList
      ? getPreparedSpellLimit(cls, characterLevel, abilityScores)
      : null,
    usesPreparedList,
    isWizard: isWizard(cls),
  };
}

export function countCantrips(known: Spell[]): number {
  return known.filter((s) => s.level === 0).length;
}

export function countPlayerCantrips(known: Spell[]): number {
  return known.filter((s) => s.level === 0 && !isManagedGrantSpell(s)).length;
}

export function countLeveledKnown(known: Spell[]): number {
  return known.filter((s) => s.level > 0).length;
}

export function countPlayerLeveledKnown(known: Spell[]): number {
  return known.filter((s) => s.level > 0 && !isManagedGrantSpell(s)).length;
}

export function countGrantedCantrips(known: Spell[]): number {
  return known.filter((s) => s.level === 0 && isManagedGrantSpell(s)).length;
}

export function countGrantedLeveled(known: Spell[]): number {
  return known.filter((s) => s.level > 0 && isManagedGrantSpell(s)).length;
}

export function countPreparedLeveled(known: Spell[]): number {
  return known.filter((s) => s.level > 0 && s.prepared).length;
}

/** Per-level header: prepared count at this level vs prepare limit (or cantrip limit at 0). */
export function formatLevelPreparedSummary(
  spellsAtLevel: Spell[],
  level: number,
  options: {
    cantripsKnown?: number;
    preparedSpellLimit?: number | null;
    usesPreparedList?: boolean;
    isKnownCaster?: boolean;
  } = {}
): string | null {
  const total = spellsAtLevel.length;
  if (total === 0) return null;

  if (level === 0) {
    return null;
  }

  if (options.isKnownCaster) {
    return `Known: ${total}`;
  }

  if (options.usesPreparedList && options.preparedSpellLimit != null) {
    const prepared = spellsAtLevel.filter((s) => s.prepared).length;
    return `Prepared: ${prepared}/${options.preparedSpellLimit}`;
  }

  return null;
}

/** Cantrips are always prepared; known casters treat all leveled spells as prepared. */
export function normalizeSpellPreparedFlags(
  known: Spell[],
  cls: PhbClass
): Spell[] {
  const knownCaster = isKnownCaster(cls);
  return known.map((spell) => {
    if (spell.level === 0) {
      return spell.prepared ? spell : { ...spell, prepared: true };
    }
    if (knownCaster) {
      return spell.prepared ? spell : { ...spell, prepared: true };
    }
    return spell;
  });
}

/** Trim excess prepared leveled spells (keeps grant spells and first N prepared). */
export function enforcePreparedLimit(known: Spell[], limit: number): Spell[] {
  let preparedCount = countPreparedLeveled(known);
  if (preparedCount <= limit) return known;

  const result = [...known];
  for (let i = result.length - 1; i >= 0 && preparedCount > limit; i--) {
    const spell = result[i];
    if (spell.level > 0 && spell.prepared && !spell.grantKey?.startsWith("grant:")) {
      result[i] = { ...spell, prepared: false };
      preparedCount--;
    }
  }
  return result;
}

export function syncSpellcastingFromClass(
  data: CharacterData,
  cls: PhbClass | undefined,
  characterLevel: number
): CharacterData["spells"] {
  if (!cls?.spellcasting) {
    return data.spells;
  }

  const limits = getSpellcastingLimits(cls, characterLevel, data.abilityScores);
  let known = normalizeSpellPreparedFlags(data.spells.known, cls);

  if (limits.preparedSpells !== null) {
    known = enforcePreparedLimit(known, limits.preparedSpells);
  }

  const slots = buildSpellSlots(cls, characterLevel, data.spells.slots);

  return {
    ...data.spells,
    spellcastingAbility: cls.spellcasting.ability,
    spellcastingHidden: false,
    known,
    slots,
    prepared: known.filter((s) => s.prepared),
  };
}

export function canAddCantrip(currentKnown: Spell[], limit: number): boolean {
  return countPlayerCantrips(currentKnown) < limit;
}

export function canAddLeveledSpell(
  currentKnown: Spell[],
  limits: SpellcastingLimits
): boolean {
  if (limits.spellsKnown !== null) {
    return countPlayerLeveledKnown(currentKnown) < limits.spellsKnown;
  }
  return true;
}

export function canPrepareAnother(
  currentKnown: Spell[],
  limit: number
): boolean {
  return countPreparedLeveled(currentKnown) < limit;
}

export function formatSlotSummary(
  slots: CharacterData["spells"]["slots"]
): string[] {
  return Object.entries(slots)
    .filter(([, slot]) => slot.max > 0)
    .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
    .map(([level, slot]) => {
      const n = parseInt(level, 10);
      const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
      return `${n}${suffix}: ${slot.max - slot.used}/${slot.max}`;
    });
}

export interface SpellSlotInfo {
  max: number;
  used: number;
  remaining: number;
}

export function getSpellSlotAtLevel(
  slots: CharacterData["spells"]["slots"],
  level: number
): SpellSlotInfo | null {
  if (level <= 0) return null;
  const slot = slots[String(level)];
  if (!slot || slot.max <= 0) return null;
  return {
    max: slot.max,
    used: slot.used,
    remaining: slot.max - slot.used,
  };
}

export function formatSpellSlotRemaining(
  level: number,
  slots: CharacterData["spells"]["slots"]
): string | null {
  const info = getSpellSlotAtLevel(slots, level);
  if (!info) return null;
  const slotWord = info.remaining === 1 ? "slot" : "slots";
  return `${info.remaining} ${slotWord} remaining until rest`;
}

/** True when the character can cast a leveled spell (including upcasting). Cantrips always pass. */
export function canCastSpellWithRemainingSlots(
  slots: CharacterData["spells"]["slots"],
  spellLevel: number
): boolean {
  if (spellLevel <= 0) return true;

  return Object.entries(slots).some(([key, slot]) => {
    const slotLevel = parseInt(key, 10);
    if (!Number.isFinite(slotLevel) || slotLevel < spellLevel) return false;
    if (slot.max <= 0) return false;
    return slot.used < slot.max;
  });
}
