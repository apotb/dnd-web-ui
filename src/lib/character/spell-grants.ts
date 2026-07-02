import { hasMagicInitiateFeat } from "@/lib/character/character-feats";
import type { CharacterData, SpeciesChoices } from "@/lib/schemas/character";
import type { FeatureCatalogs, FeatureSource } from "@/lib/character/feature-choices";
import { resolveFeatureCatalogs } from "@/lib/character/feature-choices";
import {
  findSpeciesByDisplayName,
  findSubclassByName,
} from "@/lib/content/catalog-tooltip";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import { CLERIC_DOMAIN_SPELLS } from "@/lib/dnd/phb/cleric-domain-spells";
import { getSpell } from "@/lib/dnd/phb/spells";
import type { PhbSpecies } from "@/lib/dnd/phb/types";
import { getCharacterLevel } from "@/lib/dnd/xp";

/**
 * Level 5+ racial spells not yet granted in spell-grants.ts (add when needed):
 * crown-of-madness, flame-blade, searing-smite, branding-smite, arcane-lock,
 * pass-without-trace, shape-water, wall-of-water.
 */

export type SpellGrantSource = FeatureSource | "feat";

export interface SpellGrantUsage {
  max: number;
  restReset: "short" | "long";
}

export interface SpellGrantSpec {
  grantKey: string;
  spellId: string;
  level: number;
  source: SpellGrantSource;
  sourceLabel?: string;
  minCharacterLevel?: number;
  notes?: string;
  usage?: SpellGrantUsage;
}

const LONG_REST_USAGE: SpellGrantUsage = { max: 1, restReset: "long" };
const SHORT_REST_USAGE: SpellGrantUsage = { max: 1, restReset: "short" };

function speciesGrant(
  grantKey: string,
  spellId: string,
  level: number,
  options: {
    sourceLabel?: string;
    minCharacterLevel?: number;
    notes?: string;
    usage?: SpellGrantUsage;
  } = {}
): SpellGrantSpec {
  return {
    grantKey,
    spellId,
    level,
    source: "species",
    ...options,
  };
}

function subclassGrant(
  grantKey: string,
  spellId: string,
  level: number,
  options: {
    sourceLabel?: string;
    minCharacterLevel?: number;
    notes?: string;
    usage?: SpellGrantUsage;
  } = {}
): SpellGrantSpec {
  return {
    grantKey,
    spellId,
    level,
    source: "subclass",
    ...options,
  };
}

function featGrant(
  grantKey: string,
  spellId: string,
  level: number,
  options: {
    sourceLabel?: string;
    notes?: string;
    usage?: SpellGrantUsage;
  } = {}
): SpellGrantSpec {
  return {
    grantKey,
    spellId,
    level,
    source: "feat",
    ...options,
  };
}

