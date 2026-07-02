import { resolveCharacterClass } from "@/lib/character/class-derivation";
import { getAllCharacterFeatIds } from "@/lib/character/character-feats";
import {
  featureFamilyKey,
  isFeatureNewlyAvailableAtLevel,
  getUnlockedCatalogFeatures,
  isOverriddenClassFeature,
} from "@/lib/character/feature-derivation";
import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import { buildFightingStyleChoiceOptions, buildSubclassChoiceOptions, type ChoiceOption } from "@/lib/character/feature-choices";
import { findSubclassByName } from "@/lib/content/catalog-tooltip";
import { isAsiLevel } from "@/lib/dnd/asi-levels";
import {
  parseCatalogFeatureEntry,
  slugifyFeatureName,
  type CatalogFeatureEntry,
} from "@/lib/dnd/catalog-feature-mechanics";
import { getFeatAbilityBonusConfig } from "@/lib/dnd/feat-ability-bonuses";
import {
  getFavoredEnemySlotCount,
  getFavoredTerrainSlotCount,
  getRangerPicksFromChoices,
  isRangerPickLevelUpLevel,
  rangerHasUnfilledPickSlots,
} from "@/lib/dnd/phb/ranger-feature-slots";
import {
  getFightingStyleOptions,
  needsFightingStylePick,
} from "@/lib/dnd/phb/fighting-styles";
import { TWO_HUMANOID_SPECIES_OPTION } from "@/lib/dnd/phb/favored-enemy-humanoids";
import type { PhbClass } from "@/lib/dnd/phb/types";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import {
  classHasSpellcastingAtLevel,
  getCantripsKnownLimit,
  getPreparedSpellPickCount,
  getSpellsKnownPickCount,
  isWizard,
} from "@/lib/dnd/spellcasting";
import { abilityModifier } from "@/lib/dnd/calculations";
import { getCharacterLevel } from "@/lib/dnd/xp";
import type { AbilityKey, CharacterData, FeatureChoices } from "@/lib/schemas/character";

export type LevelUpStepKind =
  | "review"
  | "hp"
  | "subclass"
  | "subclassChoices"
  | "fightingStyle"
  | "prepareSpells"
  | "rangerPicks"
  | "cantrips"
  | "spellsKnown"
  | "wizardSpellbook"
  | "asiOrFeat";

export interface LevelUpFeaturePreview {
  name: string;
  description: string;
  source: "class" | "subclass" | "other";
}

export interface LevelUpStepBase {
  kind: LevelUpStepKind;
}

export interface ReviewStep extends LevelUpStepBase {
  kind: "review";
  features: LevelUpFeaturePreview[];
}

export interface HpStep extends LevelUpStepBase {
  kind: "hp";
  hitDie: number;
  conMod: number;
  /** Mean die roll rounded down (floor(d/2)). */
  averageRoll: number;
  averageGain: number;
}

export interface SubclassStep extends LevelUpStepBase {
  kind: "subclass";
  options: ChoiceOption[];
}

export interface SubclassChoicesStep extends LevelUpStepBase {
  kind: "subclassChoices";
  subclassId: string;
}

export interface FightingStyleStep extends LevelUpStepBase {
  kind: "fightingStyle";
  options: ChoiceOption[];
}

export interface PrepareSpellsStep extends LevelUpStepBase {
  kind: "prepareSpells";
  count: number;
  classListId: string;
  maxSpellLevel: number;
}

export interface RangerPicksStep extends LevelUpStepBase {
  kind: "rangerPicks";
  enemySlotCount: number;
  terrainSlotCount: number;
}

export interface CantripsStep extends LevelUpStepBase {
  kind: "cantrips";
  count: number;
  classListId: string;
}

export interface SpellsKnownStep extends LevelUpStepBase {
  kind: "spellsKnown";
  count: number;
  classListId: string;
  maxSpellLevel: number;
}

export interface WizardSpellbookStep extends LevelUpStepBase {
  kind: "wizardSpellbook";
  count: number;
  maxSpellLevel: number;
}

