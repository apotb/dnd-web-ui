import type { ConfigurableGrantedFeature } from "@/lib/character/feature-choices";
import type { GrantConfigurableFeature } from "@/lib/character/feature-grant-features";
import { TWO_HUMANOID_SPECIES_OPTION } from "@/lib/dnd/phb/favored-enemy-humanoids";
import type { CharacterData, FeatureChoices } from "@/lib/schemas/character";

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function grantOwnedKeys(feature: GrantConfigurableFeature): {
  featureChoiceKeys: (keyof FeatureChoices)[];
  speciesKeys: string[];
  backgroundKeys: string[];
} {
  const editor = feature.grantEditor;
  const featureChoiceKeys: (keyof FeatureChoices)[] = [];
  const speciesKeys: string[] = [];
  const backgroundKeys: string[] = [];

  if (editor.storage.area === "featureChoices") {
    featureChoiceKeys.push(editor.storage.key as keyof FeatureChoices);
    if (editor.kind === "magic-initiate") {
      featureChoiceKeys.push("magicInitiateCantripIds", "magicInitiateSpellId");
    }
  } else if (editor.storage.area === "speciesChoices") {
    speciesKeys.push(editor.storage.key);
    if (editor.kind === "skill-or-tool") {
      speciesKeys.push("speciesSkillOrTool", "speciesToolChoice", "speciesSkillChoices");
    }
  } else if (editor.storage.area === "backgroundChoices") {
    backgroundKeys.push(editor.storage.key);
    if (editor.kind === "tool-pick") {
      backgroundKeys.push(
        "backgroundArtisanTool",
        "backgroundGamingSet",
        "backgroundMusicalInstrument"
      );
    }
  }

  return {
    featureChoiceKeys: [...new Set(featureChoiceKeys)],
    speciesKeys: [...new Set(speciesKeys)],
    backgroundKeys: [...new Set(backgroundKeys)],
  };
}

function pickFeatureChoices(
  data: CharacterData,
  keys: (keyof FeatureChoices)[]
): Partial<FeatureChoices> {
  const source = data.featureChoices ?? {};
  const picked: Partial<FeatureChoices> = {};
  for (const key of keys) {
    (picked as Record<string, unknown>)[key] = source[key];
  }
  return picked;
}

export function isGrantFeatureDraftDirty(
  feature: GrantConfigurableFeature,
  saved: CharacterData,
  draft: CharacterData
): boolean {
  const { featureChoiceKeys, speciesKeys, backgroundKeys } = grantOwnedKeys(feature);

  for (const key of featureChoiceKeys) {
    const savedVal = saved.featureChoices?.[key];
    const draftVal = draft.featureChoices?.[key];
    if (Array.isArray(savedVal) && Array.isArray(draftVal)) {
      if (!arraysEqual(savedVal, draftVal)) return true;
    } else if (savedVal !== draftVal) {
      return true;
    }
  }

  for (const key of speciesKeys) {
    const savedVal = (saved.speciesChoices ?? {})[key as keyof typeof saved.speciesChoices];
    const draftVal = (draft.speciesChoices ?? {})[key as keyof typeof draft.speciesChoices];
    if (Array.isArray(savedVal) && Array.isArray(draftVal)) {
      if (!arraysEqual(savedVal, draftVal)) return true;
    } else if (savedVal !== draftVal) {
      return true;
    }
  }

  for (const key of backgroundKeys) {
    const savedVal = (saved.backgroundChoices ?? {})[
      key as keyof typeof saved.backgroundChoices
    ];
    const draftVal = (draft.backgroundChoices ?? {})[
      key as keyof typeof draft.backgroundChoices
    ];
    if (Array.isArray(savedVal) && Array.isArray(draftVal)) {
      if (!arraysEqual(savedVal, draftVal)) return true;
    } else if (savedVal !== draftVal) {
      return true;
    }
  }

  return false;
}

export function buildGrantFeatureCommitPatch(
  feature: GrantConfigurableFeature,
  saved: CharacterData,
  draft: CharacterData
): Partial<CharacterData> {
  const { featureChoiceKeys, speciesKeys, backgroundKeys } = grantOwnedKeys(feature);
  const patch: Partial<CharacterData> = {};

  if (featureChoiceKeys.length > 0) {
    patch.featureChoices = {
      ...(saved.featureChoices ?? {}),
      ...pickFeatureChoices(draft, featureChoiceKeys),
    } as FeatureChoices;
  }

  if (speciesKeys.length > 0) {
    const nextSpecies = { ...(saved.speciesChoices ?? {}) };
    for (const key of speciesKeys) {
      (nextSpecies as Record<string, unknown>)[key] = (
        draft.speciesChoices ?? {}
      )[key as keyof typeof draft.speciesChoices];
    }
    patch.speciesChoices = nextSpecies;
  }

  if (backgroundKeys.length > 0) {
    const nextBackground = { ...(saved.backgroundChoices ?? {}) };
    for (const key of backgroundKeys) {
      (nextBackground as Record<string, unknown>)[key] = (
        draft.backgroundChoices ?? {}
      )[key as keyof typeof draft.backgroundChoices];
    }
    patch.backgroundChoices = nextBackground;
  }

  return patch;
}

export function isConfigurableFeatureDraftDirty(
  feature: ConfigurableGrantedFeature,
  saved: CharacterData,
  draft: CharacterData
): boolean {
  const savedChoices = saved.featureChoices ?? {};
  const draftChoices = draft.featureChoices ?? {};

  if (savedChoices[feature.choiceKey] !== draftChoices[feature.choiceKey]) {
    return true;
  }

  if (
    feature.choiceKey === "favoredEnemy" &&
    !arraysEqual(
      savedChoices.favoredHumanoidSpecies ?? [],
      draftChoices.favoredHumanoidSpecies ?? []
    )
  ) {
    return true;
  }

  return false;
}

export function buildConfigurableFeatureCommitPatch(
  feature: ConfigurableGrantedFeature,
  saved: CharacterData,
  draft: CharacterData
): Partial<CharacterData> {
  const savedChoices = saved.featureChoices ?? {};
  const draftChoices = draft.featureChoices ?? {};
  const nextChoices = { ...savedChoices, [feature.choiceKey]: draftChoices[feature.choiceKey] };

  if (feature.choiceKey === "favoredEnemy") {
    if (draftChoices.favoredEnemy !== TWO_HUMANOID_SPECIES_OPTION) {
      nextChoices.favoredHumanoidSpecies = [];
    } else {
      nextChoices.favoredHumanoidSpecies = draftChoices.favoredHumanoidSpecies ?? [];
    }
  }

  if (feature.choiceKey === "variantHumanFeat") {
    const savedFeat = savedChoices.variantHumanFeat;
    const draftFeat = draftChoices.variantHumanFeat;
    if (savedFeat !== draftFeat) {
      nextChoices.magicInitiateClass = "";
      nextChoices.magicInitiateCantripIds = [];
      nextChoices.magicInitiateSpellId = "";
    }
  }

  return { featureChoices: nextChoices };
}
