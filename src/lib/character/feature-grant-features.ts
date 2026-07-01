import type { CharacterData, SkillKey } from "@/lib/schemas/character";
import type { BackgroundChoices } from "@/lib/schemas/character";
import {
  buildChoiceDescription,
  choicePlaceholder,
  resolveFeatureCatalogs,
  type ChoiceOption,
  type ConfigurableGrantedFeature,
  type FeatureCatalogs,
  type FeatureSource,
} from "@/lib/character/feature-choices";
import {
  findBackgroundByName,
  findSpeciesByDisplayName,
  findSubclassByName,
} from "@/lib/content/catalog-tooltip";
import type { PhbBackground, PhbSpecies } from "@/lib/dnd/phb/types";
import { SKILL_LABELS } from "@/lib/dnd/calculations";
import { getSpell } from "@/lib/dnd/phb/spells";
import { KNOWLEDGE_DOMAIN_SKILL_OPTIONS } from "@/lib/dnd/phb/cleric-domain-grants";
import {
  defaultLanguageLookup,
  resolveLanguageName,
} from "@/lib/languages/resolve";

export type GrantEditorKind =
  | "select"
  | "skills"
  | "skill"
  | "skill-or-tool"
  | "weapons"
  | "tool"
  | "cantrip"
  | "magic-initiate"
  | "tool-pick"
  | "tool-multi"
  | "humanoid-species"
  | "languages";

export interface GrantEditorConfig {
  kind: GrantEditorKind;
  /** Where the choice lives on CharacterData. */
  storage:
    | { area: "featureChoices"; key: string }
    | { area: "speciesChoices"; key: string }
    | { area: "backgroundChoices"; key: string };
  max?: number;
  skillOptions?: SkillKey[];
  spellListId?: string;
  toolPickOptions?: Array<
    | Exclude<BackgroundChoices["backgroundToolPick"], "">
    | BackgroundChoices["backgroundToolMulti"][number]
  >;
  weaponChoiceFilter?: PhbSpecies["weaponChoices"];
}

type BackgroundToolMultiOption = BackgroundChoices["backgroundToolMulti"][number];

export interface GrantConfigurableFeature extends ConfigurableGrantedFeature {
  grantEditor: GrantEditorConfig;
}

function resolveCatalogs(catalogs: FeatureCatalogs = {}) {
  return resolveFeatureCatalogs(catalogs);
}

function makeGrantFeature(
  source: FeatureSource,
  name: string,
  rulesDescription: string,
  displayDescription: string,
  choiceKey: ConfigurableGrantedFeature["choiceKey"],
  choiceValue: string,
  choiceOptions: ChoiceOption[],
  grantEditor: GrantEditorConfig
): GrantConfigurableFeature {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `grant:${source}:${slug}`,
    name,
    description: displayDescription,
    restReset: "none",
    source,
    locked: false,
    choiceKey,
    choiceValue,
    choiceOptions,
    grantEditor,
  };
}

function summarizeSkills(skills: SkillKey[], rules: string): string {
  if (!skills.length) return rules;
  return buildChoiceDescription(rules, skills.join(", "));
}