export interface AsiOrFeatStep extends LevelUpStepBase {
  kind: "asiOrFeat";
  level: number;
}

export type LevelUpStep =
  | ReviewStep
  | HpStep
  | SubclassStep
  | SubclassChoicesStep
  | FightingStyleStep
  | PrepareSpellsStep
  | RangerPicksStep
  | CantripsStep
  | SpellsKnownStep
  | WizardSpellbookStep
  | AsiOrFeatStep;

export type HpGainMethod = "roll" | "average";

export interface LevelUpAsiDraft {
  mode: "asi";
  /** +2 to one ability, or +1/+1 split. */
  style?: "double" | "split";
  doubleAbility?: AbilityKey;
  splitAbilities?: [AbilityKey, AbilityKey];
}

export interface LevelUpFeatDraft {
  mode: "feat";
  featId: string;
  /** Index into feat ability choice options when applicable. */
  featAbilityChoiceIndex?: number;
  /** Magic Initiate picks when feat is magic-initiate. */
  magicInitiateClass?: string;
  magicInitiateCantripIds?: string[];
  magicInitiateSpellId?: string;
}

export interface LevelUpDraft {
  hp?: {
    method: HpGainMethod;
    rollResult?: number;
    gain: number;
  };
  subclassId?: string;
  subclassName?: string;
  fightingStyle?: string;
  featureChoices?: Partial<FeatureChoices>;
  cantripIds?: string[];
  spellIds?: string[];
  preparedSpellIds?: string[];
  wizardSpellIds?: string[];
  asiOrFeat?: LevelUpAsiDraft | LevelUpFeatDraft;
}

function resolveClasses(catalogs: FeatureCatalogs): PhbClass[] {
  return catalogs.classes?.length ? catalogs.classes : PHB_CLASSES;
}

function getSubclassId(data: CharacterData, catalogs: FeatureCatalogs): string | null {
  const classes = resolveClasses(catalogs);
  const cls = resolveCharacterClass(data, classes);
  if (!cls || !data.basicInfo.subclass.trim()) return null;
  const match = findSubclassByName(
    cls.name,
    data.basicInfo.subclass,
    classes
  );
  return match?.subclass.id ?? null;
}

function needsSubclassPick(
  cls: PhbClass,
  data: CharacterData,
  targetLevel: number
): boolean {
  return targetLevel === cls.subclassLevel && !data.basicInfo.subclass.trim();
}

function needsSubclassChoices(
  subclassId: string,
  draft: LevelUpDraft
): boolean {
  const id = draft.subclassId ?? subclassId;
  if (id === "nature") return true;
  if (id === "knowledge") return true;
  return false;
}

function getMaxCastableAtLevel(
  cls: PhbClass,
  targetLevel: number
): number {
  if (cls.id === "warlock") {
    const pactLevels = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
    return pactLevels[Math.min(targetLevel, 20) - 1] ?? 1;
  }
  const row = [
    1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 9, 9,
  ];
  return row[Math.min(targetLevel, 20) - 1] ?? 1;
}

function resolveClassHitDie(cls: PhbClass): number {
  if (typeof cls.hitDie === "number" && cls.hitDie > 0) return cls.hitDie;
  const phb = PHB_CLASSES.find((c) => c.id === cls.id);
  return phb?.hitDie ?? 8;
}

function featurePreviewKey(
  entry: { name: string; slug?: string },
  source: LevelUpFeaturePreview["source"]
): string {
  const parsed = parseCatalogFeatureEntry(entry);
  const slug = parsed?.slug?.trim();
  if (slug) return `${source}:${slug}`;
  return `${source}:${parsed?.name ?? entry.name}`;
}

function pushFeaturePreview(
  features: LevelUpFeaturePreview[],
  seen: Set<string>,
  entry: { name: string; description: string; slug?: string },
  source: LevelUpFeaturePreview["source"]
): void {
  const key = featurePreviewKey(entry, source);
  if (seen.has(key)) return;
  const parsed = parseCatalogFeatureEntry(entry);
  if (!parsed) return;
  seen.add(key);
  features.push({
    name: parsed.name,
    description: parsed.description,
    source,
  });
}

