import type { AbilityKey, SkillKey } from "@/lib/schemas/character";

export type RacialAbilityBonus =
  | { kind: "fixed"; bonuses: Partial<Record<AbilityKey, number>> }
  | {
      kind: "half-elf";
      cha: 2;
      plusOneChoices: 2;
      exclude?: AbilityKey[];
    }
  | { kind: "variant-human"; plusOneChoices: 2; feat: true };

export interface PhbRace {
  id: string;
  name: string;
  size: string;
  speed: number;
  abilityBonus: RacialAbilityBonus;
  languages: string[];
  fixedLanguages?: string[];
  languageChoices?: number;
  skillProficiencies?: SkillKey[];
  toolProficiencies?: string[];
  weaponProficiencies?: string[];
  armorProficiencies?: string[];
  traits: { name: string; description: string }[];
  /** Sub-choice within race (e.g. draconic ancestry, gnome subrace). */
  subraces?: {
    id: string;
    name: string;
    abilityBonus?: Partial<Record<AbilityKey, number>>;
    extras?: string[];
  }[];
}

export interface PhbBackground {
  id: string;
  name: string;
  skillProficiencies: SkillKey[];
  toolProficiencies?: string[];
  languageChoices?: number;
  fixedLanguages?: string[];
  equipment: string[];
  gold: number;
  feature: { name: string; description: string };
  personality?: string[];
  ideals?: string[];
  bonds?: string[];
  flaws?: string[];
}

export interface PhbSubclass {
  id: string;
  name: string;
  features: { name: string; description: string }[];
}

export interface EquipmentOption {
  label: string;
  items: string[];
}

export interface EquipmentChoice {
  prompt: string;
  options: EquipmentOption[];
}

export interface PhbClass {
  id: string;
  name: string;
  hitDie: number;
  savingThrows: AbilityKey[];
  skillChoiceCount: number;
  skillOptions: SkillKey[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies?: string[];
  toolChoice?: { count: number; from: string[] };
  startingGold: { dice: number; sides: number; multiplier: number };
  equipmentChoices: EquipmentChoice[];
  fixedEquipment: string[];
  subclasses: PhbSubclass[];
  subclassLevel: number;
  spellcasting?: {
    ability: AbilityKey;
    cantripsKnown: number;
    spellsKnown?: number;
    spellbookAtLevel1?: number;
    preparedCaster?: boolean;
    ritual?: boolean;
    spellListId: string;
  };
  features: { name: string; description: string }[];
}

export interface PhbSpell {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  description: string;
  ritual?: boolean;
  concentration?: boolean;
}

export interface PhbFeat {
  id: string;
  name: string;
  description: string;
  abilityIncrease?: Partial<Record<AbilityKey, number>>;
}

export interface PhbItem {
  id: string;
  name: string;
  weightLb: number;
  cost?: string;
  type: string;
  notes?: string;
}

export interface AbilityBreakdown {
  base: number;
  racial: number;
  other: number;
  sources: { label: string; value: number }[];
}
