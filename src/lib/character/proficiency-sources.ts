import type { CharacterData } from "@/lib/schemas/character";
import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import {
  getEffectiveArmorProficiencies,
  getEffectiveWeaponProficiencies,
  resolveCharacterClass,
} from "@/lib/character/class-derivation";
import { getEffectiveToolProficiencies } from "@/lib/character/feature-grant-sync";
import {
  findBackgroundByName,
  findSpeciesByDisplayName,
} from "@/lib/content/catalog-tooltip";
import { resolveBackgroundToolProficiencies } from "@/lib/dnd/character-builder/build-character";
import type { CharacterCreatorState } from "@/lib/dnd/character-builder/types";
import { getFeat } from "@/lib/dnd/phb/feats";
import { hasTavernBrawler } from "@/lib/dnd/unarmed-mechanics";
import { PHB_BACKGROUNDS } from "@/lib/dnd/phb/backgrounds";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import { PHB_SPECIES } from "@/lib/dnd/phb/species";
import type { CreatorCatalog } from "@/lib/content/catalog";
import type { PhbBackground } from "@/lib/dnd/phb/types";

export interface ProficiencyEntry {
  name: string;
  sources: string[];
}

function resolveCatalogs(catalogs: FeatureCatalogs = {}) {
  return {
    species: catalogs.species?.length ? catalogs.species : PHB_SPECIES,
    classes: catalogs.classes?.length ? catalogs.classes : PHB_CLASSES,
    backgrounds: catalogs.backgrounds?.length ? catalogs.backgrounds : PHB_BACKGROUNDS,
  };
}

function profKey(name: string): string {
  return name.toLowerCase().trim();
}

type SourceTracker = Map<string, { displayName: string; sources: Set<string> }>;

function trackSource(tracker: SourceTracker, name: string, source: string) {
  const key = profKey(name);
  const entry = tracker.get(key) ?? { displayName: name, sources: new Set<string>() };
  entry.sources.add(source);
  tracker.set(key, entry);
}

function entriesFromTracker(
  tracker: SourceTracker,
  displayed: string[]
): ProficiencyEntry[] {
  return displayed.map((name) => {
    const tracked = tracker.get(profKey(name));
    return {
      name,
      sources: tracked ? [...tracked.sources].sort() : [],
    };
  });
}

function creatorStateFromCharacter(
  data: CharacterData,
  background: PhbBackground | undefined
): CharacterCreatorState {
  const bg = data.backgroundChoices ?? {};
  return {
    speciesId: "",
    subspeciesId: "",
    backgroundId: background?.id ?? "",
    classId: "",
    subclassId: "",
    name: data.basicInfo.name,
    playerName: data.basicInfo.playerName,
    alignment: data.basicInfo.alignment,
    baseScores: data.abilityScores,
    halfElfAbilityBonuses: data.speciesChoices?.halfElfAbilityBonuses ?? [],
    speciesSkillChoices: data.speciesChoices?.speciesSkillChoices ?? [],
    speciesWeaponChoices: data.speciesChoices?.speciesWeaponChoices ?? [],
    speciesToolChoice: data.speciesChoices?.speciesToolChoice ?? "",
    speciesSkillOrTool: data.speciesChoices?.speciesSkillOrTool ?? "",
    variantHumanAbilityBonuses: data.speciesChoices?.variantHumanAbilityBonuses ?? [],
    variantHumanSkill: data.speciesChoices?.variantHumanSkill ?? "",
    variantHumanFeat: data.featureChoices?.variantHumanFeat ?? "",
    speciesLanguageChoices: data.speciesLanguageChoices ?? [],
    backgroundLanguageChoices: data.backgroundLanguageChoices ?? [],
    backgroundArtisanTool: bg.backgroundArtisanTool ?? "",
    backgroundGamingSet: bg.backgroundGamingSet ?? "",
    backgroundMusicalInstrument: bg.backgroundMusicalInstrument ?? "",
    backgroundExplorerTool: bg.backgroundExplorerTool ?? "",
    backgroundSkillChoices: bg.backgroundSkillChoices ?? [],
    backgroundToolPick: bg.backgroundToolPick ?? "",
    backgroundToolMulti: bg.backgroundToolMulti ?? [],
    classSkills: [],
    equipmentChoiceIndices: [],
    equipmentSubChoices: {},
    cantripIds: [],
    spellIds: [],
    wizardSpellbookIds: [],
    fightingStyle: data.featureChoices?.fightingStyle ?? "",
    favoredEnemy: data.featureChoices?.favoredEnemy ?? "",
    favoredHumanoidSpecies: data.featureChoices?.favoredHumanoidSpecies ?? [],
    favoredTerrain: data.featureChoices?.favoredTerrain ?? "",
    monkTool: "",
    useStartingGold: false,
    rolledGold: 0,
  };
}