/** Fixed racial spells keyed by `speciesId` or `speciesId:subspeciesId`. */
export const FIXED_SPECIES_SPELL_GRANTS: Record<string, SpellGrantSpec[]> = {
  "elf:drow": [
    speciesGrant("grant:species:drow-magic", "dancing-lights", 0, {
      sourceLabel: "Drow Magic",
    }),
  ],
  "gnome:forest": [
    speciesGrant("grant:species:natural-illusionist", "minor-illusion", 0, {
      sourceLabel: "Natural Illusionist",
    }),
  ],
  aasimar: [
    speciesGrant("grant:species:light-bearer", "light", 0, {
      sourceLabel: "Light Bearer",
    }),
  ],
  githyanki: [
    speciesGrant("grant:species:githyanki-psionics", "mage-hand", 0, {
      sourceLabel: "Githyanki Psionics",
    }),
  ],
  githzerai: [
    speciesGrant("grant:species:githzerai-psionics", "mage-hand", 0, {
      sourceLabel: "Githzerai Psionics",
    }),
  ],
  "genasi:air": [
    speciesGrant("grant:species:air-genasi", "shocking-grasp", 0, {
      sourceLabel: "Mingle with the Wind",
    }),
  ],
  "genasi:earth": [
    speciesGrant("grant:species:earth-genasi", "blade-ward", 0, {
      sourceLabel: "Merge with Stone",
    }),
  ],
  "genasi:fire": [
    speciesGrant("grant:species:fire-genasi", "produce-flame", 0, {
      sourceLabel: "Reach to the Blaze",
    }),
  ],
  firbolg: [
    speciesGrant("grant:species:firbolg-magic:detect-magic", "detect-magic", 1, {
      sourceLabel: "Firbolg Magic",
      usage: SHORT_REST_USAGE,
    }),
    speciesGrant("grant:species:firbolg-magic:disguise-self", "disguise-self", 1, {
      sourceLabel: "Firbolg Magic",
      usage: SHORT_REST_USAGE,
    }),
  ],
  "yuan-ti-pureblood": [
    speciesGrant("grant:species:yuan-ti-innate", "poison-spray", 0, {
      sourceLabel: "Innate Spellcasting",
    }),
  ],
  triton: [
    speciesGrant("grant:species:triton-control-air-water", "fog-cloud", 1, {
      sourceLabel: "Control Air and Water",
      usage: LONG_REST_USAGE,
    }),
  ],
};

/** Tiefling subspecies share thaumaturgy at 1st level. */
export const TIEFLING_CANTrip_GRANT: SpellGrantSpec = speciesGrant(
  "grant:species:infernal-legacy",
  "thaumaturgy",
  0,
  { sourceLabel: "Infernal Legacy" }
);

/** Level 3+ Infernal Legacy spells per tiefling subspecies. */
export const TIEFLING_LEGACY_L3_GRANTS: Record<string, SpellGrantSpec> = {
  asmodeus: speciesGrant("grant:species:infernal-legacy-l3", "hellish-rebuke", 1, {
    sourceLabel: "Infernal Legacy (Asmodeus)",
    minCharacterLevel: 3,
    usage: LONG_REST_USAGE,
  }),
  baalzebul: speciesGrant("grant:species:infernal-legacy-l3", "ray-of-sickness", 1, {
    sourceLabel: "Infernal Legacy (Baalzebul)",
    minCharacterLevel: 3,
    usage: LONG_REST_USAGE,
  }),
  dispater: speciesGrant("grant:species:infernal-legacy-l3", "disguise-self", 1, {
    sourceLabel: "Infernal Legacy (Dispater)",
    minCharacterLevel: 3,
    usage: LONG_REST_USAGE,
  }),
  fierna: speciesGrant("grant:species:infernal-legacy-l3", "friends", 0, {
    sourceLabel: "Infernal Legacy (Fierna)",
    minCharacterLevel: 3,
    usage: LONG_REST_USAGE,
  }),
  glasya: speciesGrant("grant:species:infernal-legacy-l3", "minor-illusion", 0, {
    sourceLabel: "Infernal Legacy (Glasya)",
    minCharacterLevel: 3,
    usage: LONG_REST_USAGE,
  }),
  levistus: speciesGrant("grant:species:infernal-legacy-l3", "armor-of-agathys", 1, {
    sourceLabel: "Infernal Legacy (Levistus)",
    minCharacterLevel: 3,
    usage: LONG_REST_USAGE,
  }),
  mammon: speciesGrant("grant:species:infernal-legacy-l3", "tensers-floating-disk", 1, {
    sourceLabel: "Infernal Legacy (Mammon)",
    minCharacterLevel: 3,
    usage: LONG_REST_USAGE,
  }),
  mephistopheles: speciesGrant("grant:species:infernal-legacy-l3", "burning-hands", 1, {
    sourceLabel: "Infernal Legacy (Mephistopheles)",
    minCharacterLevel: 3,
    usage: LONG_REST_USAGE,
  }),
};

