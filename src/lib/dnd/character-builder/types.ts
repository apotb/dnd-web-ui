import type { AbilityKey, SkillKey } from "@/lib/schemas/character";
import {
  ABILITY_KEYS,
  defaultPointBuyScores,
  isValidPointBuy,
} from "@/lib/dnd/phb/point-buy";

export type CreatorStep =
  | "identity"
  | "origin"
  | "class"
  | "abilities"
  | "skills"
  | "spells"
  | "equipment"
  | "review";

export interface CharacterCreatorState {
  name: string;
  playerName: string;
  alignment: string;
  speciesId: string;
  subspeciesId: string;
  backgroundId: string;
  classId: string;
  subclassId: string;
  halfElfAbilityBonuses: AbilityKey[];
  variantHumanAbilityBonuses: AbilityKey[];
  variantHumanSkill: SkillKey | "";
  variantHumanFeat: string;
  speciesSkillChoices: SkillKey[];
  speciesWeaponChoices: string[];
  speciesToolChoice: string;
  speciesSkillOrTool: "skill" | "tool" | "";
  speciesLanguageChoices: string[];
  backgroundLanguageChoices: string[];
  backgroundArtisanTool: string;
  backgroundGamingSet: string;
  backgroundMusicalInstrument: string;
  backgroundExplorerTool: string;
  backgroundSkillChoices: SkillKey[];
  backgroundToolPick: "" | "gaming set" | "artisan's tools" | "musical instrument";
  backgroundToolMulti: Array<"thieves' tools" | "gaming set" | "musical instrument">;
  fightingStyle: string;
  favoredEnemy: string;
  favoredHumanoidSpecies: string[];
  favoredTerrain: string;
  monkTool: string;
  baseScores: Record<AbilityKey, number>;
  classSkills: SkillKey[];
  cantripIds: string[];
  spellIds: string[];
  wizardSpellbookIds: string[];
  equipmentChoiceIndices: number[];
  /** key: "c{groupIdx}_{itemIdx}" for choices, "f{itemIdx}" for fixed equipment */
  equipmentSubChoices: Record<string, string>;
  useStartingGold: boolean;
  rolledGold: number | null;
}

export function createInitialCreatorState(): CharacterCreatorState {
  return {
    name: "",
    playerName: "",
    alignment: "",
    speciesId: "",
    subspeciesId: "",
    backgroundId: "",
    classId: "",
    subclassId: "",
    halfElfAbilityBonuses: [],
    variantHumanAbilityBonuses: [],
    variantHumanSkill: "",
    variantHumanFeat: "",
    speciesSkillChoices: [],
    speciesWeaponChoices: [],
    speciesToolChoice: "",
    speciesSkillOrTool: "",
    speciesLanguageChoices: [],
    backgroundLanguageChoices: [],
    backgroundArtisanTool: "",
    backgroundGamingSet: "",
    backgroundMusicalInstrument: "",
    backgroundExplorerTool: "",
    backgroundSkillChoices: [],
    backgroundToolPick: "",
    backgroundToolMulti: [],
    fightingStyle: "",
    favoredEnemy: "",
    favoredHumanoidSpecies: [],
    favoredTerrain: "",
    monkTool: "",
    baseScores: defaultPointBuyScores(),
    classSkills: [],
    cantripIds: [],
    spellIds: [],
    wizardSpellbookIds: [],
    equipmentChoiceIndices: [],
    equipmentSubChoices: {},
    useStartingGold: false,
    rolledGold: null,
  };
}

export const ALIGNMENTS = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "True Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
];

export const CREATOR_STEPS: { id: CreatorStep; label: string }[] = [
  { id: "identity", label: "Identity" },
  { id: "origin", label: "Origin" },
  { id: "class", label: "Class" },
  { id: "abilities", label: "Abilities" },
  { id: "skills", label: "Skills" },
  { id: "spells", label: "Spells" },
  { id: "equipment", label: "Equipment" },
  { id: "review", label: "Review" },
];

export function hasSpellcastingStep(classId: string): boolean {
  return ["bard", "cleric", "druid", "sorcerer", "warlock", "wizard"].includes(
    classId
  );
}

export function getVisibleSteps(state: CharacterCreatorState): CreatorStep[] {
  return CREATOR_STEPS.filter(
    (step) => step.id !== "spells" || hasSpellcastingStep(state.classId)
  ).map((s) => s.id);
}