export function getNewFeaturesAtLevel(
  data: CharacterData,
  catalogs: FeatureCatalogs,
  targetLevel: number,
  draft?: LevelUpDraft
): LevelUpFeaturePreview[] {
  const classes = resolveClasses(catalogs);
  const cls = resolveCharacterClass(data, classes);
  if (!cls) return [];

  const features: LevelUpFeaturePreview[] = [];
  const seen = new Set<string>();

  getUnlockedCatalogFeatures(cls.features, targetLevel, cls.id).forEach((entry) => {
    if (isFeatureNewlyAvailableAtLevel(entry, targetLevel)) {
      pushFeaturePreview(features, seen, entry, "class");
    }
  });

  const subclassId =
    draft?.subclassId ??
    getSubclassId(data, catalogs);
  const subclassName =
    draft?.subclassName ?? data.basicInfo.subclass;
  if (subclassId && subclassName) {
    const match = findSubclassByName(cls.name, subclassName, classes);
    const sub = match?.subclass;
    if (sub) {
      getUnlockedCatalogFeatures(sub.features, targetLevel).forEach((entry) => {
        if (isFeatureNewlyAvailableAtLevel(entry, targetLevel)) {
          pushFeaturePreview(features, seen, entry, "subclass");
        }
      });
    }
  }

  return features;
}

export function averageHitDieRoll(hitDie: number): number {
  return Math.floor(hitDie / 2);
}

export function averageHpGain(hitDie: number, conMod: number): number {
  return Math.max(1, averageHitDieRoll(hitDie) + conMod);
}

export function computeHpGain(
  hitDie: number,
  conMod: number,
  method: HpGainMethod,
  rollResult?: number
): number {
  if (method === "average") {
    return averageHpGain(hitDie, conMod);
  }
  const roll = rollResult ?? 0;
  return Math.max(1, roll + conMod);
}

const SPELL_STEP_KINDS: LevelUpStepKind[] = [
  "cantrips",
  "prepareSpells",
  "wizardSpellbook",
  "spellsKnown",
];

const TRAILING_STEP_KINDS: LevelUpStepKind[] = [
  "rangerPicks",
  "subclassChoices",
  "hp",
  "asiOrFeat",
];

function sortCatalogFeatures(entries: CatalogFeatureEntry[]): CatalogFeatureEntry[] {
  return [...entries].sort((a, b) => {
    const levelDiff = (a.minLevel ?? 1) - (b.minLevel ?? 1);
    if (levelDiff !== 0) return levelDiff;
    const keyA = a.slug?.trim() || slugifyFeatureName(a.name);
    const keyB = b.slug?.trim() || slugifyFeatureName(b.name);
    return keyA.localeCompare(keyB);
  });
}

function getClassFeaturesNewAtLevel(
  cls: PhbClass,
  targetLevel: number
): CatalogFeatureEntry[] {
  const filtered = cls.features.filter((f) => {
    if (f.name.startsWith("Fighting Style:")) return false;
    return isFeatureNewlyAvailableAtLevel(f, targetLevel);
  });
  return sortCatalogFeatures(filtered);
}

