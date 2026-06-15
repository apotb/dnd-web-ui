import type { AbilityKey, CharacterData, SkillKey } from "@/lib/schemas/character";
import { isClassSavingThrowProficient } from "@/lib/character/class-derivation";
import type { PhbClass } from "@/lib/dnd/phb/types";
import { levelFromXp } from "@/lib/dnd/xp";

/** Standard D&D 5e skill → ability mapping. */
export const SKILL_ABILITY_MAP: Record<SkillKey, AbilityKey> = {
  acrobatics: "dex",
  animalHandling: "wis",
  arcana: "int",
  athletics: "str",
  deception: "cha",
  history: "int",
  insight: "wis",
  intimidation: "cha",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  performance: "cha",
  persuasion: "cha",
  religion: "int",
  sleightOfHand: "dex",
  stealth: "dex",
  survival: "wis",
};

export const SKILL_LABELS: Record<SkillKey, string> = {
  acrobatics: "Acrobatics",
  animalHandling: "Animal Handling",
  arcana: "Arcana",
  athletics: "Athletics",
  deception: "Deception",
  history: "History",
  insight: "Insight",
  intimidation: "Intimidation",
  investigation: "Investigation",
  medicine: "Medicine",
  nature: "Nature",
  perception: "Perception",
  performance: "Performance",
  persuasion: "Persuasion",
  religion: "Religion",
  sleightOfHand: "Sleight of Hand",
  stealth: "Stealth",
  survival: "Survival",
};

export const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

export const ABILITY_FULL_LABELS: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function proficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

export function getProficiencyBonus(data: CharacterData): number {
  const level = levelFromXp(data.basicInfo.xp ?? 0);
  return data.proficiencyBonusOverride ?? proficiencyBonus(level);
}

export function getMaxInspiration(data: CharacterData): number {
  return getProficiencyBonus(data);
}

export function clampInspiration(
  inspiration: number,
  data: CharacterData
): number {
  const max = getMaxInspiration(data);
  const value = Number.isFinite(inspiration) ? Math.trunc(inspiration) : 0;
  return Math.max(0, Math.min(max, value));
}

export function getInspiration(data: CharacterData): number {
  return clampInspiration(data.inspiration ?? 0, data);
}

export function getAbilityModifiers(scores: CharacterData["abilityScores"]) {
  return {
    str: abilityModifier(scores.str),
    dex: abilityModifier(scores.dex),
    con: abilityModifier(scores.con),
    int: abilityModifier(scores.int),
    wis: abilityModifier(scores.wis),
    cha: abilityModifier(scores.cha),
  };
}

export function getSavingThrowTotal(
  data: CharacterData,
  ability: AbilityKey,
  catalogClasses?: PhbClass[]
): number {
  const mods = getAbilityModifiers(data.abilityScores);
  const prof = getProficiencyBonus(data);
  const proficient = isClassSavingThrowProficient(data, ability, catalogClasses);
  return mods[ability] + (proficient ? prof : 0);
}

export function getSkillTotal(
  data: CharacterData,
  skill: SkillKey,
  options?: { grantedSkills?: ReadonlySet<SkillKey> }
): number {
  const skillData = data.skills[skill];
  if (skillData?.override !== undefined) return skillData.override;

  const ability = SKILL_ABILITY_MAP[skill];
  const mods = getAbilityModifiers(data.abilityScores);
  const prof = getProficiencyBonus(data);
  let total = mods[ability];

  const proficient =
    skillData?.proficient || options?.grantedSkills?.has(skill) || false;
  if (proficient) total += prof;
  if (skillData?.expertise) total += prof;

  return total;
}

export function getPassivePerception(data: CharacterData): number {
  if (data.combat.passivePerceptionOverride !== undefined) {
    return data.combat.passivePerceptionOverride;
  }
  return 10 + getSkillTotal(data, "perception");
}

export function getSpellSaveDc(data: CharacterData): number | null {
  if (data.spells.spellSaveDcOverride !== undefined) {
    return data.spells.spellSaveDcOverride;
  }
  const ability = data.spells.spellcastingAbility;
  if (!ability) return null;
  const mods = getAbilityModifiers(data.abilityScores);
  return 8 + getProficiencyBonus(data) + mods[ability];
}

export function getSpellAttackBonus(data: CharacterData): number | null {
  if (data.spells.spellAttackBonusOverride !== undefined) {
    return data.spells.spellAttackBonusOverride;
  }
  const ability = data.spells.spellcastingAbility;
  if (!ability) return null;
  const mods = getAbilityModifiers(data.abilityScores);
  return getProficiencyBonus(data) + mods[ability];
}

export function getEffectiveHp(currentHp: number, tempHp: number): {
  current: number;
  temp: number;
  total: number;
} {
  return { current: currentHp, temp: tempHp, total: currentHp + tempHp };
}

/** Apply damage to HP, consuming temp HP first. Returns new values. */
export function applyDamage(
  currentHp: number,
  tempHp: number,
  amount: number
): { currentHp: number; tempHp: number } {
  let remaining = amount;
  let newTemp = tempHp;
  let newCurrent = currentHp;

  if (newTemp > 0) {
    const absorbed = Math.min(newTemp, remaining);
    newTemp -= absorbed;
    remaining -= absorbed;
  }

  newCurrent -= remaining;
  return { currentHp: newCurrent, tempHp: newTemp };
}

/** Apply healing, capped at maxHp. */
export function applyHealing(
  currentHp: number,
  maxHp: number,
  amount: number
): number {
  return Math.min(maxHp, currentHp + amount);
}
