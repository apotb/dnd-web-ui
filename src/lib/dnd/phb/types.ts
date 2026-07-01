import type { AbilityKey, SkillKey } from "@/lib/schemas/character";
import type { CatalogFeatureEntry } from "@/lib/dnd/catalog-feature-mechanics";

export type RacialAbilityBonus =
  | { kind: "fixed"; bonuses: Partial<Record<AbilityKey, number>> }
  | {
      kind: "half-elf";
      cha: 2;
      plusOneChoices: 2;
      exclude?: AbilityKey[];
    }
  | { kind: "variant-human"; plusOneChoices: 2; feat: true };

export interface PhbSpecies {
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
  traits: CatalogFeatureEntry[];
  /** Pick N weapons from the items catalog (defaults to martial). */
  weaponChoices?: {
    count: number;
    prompt?: string;
    filter?: {
      weaponCategory?: "simple" | "martial";
      weaponRange?: "melee" | "ranged";
    };
  };
  /** Pick one skill or one tool (Githyanki Decadent Mastery). */
  skillOrToolChoice?: {
    prompt?: string;
  };
  /** Pick N skill proficiencies from options (or any skill if omitted). */
  skillChoices?: {
    count: number;
    options?: SkillKey[];
    prompt?: string;
  };
  /** Sub-choice within species (e.g. draconic ancestry, gnome subspecies). */
  subspecies?: {
    id: string;
    name: string;
    abilityBonus?: Partial<Record<AbilityKey, number>>;
    weaponProficiencies?: string[];
    armorProficiencies?: string[];
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
  /** Pick N skills from options (or any skill if options omitted). */
  skillChoices?: {
    count: number;
    options?: SkillKey[];
    prompt?: string;
  };
  /** Pick exactly one tool type from the listed options. */
  toolPick?: {
    options: Array<"gaming set" | "artisan's tools" | "musical instrument">;
    prompt?: string;
  };
  /** Pick N tool types (e.g. Urban Bounty Hunter). */
  toolMultiPick?: {
    count: number;
    options: Array<"thieves' tools" | "gaming set" | "musical instrument">;
    prompt?: string;
  };
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
  features: CatalogFeatureEntry[];
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
  features: CatalogFeatureEntry[];
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
  /** Class spell list IDs this spell appears on (e.g. wizard, cleric). */
  classes?: string[];
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
