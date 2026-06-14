import type {
  BackgroundChoices,
  CharacterData,
  SkillKey,
  SpeciesChoices,
  Spell,
} from "@/lib/schemas/character";
import { resolveCharacterClass } from "@/lib/character/class-derivation";
import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import {
  findBackgroundByName,
  findSpeciesByDisplayName,
} from "@/lib/content/catalog-tooltip";
import { getFeat } from "@/lib/dnd/phb/feats";
import { PHB_BACKGROUNDS } from "@/lib/dnd/phb/backgrounds";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import { PHB_SPECIES } from "@/lib/dnd/phb/species";
import { getSpell } from "@/lib/dnd/phb/spells";
import type { PhbBackground, PhbSpecies } from "@/lib/dnd/phb/types";
import {
  resolveBackgroundToolProficiencies,
} from "@/lib/dnd/character-builder/build-character";
import type { CharacterCreatorState } from "@/lib/dnd/character-builder/types";

export const MANAGED_SPELL_GRANT_PREFIX = "grant:";

interface SpellGrantSpec {
  grantKey: string;
  spellId: string;
  level: number;
  notes?: string;
}

export interface SkillGrantSpec {
  grantKey: string;
  skills: SkillKey[];
  source: string;
}

function speciesLabel(data: CharacterData): string {
  const name = data.basicInfo.species.trim() || "Unknown";
  return `Species (${name})`;
}

interface WeaponGrantSpec {
  grantKey: string;
  weapons: string[];
}

interface ToolGrantSpec {
  grantKey: string;
  tools: string[];
}

/** Fixed racial spells keyed by `speciesId` or `speciesId:subspeciesId`. */
const FIXED_SPECIES_SPELLS: Record<string, SpellGrantSpec[]> = {
  "elf:drow": [
    { grantKey: "grant:species:drow-magic", spellId: "dancing-lights", level: 0 },
  ],
  "gnome:forest": [
    { grantKey: "grant:species:natural-illusionist", spellId: "minor-illusion", level: 0 },
  ],
  aasimar: [{ grantKey: "grant:species:light-bearer", spellId: "light", level: 0 }],
  githyanki: [{ grantKey: "grant:species:githyanki-psionics", spellId: "mage-hand", level: 0 }],
  githzerai: [{ grantKey: "grant:species:githzerai-psionics", spellId: "mage-hand", level: 0 }],
};

/** Tiefling subspecies share thaumaturgy at 1st level. */
const TIEFLING_CANTrip: SpellGrantSpec = {
  grantKey: "grant:species:infernal-legacy",
  spellId: "thaumaturgy",
  level: 0,
};

function resolveCatalogs(catalogs: FeatureCatalogs = {}) {
  return {
    species: catalogs.species?.length ? catalogs.species : PHB_SPECIES,
    classes: catalogs.classes?.length ? catalogs.classes : PHB_CLASSES,
    backgrounds: catalogs.backgrounds?.length ? catalogs.backgrounds : PHB_BACKGROUNDS,
  };
}

function speciesKey(speciesId: string, subspeciesId?: string): string {
  return subspeciesId ? `${speciesId}:${subspeciesId}` : speciesId;
}

function spellEntryFromGrant(spec: SpellGrantSpec, existing?: Spell): Spell {
  const catalog = getSpell(spec.spellId);
  return {
    id: existing?.id ?? crypto.randomUUID(),
    spellId: spec.spellId,
    name: catalog?.name ?? spec.spellId,
    level: spec.level,
    prepared: existing?.prepared ?? true,
    notes: spec.notes ?? catalog?.school ?? "",
    grantKey: spec.grantKey,
  };
}

function resolveFixedSpeciesSpells(
  species: PhbSpecies,
  subspeciesId?: string
): SpellGrantSpec[] {
  const grants: SpellGrantSpec[] = [];
  const key = speciesKey(species.id, subspeciesId);
  if (FIXED_SPECIES_SPELLS[key]) grants.push(...FIXED_SPECIES_SPELLS[key]);
  if (FIXED_SPECIES_SPELLS[species.id]) grants.push(...FIXED_SPECIES_SPELLS[species.id]);
  if (species.id === "tiefling") grants.push(TIEFLING_CANTrip);
  return grants;
}