function previewForChoiceStep(step: LevelUpStep): LevelUpFeaturePreview | null {
  switch (step.kind) {
    case "hp":
      return {
        name: "Hit Points",
        description: `Roll or take the average on your class hit die (d${step.hitDie}) plus Constitution.`,
        source: "other",
      };
    case "subclassChoices":
      return {
        name: "Subclass choices",
        description: "Make additional choices for your subclass.",
        source: "other",
      };
    case "fightingStyle":
      return {
        name: "Fighting Style",
        description: "Choose a fighting style specialty.",
        source: "other",
      };
    case "prepareSpells":
      return {
        name: `+${step.count} prepared spell${step.count === 1 ? "" : "s"}`,
        description: `Choose spells to prepare (up to ${step.maxSpellLevel}${step.maxSpellLevel === 1 ? "st" : step.maxSpellLevel === 2 ? "nd" : step.maxSpellLevel === 3 ? "rd" : "th"} level).`,
        source: "other",
      };
    case "rangerPicks":
      return {
        name: "Ranger choices",
        description: "Choose additional favored enemies and/or favored terrain types.",
        source: "other",
      };
    case "cantrips":
      return {
        name: `+${step.count} cantrip${step.count === 1 ? "" : "s"}`,
        description: "Choose new cantrips for your spell list.",
        source: "other",
      };
    case "spellsKnown":
      return {
        name: `+${step.count} spell${step.count === 1 ? "" : "s"} known`,
        description: `Choose up to ${step.maxSpellLevel}${step.maxSpellLevel === 1 ? "st" : step.maxSpellLevel === 2 ? "nd" : step.maxSpellLevel === 3 ? "rd" : "th"}-level spells.`,
        source: "other",
      };
    case "wizardSpellbook":
      return {
        name: `+${step.count} spells in spellbook`,
        description: `Add spells up to ${step.maxSpellLevel}${step.maxSpellLevel === 1 ? "st" : step.maxSpellLevel === 2 ? "nd" : step.maxSpellLevel === 3 ? "rd" : "th"} level to your spellbook.`,
        source: "other",
      };
    case "asiOrFeat":
      return {
        name: "Ability Score Improvement",
        description: "Increase ability scores or take a feat.",
        source: "other",
      };
    default:
      return null;
  }
}

function pushChoicePreview(
  features: LevelUpFeaturePreview[],
  seen: Set<string>,
  preview: LevelUpFeaturePreview
): void {
  const key = `${preview.source}:${preview.name}`;
  if (seen.has(key)) return;
  seen.add(key);
  features.push(preview);
}

function tryTakeOverrideStep(
  classId: string,
  entry: CatalogFeatureEntry,
  takeStep: (kind: LevelUpStepKind) => void
): boolean {
  if (!isOverriddenClassFeature(classId, entry.name)) return false;
  const family = featureFamilyKey(entry.name);
  if (family === "fighting style") {
    takeStep("fightingStyle");
    return true;
  }
  if (family === "favored enemy" || family === "natural explorer") {
    takeStep("rangerPicks");
    return true;
  }
  return false;
}

function insertSpellSteps(takeStep: (kind: LevelUpStepKind) => void): void {
  for (const kind of SPELL_STEP_KINDS) {
    takeStep(kind);
  }
}

function appendSubclassFeaturePreviews(
  data: CharacterData,
  catalogs: FeatureCatalogs,
  targetLevel: number,
  draft: LevelUpDraft | undefined,
  features: LevelUpFeaturePreview[],
  seen: Set<string>
): void {
  const classes = resolveClasses(catalogs);
  const cls = resolveCharacterClass(data, classes);
  if (!cls) return;

  const subclassId = draft?.subclassId ?? getSubclassId(data, catalogs);
  const subclassName = draft?.subclassName ?? data.basicInfo.subclass;
  if (!subclassId || !subclassName) return;

  const match = findSubclassByName(cls.name, subclassName, classes);
  const sub = match?.subclass;
  if (!sub) return;

  getUnlockedCatalogFeatures(sub.features, targetLevel).forEach((entry) => {
    if (isFeatureNewlyAvailableAtLevel(entry, targetLevel)) {
      pushFeaturePreview(features, seen, entry, "subclass");
    }
  });
}