function speciesLabel(data: CharacterData): string {
  const name = data.basicInfo.species.trim() || "Unknown";
  return `Species (${name})`;
}

export function getWeaponProficienciesWithSources(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): ProficiencyEntry[] {
  const { species: speciesList, classes } = resolveCatalogs(catalogs);
  const tracker: SourceTracker = new Map();
  const match = findSpeciesByDisplayName(data.basicInfo.species, speciesList);
  const species = match?.species;
  const sub = match?.subspecies;
  const speciesChoices = data.speciesChoices ?? {};
  const cls = resolveCharacterClass(data, classes);
  const classLabel = cls?.name ? `Class (${cls.name})` : "Class";

  species?.weaponProficiencies?.forEach((w) =>
    trackSource(tracker, w, speciesLabel(data))
  );
  sub?.weaponProficiencies?.forEach((w) =>
    trackSource(tracker, w, speciesLabel(data))
  );
  speciesChoices.speciesWeaponChoices.forEach((w) =>
    trackSource(
      tracker,
      w,
      species?.weaponChoices?.prompt
        ? `${speciesLabel(data)} (${species.weaponChoices.prompt})`
        : speciesLabel(data)
    )
  );
  cls?.weaponProficiencies?.forEach((w) => trackSource(tracker, w, classLabel));

  if (hasTavernBrawler(data)) {
    trackSource(tracker, "improvised weapons", "Feat (Tavern Brawler)");
  }

  return entriesFromTracker(
    tracker,
    getEffectiveWeaponProficiencies(data, classes)
  );
}

export function getArmorProficienciesWithSources(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): ProficiencyEntry[] {
  const { species: speciesList, classes } = resolveCatalogs(catalogs);
  const tracker: SourceTracker = new Map();
  const match = findSpeciesByDisplayName(data.basicInfo.species, speciesList);
  const species = match?.species;
  const sub = match?.subspecies;
  const cls = resolveCharacterClass(data, classes);
  const classLabel = cls?.name ? `Class (${cls.name})` : "Class";

  species?.armorProficiencies?.forEach((a) =>
    trackSource(tracker, a, speciesLabel(data))
  );
  sub?.armorProficiencies?.forEach((a) =>
    trackSource(tracker, a, speciesLabel(data))
  );

  const featId = data.featureChoices?.variantHumanFeat;
  if (featId) {
    const feat = getFeat(featId);
    const featLabel = feat ? `Feat (${feat.name})` : "Feat";
    if (featId === "lightly-armored") trackSource(tracker, "light armor", featLabel);
    if (featId === "moderately-armored") {
      trackSource(tracker, "medium armor", featLabel);
      trackSource(tracker, "shield", featLabel);
    }
    if (featId === "heavily-armored") trackSource(tracker, "heavy armor", featLabel);
  }

  cls?.armorProficiencies?.forEach((a) => trackSource(tracker, a, classLabel));

  return entriesFromTracker(
    tracker,
    getEffectiveArmorProficiencies(data, classes)
  );
}

export function getToolProficienciesWithSources(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): ProficiencyEntry[] {
  const { backgrounds, classes } = resolveCatalogs(catalogs);
  const tracker: SourceTracker = new Map();
  const background = findBackgroundByName(data.basicInfo.background, backgrounds);
  const bgLabel = background?.name
    ? `Background (${background.name})`
    : "Background";
  const cls = resolveCharacterClass(data, classes);
  const classLabel = cls?.name ? `Class (${cls.name})` : "Class";

  if (background) {
    const state = creatorStateFromCharacter(data, background);
    resolveBackgroundToolProficiencies(state, {
      backgrounds,
    } as CreatorCatalog).forEach((t) => trackSource(tracker, t, bgLabel));
  }

  if (data.speciesChoices?.speciesToolChoice) {
    trackSource(
      tracker,
      data.speciesChoices.speciesToolChoice,
      speciesLabel(data)
    );
  }

  cls?.toolProficiencies?.forEach((t) => trackSource(tracker, t, classLabel));

  return entriesFromTracker(
    tracker,
    getEffectiveToolProficiencies(data, catalogs)
  );
}

export function formatProficiencySources(sources: string[]): string {
  if (sources.length === 0) return "";
  if (sources.length === 1) return sources[0];
  return sources.join("\n");
}