function resolvePickableSpeciesCantrip(
  species: PhbSpecies,
  subspeciesId: string | undefined,
  speciesChoices: SpeciesChoices
): SpellGrantSpec | null {
  if (species.id === "elf" && subspeciesId === "high" && speciesChoices.speciesCantripId) {
    return {
      grantKey: "grant:species:high-elf-cantrip",
      spellId: speciesChoices.speciesCantripId,
      level: 0,
      notes: "High Elf cantrip",
    };
  }
  return null;
}

function resolveMagicInitiateSpells(
  featureChoices: CharacterData["featureChoices"]
): SpellGrantSpec[] {
  if (featureChoices.variantHumanFeat !== "magic-initiate") return [];
  const listId = featureChoices.magicInitiateClass;
  if (!listId) return [];

  const grants: SpellGrantSpec[] = [];
  featureChoices.magicInitiateCantripIds?.forEach((spellId, index) => {
    if (!spellId) return;
    grants.push({
      grantKey: `grant:feat:magic-initiate:cantrip:${index}`,
      spellId,
      level: 0,
      notes: `Magic Initiate (${listId})`,
    });
  });

  if (featureChoices.magicInitiateSpellId) {
    grants.push({
      grantKey: "grant:feat:magic-initiate:spell",
      spellId: featureChoices.magicInitiateSpellId,
      level: 1,
      notes: `Magic Initiate (${listId}) · 1/long rest`,
    });
  }

  return grants;
}

export function resolveAllSpellGrants(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): SpellGrantSpec[] {
  const { species: speciesList } = resolveCatalogs(catalogs);
  const match = findSpeciesByDisplayName(data.basicInfo.species, speciesList);
  const species = match?.species;
  const subspeciesId = match?.subspecies?.id;
  const speciesChoices = data.speciesChoices ?? {};
  const grants: SpellGrantSpec[] = [];

  if (species) {
    grants.push(...resolveFixedSpeciesSpells(species, subspeciesId));
    const pick = resolvePickableSpeciesCantrip(species, subspeciesId, speciesChoices);
    if (pick) grants.push(pick);
  }

  grants.push(...resolveMagicInitiateSpells(data.featureChoices ?? {}));
  return grants;
}

function mergeGrantSpells(known: Spell[], grants: SpellGrantSpec[]): Spell[] {
  const managed = known.filter(
    (s) => !s.grantKey?.startsWith(MANAGED_SPELL_GRANT_PREFIX)
  );
  const byGrantKey = new Map(
    known
      .filter((s) => s.grantKey?.startsWith(MANAGED_SPELL_GRANT_PREFIX))
      .map((s) => [s.grantKey!, s] as const)
  );

  const grantSpells = grants.map((spec) =>
    spellEntryFromGrant(spec, byGrantKey.get(spec.grantKey))
  );

  return [...managed, ...grantSpells];
}

function resolveSpeciesSkillGrants(
  species: PhbSpecies,
  speciesChoices: SpeciesChoices,
  source: string
): SkillGrantSpec[] {
  const grants: SkillGrantSpec[] = [];

  if (species.skillProficiencies?.length) {
    grants.push({
      grantKey: "grant:species:skill-proficiencies",
      skills: species.skillProficiencies,
      source,
    });
  }

  if (species.skillChoices && !species.skillOrToolChoice && speciesChoices.speciesSkillChoices?.length) {
    grants.push({
      grantKey: "grant:species:skill-choices",
      skills: speciesChoices.speciesSkillChoices,
      source,
    });
  }

  if (species.skillOrToolChoice && speciesChoices.speciesSkillOrTool === "skill" && speciesChoices.speciesSkillChoices?.length) {
    grants.push({
      grantKey: "grant:species:skill-or-tool",
      skills: speciesChoices.speciesSkillChoices,
      source,
    });
  }

  if (species.id === "human" && speciesChoices.variantHumanSkill) {
    grants.push({
      grantKey: "grant:species:variant-human-skill",
      skills: [speciesChoices.variantHumanSkill],
      source,
    });
  }

  return grants;
}