function mergeReviewAndOrderSteps(
  cls: PhbClass,
  data: CharacterData,
  catalogs: FeatureCatalogs,
  targetLevel: number,
  draft: LevelUpDraft | undefined,
  choiceSteps: LevelUpStep[]
): { reviewFeatures: LevelUpFeaturePreview[]; orderedSteps: LevelUpStep[] } {
  const reviewFeatures: LevelUpFeaturePreview[] = [];
  const seen = new Set<string>();
  const orderedSteps: LevelUpStep[] = [];
  const pending = new Map<LevelUpStepKind, LevelUpStep>();
  for (const step of choiceSteps) {
    pending.set(step.kind, step);
  }

  const takeStep = (kind: LevelUpStepKind): void => {
    const step = pending.get(kind);
    if (!step) return;
    pending.delete(kind);
    orderedSteps.push(step);
    const preview = previewForChoiceStep(step);
    if (preview) pushChoicePreview(reviewFeatures, seen, preview);
  };

  let spellcastingNewThisLevel = false;

  for (const entry of getClassFeaturesNewAtLevel(cls, targetLevel)) {
    if (tryTakeOverrideStep(cls.id, entry, takeStep)) {
      continue;
    }
    pushFeaturePreview(reviewFeatures, seen, entry, "class");
    if (featureFamilyKey(entry.name) === "spellcasting") {
      spellcastingNewThisLevel = true;
      insertSpellSteps(takeStep);
    }
  }

  appendSubclassFeaturePreviews(
    data,
    catalogs,
    targetLevel,
    draft,
    reviewFeatures,
    seen
  );

  if (pending.has("prepareSpells") && !spellcastingNewThisLevel) {
    takeStep("prepareSpells");
  }

  insertSpellSteps(takeStep);

  for (const kind of TRAILING_STEP_KINDS) {
    takeStep(kind);
  }

  return { reviewFeatures, orderedSteps };
}

function collectChoiceSteps(
  cls: PhbClass,
  data: CharacterData,
  catalogs: FeatureCatalogs,
  targetLevel: number,
  draft?: LevelUpDraft
): LevelUpStep[] {
  const currentLevel = getCharacterLevel(data);
  const choiceSteps: LevelUpStep[] = [];

  if (
    needsFightingStylePick(
      cls.id,
      currentLevel,
      targetLevel,
      data.featureChoices?.fightingStyle
    )
  ) {
    choiceSteps.push({
      kind: "fightingStyle",
      options: buildFightingStyleChoiceOptions(
        cls.features,
        getFightingStyleOptions(cls.id)
      ),
    });
  }

  const prepareCount = getPreparedSpellPickCount(
    cls,
    currentLevel,
    targetLevel,
    data.abilityScores
  );
  if (prepareCount > 0) {
    choiceSteps.push({
      kind: "prepareSpells",
      count: prepareCount,
      classListId: cls.spellcasting?.spellListId ?? cls.id,
      maxSpellLevel: getMaxCastableAtLevel(cls, targetLevel),
    });
  }

  if (targetLevel >= 2) {
    const hitDie = resolveClassHitDie(cls);
    const conMod = abilityModifier(data.abilityScores.con);
    const averageRoll = averageHitDieRoll(hitDie);
    choiceSteps.push({
      kind: "hp",
      hitDie,
      conMod,
      averageRoll,
      averageGain: averageHpGain(hitDie, conMod),
    });
  }

  const effectiveSubclassId =
    draft?.subclassId ?? getSubclassId(data, catalogs);
  if (
    effectiveSubclassId &&
    needsSubclassChoices(effectiveSubclassId, draft ?? {})
  ) {
    choiceSteps.push({ kind: "subclassChoices", subclassId: effectiveSubclassId });
  }

  if (
    cls.id === "ranger" &&
    isRangerPickLevelUpLevel(targetLevel) &&
    rangerHasUnfilledPickSlots(data.featureChoices, targetLevel)
  ) {
    choiceSteps.push({
      kind: "rangerPicks",
      enemySlotCount: getFavoredEnemySlotCount(targetLevel),
      terrainSlotCount: getFavoredTerrainSlotCount(targetLevel),
    });
  }

  if (cls.spellcasting && classHasSpellcastingAtLevel(cls, targetLevel)) {
    const prevCantrips = getCantripsKnownLimit(cls, currentLevel);
    const nextCantrips = getCantripsKnownLimit(cls, targetLevel);
    const cantripDelta = nextCantrips - prevCantrips;
    if (cantripDelta > 0) {
      choiceSteps.push({
        kind: "cantrips",
        count: cantripDelta,
        classListId: cls.id,
      });
    }

    if (isWizard(cls) && targetLevel > currentLevel && targetLevel >= 2) {
      choiceSteps.push({
        kind: "wizardSpellbook",
        count: 2,
        maxSpellLevel: getMaxCastableAtLevel(cls, targetLevel),
      });
    } else {
      const knownPickCount = getSpellsKnownPickCount(cls, currentLevel, targetLevel);
      if (knownPickCount > 0) {
        choiceSteps.push({
          kind: "spellsKnown",
          count: knownPickCount,
          classListId: cls.id,
          maxSpellLevel: getMaxCastableAtLevel(cls, targetLevel),
        });
      }
    }
  }

  if (isAsiLevel(cls.id, targetLevel)) {
    choiceSteps.push({ kind: "asiOrFeat", level: targetLevel });
  }

  return choiceSteps;
}

