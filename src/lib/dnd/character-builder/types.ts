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
  raceId: string;
  subraceId: string;
  backgroundId: string;
  classId: string;
  subclassId: string;
  halfElfAbilityBonuses: AbilityKey[];
  variantHumanAbilityBonuses: AbilityKey[];
  variantHumanSkill: SkillKey | "";
  variantHumanFeat: string;
  halfElfSkills: SkillKey[];
  raceLanguageChoices: string[];
  backgroundLanguageChoices: string[];
  backgroundArtisanTool: string;
  backgroundGamingSet: string;
  backgroundMusicalInstrument: string;
  fightingStyle: string;
  favoredEnemy: string;
  favoredTerrain: string;
  monkTool: string;
  baseScores: Record<AbilityKey, number>;
  classSkills: SkillKey[];
  cantripIds: string[];
  spellIds: string[];
  wizardSpellbookIds: string[];
  equipmentChoiceIndices: number[];
  useStartingGold: boolean;
  rolledGold: number | null;
}

export function createInitialCreatorState(): CharacterCreatorState {
  return {
    name: "",
    playerName: "",
    alignment: "",
    raceId: "",
    subraceId: "",
    backgroundId: "",
    classId: "",
    subclassId: "",
    halfElfAbilityBonuses: [],
    variantHumanAbilityBonuses: [],
    variantHumanSkill: "",
    variantHumanFeat: "",
    halfElfSkills: [],
    raceLanguageChoices: [],
    backgroundLanguageChoices: [],
    backgroundArtisanTool: "",
    backgroundGamingSet: "",
    backgroundMusicalInstrument: "",
    fightingStyle: "",
    favoredEnemy: "",
    favoredTerrain: "",
    monkTool: "",
    baseScores: defaultPointBuyScores(),
    classSkills: [],
    cantripIds: [],
    spellIds: [],
    wizardSpellbookIds: [],
    equipmentChoiceIndices: [],
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