function resolveBackgroundSkillGrants(
  background: PhbBackground,
  backgroundChoices: BackgroundChoices,
  source: string
): SkillGrantSpec[] {
  const grants: SkillGrantSpec[] = [];

  if (background.skillProficiencies.length) {
    grants.push({
      grantKey: "grant:background:skill-proficiencies",
      skills: background.skillProficiencies,
      source,
    });
  }

  if (background.skillChoices && backgroundChoices.backgroundSkillChoices?.length) {
    grants.push({
      grantKey: "grant:background:skill-choices",
      skills: backgroundChoices.backgroundSkillChoices,
      source,
    });
  }

  return grants;
}

/** All skill proficiencies granted by species, background, and class features. */
export function resolveAllSkillGrants(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): SkillGrantSpec[] {
  const { species: speciesList, backgrounds, classes } = resolveCatalogs(catalogs);
  const speciesMatch = findSpeciesByDisplayName(data.basicInfo.species, speciesList);
  const background = findBackgroundByName(data.basicInfo.background, backgrounds);
  const cls = resolveCharacterClass(data, classes);
  const grants: SkillGrantSpec[] = [];

  if (speciesMatch?.species) {
    grants.push(
      ...resolveSpeciesSkillGrants(
        speciesMatch.species,
        data.speciesChoices ?? {},
        speciesLabel(data)
      )
    );
  }

  if (background) {
    const bgLabel = background.name
      ? `Background (${background.name})`
      : "Background";
    grants.push(
      ...resolveBackgroundSkillGrants(
        background,
        data.backgroundChoices ?? {},
        bgLabel
      )
    );
  }

  const classLabel = cls?.name ? `Class (${cls.name})` : "Class";
  if (data.classSkillChoices?.length) {
    grants.push({
      grantKey: "grant:class:skills",
      skills: data.classSkillChoices,
      source: classLabel,
    });
  }

  return grants;
}

function applySkillGrants(
  data: CharacterData,
  catalogs: FeatureCatalogs
): CharacterData {
  const grants = resolveAllSkillGrants(data, catalogs);
  const skills = { ...data.skills };
  const grantedSkillKeys: Partial<Record<SkillKey, string>> = {
    ...(data.grantedSkillKeys ?? {}),
  };

  const grantedSkills = new Set<SkillKey>();
  for (const grant of grants) {
    for (const skill of grant.skills) grantedSkills.add(skill);
  }

  for (const [skill, grantKey] of Object.entries(grantedSkillKeys) as [SkillKey, string][]) {
    if (!grantKey.startsWith(MANAGED_SPELL_GRANT_PREFIX)) continue;
    if (!grantedSkills.has(skill)) {
      delete grantedSkillKeys[skill];
      if (skills[skill]?.proficient && !skills[skill]?.expertise) {
        delete skills[skill];
      }
    }
  }

  for (const grant of grants) {
    for (const skill of grant.skills) {
      grantedSkillKeys[skill] = grant.grantKey;
      skills[skill] = {
        proficient: true,
        expertise: skills[skill]?.expertise ?? false,
      };
    }
  }

  return {
    ...data,
    skills,
    grantedSkillKeys:
      Object.keys(grantedSkillKeys).length > 0 ? grantedSkillKeys : undefined,
  };
}