export function getLevelUpSteps(
  data: CharacterData,
  catalogs: FeatureCatalogs,
  targetLevel: number,
  draft?: LevelUpDraft
): LevelUpStep[] {
  const classes = resolveClasses(catalogs);
  const cls = resolveCharacterClass(data, classes);
  if (!cls) return [{ kind: "review", features: [] }];

  const choiceSteps = collectChoiceSteps(cls, data, catalogs, targetLevel, draft);
  const { reviewFeatures, orderedSteps } = mergeReviewAndOrderSteps(
    cls,
    data,
    catalogs,
    targetLevel,
    draft,
    choiceSteps
  );

  const steps: LevelUpStep[] = [];

  steps.push({ kind: "review", features: reviewFeatures });

  if (needsSubclassPick(cls, data, targetLevel)) {
    steps.push({
      kind: "subclass",
      options: buildSubclassChoiceOptions(cls.subclasses, targetLevel),
    });
  }

  steps.push(...orderedSteps);

  return steps;
}

function validateAsiDraft(draft: LevelUpAsiDraft, data: CharacterData): string | null {
  if (!draft.style) {
    return "Choose how to apply your ability score improvement (+2 or +1/+1).";
  }
  if (draft.style === "double") {
    if (!draft.doubleAbility) return "Choose an ability to increase by 2.";
    const next = data.abilityScores[draft.doubleAbility] + 2;
    if (next > 20) return "Ability scores cannot exceed 20.";
    return null;
  }
  if (!draft.splitAbilities || draft.splitAbilities.length !== 2) {
    return "Choose two different abilities to increase by 1.";
  }
  const [a, b] = draft.splitAbilities;
  if (a === b) return "Choose two different abilities.";
  if (data.abilityScores[a] + 1 > 20 || data.abilityScores[b] + 1 > 20) {
    return "Ability scores cannot exceed 20.";
  }
  return null;
}

function validateFeatDraft(draft: LevelUpFeatDraft): string | null {
  if (!draft.featId) return "Choose a feat.";
  const bonusConfig = getFeatAbilityBonusConfig(draft.featId);
  if (bonusConfig?.mode === "choice") {
    if (draft.featAbilityChoiceIndex == null) {
      return "Choose which ability score this feat increases.";
    }
  }
  if (draft.featId === "magic-initiate") {
    if (!draft.magicInitiateClass) return "Choose a spell list for Magic Initiate.";
    if ((draft.magicInitiateCantripIds?.length ?? 0) !== 2) {
      return "Choose two cantrips for Magic Initiate.";
    }
    if (!draft.magicInitiateSpellId) {
      return "Choose a 1st-level spell for Magic Initiate.";
    }
  }
  return null;
}

export function validateLevelUpStep(
  data: CharacterData,
  catalogs: FeatureCatalogs,
  targetLevel: number,
  step: LevelUpStep,
  draft: LevelUpDraft
): string | null {
  return validateLevelUpDraft(
    data,
    catalogs,
    targetLevel,
    draft,
    [step]
  );
}