/** Level 3+ psionic spells for gith. */
export const GITH_PSIONICS_L3_GRANTS: Record<string, SpellGrantSpec> = {
  githyanki: speciesGrant("grant:species:gith-psionics-l3", "jump", 1, {
    sourceLabel: "Githyanki Psionics",
    minCharacterLevel: 3,
    usage: LONG_REST_USAGE,
  }),
  githzerai: speciesGrant("grant:species:gith-psionics-l3", "shield", 1, {
    sourceLabel: "Githzerai Psionics",
    minCharacterLevel: 3,
    usage: LONG_REST_USAGE,
  }),
};

/** Level 3+ yuan-ti innate spell. */
export const YUAN_TI_L3_GRANT: SpellGrantSpec = speciesGrant(
  "grant:species:yuan-ti-innate-l3",
  "animal-friendship",
  1,
  {
    sourceLabel: "Innate Spellcasting",
    minCharacterLevel: 3,
    usage: LONG_REST_USAGE,
  }
);

/** Fixed subclass spell grants keyed by `classId:subclassId`. */
export const FIXED_SUBCLASS_SPELL_GRANTS: Record<string, SpellGrantSpec[]> = {
  "cleric:light": [
    subclassGrant("grant:subclass:light-domain-cantrip", "light", 0, {
      sourceLabel: "Light Domain",
    }),
  ],
};

function resolveCatalogs(catalogs: FeatureCatalogs = {}) {
  return resolveFeatureCatalogs(catalogs);
}

function speciesKey(speciesId: string, subspeciesId?: string): string {
  return subspeciesId ? `${speciesId}:${subspeciesId}` : speciesId;
}

function isSpellInCatalog(spellId: string): boolean {
  return !!getSpell(spellId);
}

function filterByLevel(
  grants: SpellGrantSpec[],
  characterLevel: number
): SpellGrantSpec[] {
  return grants.filter((g) => {
    const min = g.minCharacterLevel ?? 1;
    return characterLevel >= min && isSpellInCatalog(g.spellId);
  });
}

function resolveFixedSpeciesSpells(
  species: PhbSpecies,
  subspeciesId?: string
): SpellGrantSpec[] {
  const grants: SpellGrantSpec[] = [];
  const key = speciesKey(species.id, subspeciesId);
  if (FIXED_SPECIES_SPELL_GRANTS[key]) grants.push(...FIXED_SPECIES_SPELL_GRANTS[key]);
  if (subspeciesId && FIXED_SPECIES_SPELL_GRANTS[species.id]) {
    grants.push(...FIXED_SPECIES_SPELL_GRANTS[species.id]);
  }
  if (species.id === "tiefling") grants.push(TIEFLING_CANTrip_GRANT);
  if (species.id === "tiefling" && subspeciesId && TIEFLING_LEGACY_L3_GRANTS[subspeciesId]) {
    grants.push(TIEFLING_LEGACY_L3_GRANTS[subspeciesId]);
  }
  if (GITH_PSIONICS_L3_GRANTS[species.id]) {
    grants.push(GITH_PSIONICS_L3_GRANTS[species.id]);
  }
  if (species.id === "yuan-ti-pureblood") {
    grants.push(YUAN_TI_L3_GRANT);
  }
  return grants;
}

function resolvePickableSpeciesCantrip(
  species: PhbSpecies,
  subspeciesId: string | undefined,
  speciesChoices: SpeciesChoices
): SpellGrantSpec | null {
  if (species.id === "elf" && subspeciesId === "high" && speciesChoices.speciesCantripId) {
    if (!isSpellInCatalog(speciesChoices.speciesCantripId)) return null;
    return speciesGrant(
      "grant:species:high-elf-cantrip",
      speciesChoices.speciesCantripId,
      0,
      { sourceLabel: "High Elf Cantrip" }
    );
  }
  return null;
}