/** Configurable features tied to species/background/feats that grant spells, skills, or proficiencies. */
export function deriveGrantConfigurableFeatures(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): GrantConfigurableFeature[] {
  const { species: speciesList, backgrounds, classes } = resolveCatalogs(catalogs);
  const features: GrantConfigurableFeature[] = [];
  const speciesMatch = findSpeciesByDisplayName(data.basicInfo.species, speciesList);
  const species = speciesMatch?.species;
  const subspecies = speciesMatch?.subspecies;
  const background = findBackgroundByName(data.basicInfo.background, backgrounds);
  const speciesChoices = data.speciesChoices ?? {};
  const backgroundChoices = data.backgroundChoices ?? {};
  const featureChoices = data.featureChoices ?? {};

  if (species?.skillChoices && !species.skillOrToolChoice) {
    const rules =
      species.skillChoices.prompt ??
      `Choose ${species.skillChoices.count} skill proficiency${species.skillChoices.count === 1 ? "" : "ies"}.`;
    const featureName =
      species.id === "half-elf"
        ? "Skill Versatility"
        : (species.skillChoices.prompt ?? "Skill Choices");
    features.push(
      makeGrantFeature(
        "species",
        featureName,
        rules,
        summarizeSkills(speciesChoices.speciesSkillChoices, rules),
        "fightingStyle",
        "",
        [],
        {
          kind: "skills",
          storage: { area: "speciesChoices", key: "speciesSkillChoices" },
          max: species.skillChoices.count,
          skillOptions: species.skillChoices.options,
        }
      )
    );
  }

  if (species?.skillOrToolChoice) {
    const rules =
      species.skillOrToolChoice.prompt ?? "Choose one skill or one tool.";
    features.push(
      makeGrantFeature(
        "species",
        species.skillOrToolChoice.prompt ?? "Skill or Tool",
        rules,
        speciesChoices.speciesSkillOrTool === "tool"
          ? buildChoiceDescription(rules, speciesChoices.speciesToolChoice || null)
          : summarizeSkills(speciesChoices.speciesSkillChoices, rules),
        "fightingStyle",
        speciesChoices.speciesSkillOrTool,
        [
          { value: "skill", label: "Skill" },
          { value: "tool", label: "Tool" },
        ],
        {
          kind: "skill-or-tool",
          storage: { area: "speciesChoices", key: "speciesSkillOrTool" },
        }
      )
    );
  }

  if (species?.weaponChoices) {
    const rules =
      species.weaponChoices.prompt ??
      `Choose ${species.weaponChoices.count} weapon proficiencies.`;
    features.push(
      makeGrantFeature(
        "species",
        "Martial Training",
        rules,
        buildChoiceDescription(
          rules,
          speciesChoices.speciesWeaponChoices.length
            ? speciesChoices.speciesWeaponChoices.join(", ")
            : null
        ),
        "fightingStyle",
        "",
        [],
        {
          kind: "weapons",
          storage: { area: "speciesChoices", key: "speciesWeaponChoices" },
          max: species.weaponChoices.count,
          weaponChoiceFilter: species.weaponChoices,
        }
      )
    );
  }

  if (species?.id === "elf" && subspecies?.id === "high") {
    const rules =
      "Cantrip: You know one wizard cantrip (Intelligence is your spellcasting ability).";
    features.push(
      makeGrantFeature(
        "species",
        "High Elf Cantrip",
        rules,
        buildChoiceDescription(rules, speciesChoices.speciesCantripId || null),
        "fightingStyle",
        speciesChoices.speciesCantripId,
        [],
        {
          kind: "cantrip",
          storage: { area: "speciesChoices", key: "speciesCantripId" },
          spellListId: "wizard",
        }
      )
    );
  }

  if (species?.id === "human" && subspecies?.id === "variant") {
    const rules = "One skill proficiency of your choice.";
    features.push(
      makeGrantFeature(
        "species",
        "Variant Human Skill",
        rules,
        buildChoiceDescription(rules, speciesChoices.variantHumanSkill || null),
        "fightingStyle",
        speciesChoices.variantHumanSkill,
        [],
        {
          kind: "skill",
          storage: { area: "speciesChoices", key: "variantHumanSkill" },
        }
      )
    );
  }

  if (background?.skillChoices) {
    const rules =
      background.skillChoices.prompt ??
      `Choose ${background.skillChoices.count} skill proficiency${background.skillChoices.count === 1 ? "" : "ies"}.`;
    features.push(
      makeGrantFeature(
        "background",
        background.skillChoices.prompt ?? "Background Skills",
        rules,
        summarizeSkills(backgroundChoices.backgroundSkillChoices, rules),
        "fightingStyle",
        "",
        [],
        {
          kind: "skills",
          storage: { area: "backgroundChoices", key: "backgroundSkillChoices" },
          max: background.skillChoices.count,
          skillOptions: background.skillChoices.options,
        }
      )
    );
  }

  if (background?.toolPick) {
    const rules = background.toolPick.prompt ?? "Choose a tool proficiency.";
    features.push(
      makeGrantFeature(
        "background",
        "Tool Proficiency",
        rules,
        buildChoiceDescription(rules, backgroundChoices.backgroundToolPick || null),
        "fightingStyle",
        backgroundChoices.backgroundToolPick,
        background.toolPick.options.map((o) => ({ value: o, label: o })),
        {
          kind: "tool-pick",
          storage: { area: "backgroundChoices", key: "backgroundToolPick" },
          toolPickOptions: background.toolPick.options,
        }
      )
    );
  }

  if (background?.toolMultiPick) {
    const rules =
      background.toolMultiPick.prompt ??
      `Choose ${background.toolMultiPick.count} tool proficiencies.`;
    features.push(
      makeGrantFeature(
        "background",
        "Tool Proficiencies",
        rules,
        buildChoiceDescription(
          rules,
          backgroundChoices.backgroundToolMulti.length
            ? backgroundChoices.backgroundToolMulti.join(", ")
            : null
        ),
        "fightingStyle",
        "",
        background.toolMultiPick.options.map((o) => ({ value: o, label: o })),
        {
          kind: "tool-multi",
          storage: { area: "backgroundChoices", key: "backgroundToolMulti" },
          max: background.toolMultiPick.count,
          toolPickOptions: background.toolMultiPick.options,
        }
      )
    );
  }

  if (featureChoices.variantHumanFeat === "magic-initiate") {
    const feat = getFeat("magic-initiate");
    const rules =
      feat?.description ??
      "Learn two cantrips and one 1st-level spell from cleric, druid, or wizard list.";
    features.push(
      makeGrantFeature(
        "species",
        "Magic Initiate",
        rules,
        rules,
        "variantHumanFeat",
        featureChoices.magicInitiateClass,
        [
          { value: "cleric", label: "Cleric" },
          { value: "druid", label: "Druid" },
          { value: "wizard", label: "Wizard" },
        ],
        { kind: "magic-initiate", storage: { area: "featureChoices", key: "magicInitiateClass" } }
      )
    );
  }

  const subclassMatch = findSubclassByName(
    data.basicInfo.class ?? "",
    data.basicInfo.subclass ?? "",
    classes
  );
  if (
    subclassMatch?.cls.id === "druid" &&
    (subclassMatch.subclass.id === "nature" || subclassMatch.subclass.id === "land")
  ) {
    const isNature = subclassMatch.subclass.id === "nature";
    const rules = isNature
      ? "You learn one druid cantrip of your choice."
      : "You learn one additional druid cantrip of your choice.";
    const cantripSelection = featureChoices.bonusDruidCantripId
      ? getSpell(featureChoices.bonusDruidCantripId)?.name ??
        featureChoices.bonusDruidCantripId
      : null;
    features.push(
      makeGrantFeature(
        "subclass",
        isNature ? "Acolyte of Nature Cantrip" : "Bonus Cantrip",
        rules,
        buildChoiceDescription(rules, cantripSelection),
        "fightingStyle",
        featureChoices.bonusDruidCantripId,
        [],
        {
          kind: "cantrip",
          storage: { area: "featureChoices", key: "bonusDruidCantripId" },
          spellListId: "druid",
        }
      )
    );
  }

  if (
    subclassMatch?.cls.id === "cleric" &&
    subclassMatch.subclass.id === "nature"
  ) {
    const cantripRules = "You learn one druid cantrip of your choice.";
    const cantripSelection = featureChoices.bonusDruidCantripId
      ? getSpell(featureChoices.bonusDruidCantripId)?.name ??
        featureChoices.bonusDruidCantripId
      : null;
    features.push(
      makeGrantFeature(
        "subclass",
        "Acolyte of Nature — Cantrip",
        cantripRules,
        buildChoiceDescription(cantripRules, cantripSelection),
        "fightingStyle",
        featureChoices.bonusDruidCantripId,
        [],
        {
          kind: "cantrip",
          storage: { area: "featureChoices", key: "bonusDruidCantripId" },
          spellListId: "druid",
        }
      )
    );

    const skillRules =
      "You gain proficiency in one of Animal Handling, Nature, or Survival.";
    const skill = featureChoices.acolyteOfNatureSkill ?? "";
    features.push(
      makeGrantFeature(
        "subclass",
        "Acolyte of Nature — Skill",
        skillRules,
        buildChoiceDescription(
          skillRules,
          skill ? SKILL_LABELS[skill as SkillKey] : null
        ),
        "fightingStyle",
        skill,
        [],
        {
          kind: "skill",
          storage: { area: "featureChoices", key: "acolyteOfNatureSkill" },
          skillOptions: ["animalHandling", "nature", "survival"],
        }
      )
    );
  }

  if (
    subclassMatch?.cls.id === "cleric" &&
    subclassMatch.subclass.id === "knowledge"
  ) {
    const languageRules = "You learn two languages of your choice.";
    const lookup = defaultLanguageLookup();
    const languageNames = (featureChoices.knowledgeDomainLanguages ?? []).map((slug) =>
      resolveLanguageName(slug, lookup)
    );
    features.push(
      makeGrantFeature(
        "subclass",
        "Blessings of Knowledge — Languages",
        languageRules,
        buildChoiceDescription(
          languageRules,
          languageNames.length ? languageNames.join(", ") : null
        ),
        "fightingStyle",
        "",
        [],
        {
          kind: "languages",
          storage: { area: "featureChoices", key: "knowledgeDomainLanguages" },
          max: 2,
        }
      )
    );

    const skillRules =
      "You gain proficiency in two of Arcana, History, Nature, or Religion.";
    const knowledgeSkills = featureChoices.knowledgeDomainSkills ?? [];
    features.push(
      makeGrantFeature(
        "subclass",
        "Blessings of Knowledge — Skills",
        skillRules,
        summarizeSkills(knowledgeSkills, skillRules),
        "fightingStyle",
        "",
        [],
        {
          kind: "skills",
          storage: { area: "featureChoices", key: "knowledgeDomainSkills" },
          max: 2,
          skillOptions: [...KNOWLEDGE_DOMAIN_SKILL_OPTIONS],
        }
      )
    );
  }

  void choicePlaceholder;
  return features;
}

import { getFeat } from "@/lib/dnd/phb/feats";

export function isGrantConfigurableFeature(
  feature: { locked?: boolean; grantEditor?: GrantEditorConfig }
): feature is GrantConfigurableFeature {
  return feature.locked === false && !!(feature as GrantConfigurableFeature).grantEditor;
}

export function isReplacedByGrantFeature(
  locked: { name: string; source: FeatureSource },
  grantFeatures: GrantConfigurableFeature[]
): boolean {
  const replacements: Record<string, string[]> = {
    "Martial Training": ["Martial Training"],
    "Decadent Mastery": ["Decadent Mastery", "Skill or Tool"],
    "Skill Versatility": ["Skill Versatility", "Changeling Instincts (two skills)"],
    "Acolyte of Nature": ["Acolyte of Nature — Cantrip", "Acolyte of Nature — Skill"],
    "Blessings of Knowledge": [
      "Blessings of Knowledge — Languages",
      "Blessings of Knowledge — Skills",
    ],
  };
  const names = replacements[locked.name] ?? [locked.name];
  return grantFeatures.some(
    (g) => g.source === locked.source && names.some((n) => g.name.includes(n) || n.includes(g.name))
  );
}