export function validateLevelUpDraft(
  data: CharacterData,
  catalogs: FeatureCatalogs,
  targetLevel: number,
  draft: LevelUpDraft,
  onlySteps?: LevelUpStep[]
): string | null {
  const steps = onlySteps ?? getLevelUpSteps(data, catalogs, targetLevel, draft);

  for (const step of steps) {
    switch (step.kind) {
      case "hp": {
        if (!draft.hp) return "Choose how to gain hit points.";
        if (draft.hp.method === "roll") {
          const roll = draft.hp.rollResult;
          if (roll == null || roll < 1 || roll > step.hitDie) {
            return `Enter a hit die roll (1–${step.hitDie}).`;
          }
        }
        if (draft.hp.gain < 1) return "Invalid HP gain.";
        break;
      }
      case "subclass": {
        if (!draft.subclassId || !draft.subclassName) return "Choose a subclass.";
        break;
      }
      case "subclassChoices": {
        const choices = draft.featureChoices ?? {};
        if (step.subclassId === "nature") {
          if (!choices.bonusDruidCantripId) return "Nature Domain requires a druid cantrip.";
          if (!choices.acolyteOfNatureSkill) return "Nature Domain requires a skill.";
        }
        if (step.subclassId === "knowledge") {
          if ((choices.knowledgeDomainLanguages?.length ?? 0) !== 2) {
            return "Knowledge Domain requires two bonus languages.";
          }
          if ((choices.knowledgeDomainSkills?.length ?? 0) !== 2) {
            return "Knowledge Domain requires two bonus skills.";
          }
        }
        break;
      }
      case "fightingStyle": {
        if (!draft.fightingStyle?.trim()) return "Choose a fighting style.";
        if (!step.options.some((option) => option.value === draft.fightingStyle)) {
          return "Invalid fighting style for this class.";
        }
        break;
      }
      case "prepareSpells": {
        if ((draft.preparedSpellIds?.length ?? 0) !== step.count) {
          return `Choose ${step.count} prepared spell${step.count === 1 ? "" : "s"}.`;
        }
        break;
      }
      case "rangerPicks": {
        const merged = {
          ...(data.featureChoices ?? {}),
          ...(draft.featureChoices ?? {}),
        };
        const { enemyPicks, terrains } = getRangerPicksFromChoices(merged, targetLevel);
        for (const pick of enemyPicks) {
          if (!pick.enemy.trim()) return "Choose all favored enemy types.";
          if (
            pick.enemy === TWO_HUMANOID_SPECIES_OPTION &&
            pick.humanoidSpecies.length !== 2
          ) {
            return "Choose exactly two humanoid species for each humanoid favored enemy.";
          }
        }
        for (const terrain of terrains) {
          if (!terrain.trim()) return "Choose all favored terrain types.";
        }
        break;
      }
      case "cantrips": {
        if ((draft.cantripIds?.length ?? 0) !== step.count) {
          return `Choose ${step.count} cantrip${step.count === 1 ? "" : "s"}.`;
        }
        break;
      }
      case "spellsKnown": {
        if ((draft.spellIds?.length ?? 0) !== step.count) {
          return `Choose ${step.count} spell${step.count === 1 ? "" : "s"}.`;
        }
        break;
      }
      case "wizardSpellbook": {
        if ((draft.wizardSpellIds?.length ?? 0) !== step.count) {
          return `Add ${step.count} spells to your spellbook.`;
        }
        break;
      }
      case "asiOrFeat": {
        if (!draft.asiOrFeat) return "Choose an ability score improvement or a feat.";
        if (draft.asiOrFeat.mode === "asi") {
          const err = validateAsiDraft(draft.asiOrFeat, data);
          if (err) return err;
        } else {
          const err = validateFeatDraft(draft.asiOrFeat);
          if (err) return err;
        }
        break;
      }
      default:
        break;
    }
  }

  return null;
}

export function getAllSelectedFeatIds(data: CharacterData): string[] {
  return getAllCharacterFeatIds(data);
}