function resolveSubclassSpells(
  data: CharacterData,
  catalogs: FeatureCatalogs
): SpellGrantSpec[] {
  const { classes } = resolveCatalogs(catalogs);
  const grants: SpellGrantSpec[] = [];
  const match = findSubclassByName(
    data.basicInfo.class ?? "",
    data.basicInfo.subclass ?? "",
    classes
  );
  if (!match) return grants;

  const subclassKey = `${match.cls.id}:${match.subclass.id}`;
  if (FIXED_SUBCLASS_SPELL_GRANTS[subclassKey]) {
    grants.push(...FIXED_SUBCLASS_SPELL_GRANTS[subclassKey]);
  }

  const bonusCantripId = data.featureChoices?.bonusDruidCantripId;
  if (
    match.cls.id === "druid" &&
    (match.subclass.id === "nature" || match.subclass.id === "land") &&
    bonusCantripId &&
    isSpellInCatalog(bonusCantripId)
  ) {
    grants.push(
      subclassGrant("grant:subclass:bonus-druid-cantrip", bonusCantripId, 0, {
        sourceLabel:
          match.subclass.id === "nature"
            ? "Nature Domain"
            : "Circle of the Land",
      })
    );
  }

  if (
    match.cls.id === "cleric" &&
    match.subclass.id === "nature" &&
    bonusCantripId &&
    isSpellInCatalog(bonusCantripId)
  ) {
    grants.push(
      subclassGrant("grant:subclass:acolyte-of-nature-cantrip", bonusCantripId, 0, {
        sourceLabel: "Acolyte of Nature",
      })
    );
  }

  if (match.cls.id === "cleric") {
    const domainSpells = CLERIC_DOMAIN_SPELLS[match.subclass.id];
    const domainLabel = `${match.subclass.name}`;
    if (domainSpells) {
      for (const entry of domainSpells) {
        const catalog = getSpell(entry.spellId);
        if (!catalog) continue;
        grants.push(
          subclassGrant(
            `grant:subclass:domain-spell:${match.subclass.id}:${entry.spellId}`,
            entry.spellId,
            catalog.level,
            {
              sourceLabel: domainLabel,
              minCharacterLevel: entry.minCharacterLevel,
            }
          )
        );
      }
    }
  }

  return grants;
}

function resolveMagicInitiateSpells(
  data: CharacterData
): SpellGrantSpec[] {
  if (!hasMagicInitiateFeat(data)) return [];
  const featureChoices = data.featureChoices ?? {};
  const listId = featureChoices.magicInitiateClass;
  if (!listId) return [];

  const grants: SpellGrantSpec[] = [];
  featureChoices.magicInitiateCantripIds?.forEach((spellId, index) => {
    if (!spellId || !isSpellInCatalog(spellId)) return;
    grants.push(
      featGrant(`grant:feat:magic-initiate:cantrip:${index}`, spellId, 0, {
        sourceLabel: "Magic Initiate",
        notes: `Magic Initiate (${listId})`,
      })
    );
  });

  if (
    featureChoices.magicInitiateSpellId &&
    isSpellInCatalog(featureChoices.magicInitiateSpellId)
  ) {
    grants.push(
      featGrant(
        "grant:feat:magic-initiate:spell",
        featureChoices.magicInitiateSpellId,
        1,
        {
          sourceLabel: "Magic Initiate",
          notes: `Magic Initiate (${listId})`,
          usage: LONG_REST_USAGE,
        }
      )
    );
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
  const characterLevel = getCharacterLevel(data);
  const grants: SpellGrantSpec[] = [];

  if (species) {
    grants.push(...resolveFixedSpeciesSpells(species, subspeciesId));
    const pick = resolvePickableSpeciesCantrip(species, subspeciesId, speciesChoices);
    if (pick) grants.push(pick);
  }

  grants.push(...resolveSubclassSpells(data, catalogs));
  grants.push(...resolveMagicInitiateSpells(data));

  return filterByLevel(grants, characterLevel);
}