function resolveStoredWeaponProficiencies(
  data: CharacterData,
  catalogs: FeatureCatalogs
): string[] {
  const { species: speciesList } = resolveCatalogs(catalogs);
  const speciesMatch = findSpeciesByDisplayName(data.basicInfo.species, speciesList);
  const species = speciesMatch?.species;
  const sub = speciesMatch?.subspecies;
  const speciesChoices = data.speciesChoices ?? {};

  const weapons = new Set<string>();
  species?.weaponProficiencies?.forEach((w) => weapons.add(w));
  sub?.weaponProficiencies?.forEach((w) => weapons.add(w));
  (speciesChoices.speciesWeaponChoices ?? []).forEach((w) => weapons.add(w));

  return [...weapons];
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

function resolveStoredToolProficiencies(
  data: CharacterData,
  catalogs: FeatureCatalogs
): string[] {
  const { backgrounds } = resolveCatalogs(catalogs);
  const background = findBackgroundByName(data.basicInfo.background, backgrounds) ?? undefined;
  const cls = resolveCharacterClass(data, catalogs.classes);
  const state = creatorStateFromCharacter(data, background);
  const tools = new Set(
    resolveBackgroundToolProficiencies(state, {
      backgrounds,
    } as import("@/lib/content/catalog").CreatorCatalog)
  );

  if (data.speciesChoices?.speciesToolChoice) {
    tools.add(data.speciesChoices.speciesToolChoice);
  }
  cls?.toolProficiencies?.forEach((t) => tools.add(t));

  return [...tools];
}

/** Derived tool proficiencies from background choices, species, and class. */
export function getEffectiveToolProficiencies(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): string[] {
  return resolveStoredToolProficiencies(data, catalogs);
}

function resolveFeatArmorGrants(data: CharacterData): string[] {
  const featId = data.featureChoices?.variantHumanFeat;
  if (!featId) return [];
  const armor: string[] = [];
  if (featId === "lightly-armored") armor.push("light armor");
  if (featId === "moderately-armored") armor.push("medium armor", "shield");
  if (featId === "heavily-armored") armor.push("heavy armor");
  return armor;
}

function resolveStoredArmorProficiencies(
  data: CharacterData,
  catalogs: FeatureCatalogs
): string[] {
  const { species: speciesList } = resolveCatalogs(catalogs);
  const speciesMatch = findSpeciesByDisplayName(data.basicInfo.species, speciesList);
  const species = speciesMatch?.species;
  const sub = speciesMatch?.subspecies;
  const armor = new Set<string>();

  species?.armorProficiencies?.forEach((a) => armor.add(a));
  sub?.armorProficiencies?.forEach((a) => armor.add(a));
  resolveFeatArmorGrants(data).forEach((a) => armor.add(a));

  const cls = resolveCharacterClass(data, catalogs.classes);
  cls?.armorProficiencies?.forEach((a) => armor.add(a));

  return [...armor];
}

/** Recompute granted spells, skills, and stored proficiencies from feature choices. */
export function syncFeatureGrants(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): CharacterData {
  const spellGrants = resolveAllSpellGrants(data, catalogs);
  const known = mergeGrantSpells(data.spells.known, spellGrants);
  const prepared = mergeGrantSpells(data.spells.prepared, spellGrants.filter((g) => g.level === 0 || g.grantKey.includes("magic-initiate")));

  let next: CharacterData = {
    ...data,
    spells: { ...data.spells, known, prepared },
    weaponProficiencies: resolveStoredWeaponProficiencies(data, catalogs),
    toolProficiencies: resolveStoredToolProficiencies(data, catalogs),
    armorProficiencies: resolveStoredArmorProficiencies(data, catalogs),
  };

  next = applySkillGrants(next, catalogs);
  return next;
}

/** Clear Magic Initiate sub-choices when feat changes away from Magic Initiate. */
export function clearMagicInitiateChoices(
  featureChoices: CharacterData["featureChoices"]
): CharacterData["featureChoices"] {
  if (featureChoices.variantHumanFeat === "magic-initiate") return featureChoices;
  return {
    ...featureChoices,
    magicInitiateClass: "",
    magicInitiateCantripIds: [],
    magicInitiateSpellId: "",
  };
}
