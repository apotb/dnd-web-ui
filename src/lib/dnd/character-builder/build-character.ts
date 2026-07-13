import type {
  AbilityKey,
  AbilityScoreBreakdown,
  CharacterData,
  CharacterExport,
  SkillKey,
} from "@/lib/schemas/character";
import { abilityModifier, proficiencyBonus } from "@/lib/dnd/calculations";
import { getBackground } from "@/lib/dnd/phb/backgrounds";
import {
  classRequiresSubclassAtLevel1,
  getClass,
} from "@/lib/dnd/phb/classes";
import { expandEquipmentItems } from "@/lib/dnd/phb/equipment";
import { getFeat } from "@/lib/dnd/phb/feats";
import { TWO_HUMANOID_SPECIES_OPTION } from "@/lib/dnd/phb/favored-enemy-humanoids";
import { isValidPointBuy } from "@/lib/dnd/phb/point-buy";
import { getSpecies, getSpeciesDisplayName } from "@/lib/dnd/phb/species";
import {
  getSpeciesAcBonus,
  getSpeciesArmorProficiencies,
  getSpeciesSpeed,
  getSpeciesWeaponProficiencies,
  usesLizardfolkNaturalArmor,
  usesTortleNaturalArmor,
} from "@/lib/dnd/phb/species-mechanics";
import { getSpell } from "@/lib/dnd/phb/spells";
import { classHasSpellcastingAtLevel } from "@/lib/dnd/spellcasting";
import type { CreatorCatalog } from "@/lib/content/catalog";
import { resolveSpeciesDisplayName } from "@/lib/dnd/species-display";
import {
  buildLanguageLookup,
  collectLanguageNames,
} from "@/lib/languages/resolve";
import type { CharacterCreatorState } from "./types";
import { syncFeatureGrants } from "@/lib/character/feature-grant-sync";

// ── Catalog-aware lookup helpers ──────────────────────────────────────────────
// Each falls back to the static PHB TypeScript data when no catalog is provided.

function resolveSpecies(id: string, catalog?: CreatorCatalog) {
  return (catalog?.species ?? []).find((r) => r.id === id) ?? getSpecies(id);
}

function resolveClass(id: string, catalog?: CreatorCatalog) {
  return (catalog?.classes ?? []).find((c) => c.id === id) ?? getClass(id);
}

function resolveBackground(id: string, catalog?: CreatorCatalog) {
  return (catalog?.backgrounds ?? []).find((b) => b.id === id) ?? getBackground(id);
}

function resolveFeat(id: string, catalog?: CreatorCatalog) {
  return (catalog?.feats ?? []).find((f) => f.id === id) ?? getFeat(id);
}

function resolveSpell(id: string, catalog?: CreatorCatalog) {
  return (catalog?.spells ?? []).find((s) => s.id === id) ?? getSpell(id);
}

const ARMOR_AC: Record<string, { base: number; maxDex?: number; stealthDisadvantage?: boolean }> = {
  "padded armor": { base: 11, maxDex: 999, stealthDisadvantage: true },
  "leather armor": { base: 11, maxDex: 999 },
  "studded leather armor": { base: 12, maxDex: 999 },
  "hide armor": { base: 12, maxDex: 2 },
  "chain shirt": { base: 13, maxDex: 2 },
  "scale mail": { base: 14, maxDex: 2, stealthDisadvantage: true },
  "breastplate": { base: 14, maxDex: 2 },
  "half plate": { base: 15, maxDex: 2, stealthDisadvantage: true },
  "ring mail": { base: 14, maxDex: 0, stealthDisadvantage: true },
  "chain mail": { base: 16, maxDex: 0, stealthDisadvantage: true },
  "splint armor": { base: 17, maxDex: 0, stealthDisadvantage: true },
  "plate armor": { base: 18, maxDex: 0, stealthDisadvantage: true },
};

function emptyBonuses(): Record<
  AbilityKey,
  { total: number; sources: { label: string; value: number }[] }
> {
  return {
    str: { total: 0, sources: [] },
    dex: { total: 0, sources: [] },
    con: { total: 0, sources: [] },
    int: { total: 0, sources: [] },
    wis: { total: 0, sources: [] },
    cha: { total: 0, sources: [] },
  };
}

function addBonus(
  bonuses: ReturnType<typeof emptyBonuses>,
  key: AbilityKey,
  value: number,
  label: string
) {
  bonuses[key].total += value;
  bonuses[key].sources.push({ label, value });
}

export function computeRacialBonuses(state: CharacterCreatorState, catalog?: CreatorCatalog) {
  const bonuses = emptyBonuses();
  const species = resolveSpecies(state.speciesId, catalog);
  if (!species) return bonuses;

  const label = resolveSpeciesDisplayName(state.speciesId, state.subspeciesId, catalog);

  if (species.id === "human" && state.subspeciesId === "variant") {
    for (const key of state.variantHumanAbilityBonuses) {
      addBonus(bonuses, key, 1, "Variant Human");
    }
    return bonuses;
  }

  if (species.abilityBonus.kind === "half-elf") {
    addBonus(bonuses, "cha", 2, "Half-Elf");
    for (const key of state.halfElfAbilityBonuses) {
      addBonus(bonuses, key, 1, "Half-Elf");
    }
    return bonuses;
  }

  if (species.abilityBonus.kind === "fixed") {
    const merged: Partial<Record<AbilityKey, number>> = {
      ...species.abilityBonus.bonuses,
    };
    const sub = species.subspecies?.find((s) => s.id === state.subspeciesId);
    if (sub?.abilityBonus) {
      for (const [key, value] of Object.entries(sub.abilityBonus)) {
        const k = key as AbilityKey;
        merged[k] = (merged[k] ?? 0) + value;
      }
    }
    for (const [key, value] of Object.entries(merged)) {
      if (value) addBonus(bonuses, key as AbilityKey, value, label);
    }
  }

  return bonuses;
}

export function computeFinalScores(state: CharacterCreatorState, catalog?: CreatorCatalog) {
  const racial = computeRacialBonuses(state, catalog);
  const scores = { ...state.baseScores };
  const breakdown: AbilityScoreBreakdown = {} as AbilityScoreBreakdown;

  for (const key of Object.keys(scores) as AbilityKey[]) {
    const racialTotal = racial[key].total;
    scores[key] = state.baseScores[key] + racialTotal;
    breakdown[key] = {
      base: state.baseScores[key],
      racial: racialTotal,
      other: 0,
      sources: [
        { label: "Base", value: state.baseScores[key] },
        ...racial[key].sources,
      ],
    };
  }

  return { scores, breakdown };
}

export function collectSkillProficiencies(state: CharacterCreatorState, catalog?: CreatorCatalog): Set<SkillKey> {
  const skills = new Set<SkillKey>();
  const species = resolveSpecies(state.speciesId, catalog);
  const background = resolveBackground(state.backgroundId, catalog);

  species?.skillProficiencies?.forEach((s) => skills.add(s));
  background?.skillProficiencies.forEach((s) => skills.add(s));
  state.backgroundSkillChoices.forEach((s) => skills.add(s));
  state.classSkills.forEach((s) => skills.add(s));
  state.speciesSkillChoices.forEach((s) => skills.add(s));

  if (state.speciesId === "human" && state.subspeciesId === "variant" && state.variantHumanSkill) {
    skills.add(state.variantHumanSkill);
  }

  return skills;
}

/** Skills granted before class skill picks (for filtering the class skills menu). */
export function getClassSkillExclusions(state: CharacterCreatorState, catalog?: CreatorCatalog): SkillKey[] {
  const skills = collectSkillProficiencies(state, catalog);
  state.classSkills.forEach((s) => skills.delete(s));
  return [...skills];
}

function collectLanguages(state: CharacterCreatorState, catalog?: CreatorCatalog): string[] {
  const lookup = buildLanguageLookup(
    (catalog?.languages ?? []).map((l) => ({
      ...l,
      id: l.id || l.slug,
    }))
  );
  const inputs: string[] = [];
  const species = resolveSpecies(state.speciesId, catalog);
  const background = resolveBackground(state.backgroundId, catalog);

  species?.languages.forEach((l) => inputs.push(l));
  species?.fixedLanguages?.forEach((l) => inputs.push(l));
  background?.fixedLanguages?.forEach((l) => inputs.push(l));
  state.speciesLanguageChoices.forEach((l) => inputs.push(l));
  state.backgroundLanguageChoices.forEach((l) => inputs.push(l));

  return collectLanguageNames(inputs, lookup);
}

/** Resolve background tool placeholders (e.g. artisan's tools) to the player's specific picks. */
export function resolveBackgroundToolProficiencies(
  state: CharacterCreatorState,
  catalog?: CreatorCatalog
): string[] {
  const tools = new Set<string>();
  const background = resolveBackground(state.backgroundId, catalog);

  background?.toolProficiencies?.forEach((t) => {
    if (t === "artisan's tools") {
      tools.add(state.backgroundArtisanTool || "artisan's tools");
    } else if (t === "gaming set") {
      tools.add(state.backgroundGamingSet || "gaming set");
    } else if (t === "musical instrument") {
      tools.add(state.backgroundMusicalInstrument || "musical instrument");
    } else if (
      t === "cartographer's tools or navigator's tools" &&
      state.backgroundExplorerTool
    ) {
      tools.add(state.backgroundExplorerTool);
    } else if (
      t === "vehicles (land)" ||
      t === "vehicles (water)" ||
      t === "thieves' tools" ||
      t === "herbalism kit" ||
      t === "disguise kit" ||
      t === "forgery kit" ||
      t === "navigator's tools"
    ) {
      tools.add(t);
    } else if (!t.includes(" or ")) {
      tools.add(t);
    }
  });

  if (background?.toolPick && state.backgroundToolPick) {
    if (state.backgroundToolPick === "gaming set") {
      tools.add(state.backgroundGamingSet || "gaming set");
    } else if (state.backgroundToolPick === "artisan's tools") {
      tools.add(state.backgroundArtisanTool || "artisan's tools");
    } else if (state.backgroundToolPick === "musical instrument") {
      tools.add(state.backgroundMusicalInstrument || "musical instrument");
    }
  }

  if (background?.toolMultiPick) {
    for (const pick of state.backgroundToolMulti) {
      if (pick === "thieves' tools") tools.add("thieves' tools");
      if (pick === "gaming set") {
        tools.add(state.backgroundGamingSet || "gaming set");
      }
      if (pick === "musical instrument") {
        tools.add(state.backgroundMusicalInstrument || "musical instrument");
      }
    }
  }

  return [...tools];
}

/** Replace generic background equipment placeholders with specific player choices. */
export function resolveBackgroundEquipmentItem(
  itemName: string,
  state: CharacterCreatorState
): string {
  const key = itemName.toLowerCase().trim();
  if (key === "artisan's tools" || key === "artisans tools") {
    return state.backgroundArtisanTool || itemName;
  }
  if (key === "musical instrument") {
    return state.backgroundMusicalInstrument || itemName;
  }
  if (key === "gaming set") {
    return state.backgroundGamingSet || itemName;
  }
  return itemName;
}

export function resolveBackgroundEquipment(
  state: CharacterCreatorState,
  catalog?: CreatorCatalog
): string[] {
  const background = resolveBackground(state.backgroundId, catalog);
  if (!background) return [];
  return background.equipment.map((item) =>
    resolveBackgroundEquipmentItem(item, state)
  );
}

function collectTools(state: CharacterCreatorState, catalog?: CreatorCatalog): string[] {
  const tools = new Set(resolveBackgroundToolProficiencies(state, catalog));
  const cls = resolveClass(state.classId, catalog);

  cls?.toolProficiencies?.forEach((t) => tools.add(t));
  if (state.monkTool) tools.add(state.monkTool);
  if (state.speciesToolChoice) tools.add(state.speciesToolChoice);

  return [...tools];
}

function collectWeaponProficiencies(
  state: CharacterCreatorState,
  catalog?: CreatorCatalog
): string[] {
  const profs = new Set(getSpeciesWeaponProficiencies(state));
  const cls = resolveClass(state.classId, catalog);
  cls?.weaponProficiencies?.forEach((p) => profs.add(p));
  return [...profs];
}

function collectArmorProficiencies(
  state: CharacterCreatorState,
  catalog?: CreatorCatalog
): string[] {
  const profs = new Set(getSpeciesArmorProficiencies(state));
  const cls = resolveClass(state.classId, catalog);
  cls?.armorProficiencies?.forEach((p) => profs.add(p));
  return [...profs];
}

function resolveEquipmentNames(state: CharacterCreatorState, catalog?: CreatorCatalog): string[] {
  const names: string[] = [];
  const cls = resolveClass(state.classId, catalog);
  const background = resolveBackground(state.backgroundId, catalog);
  const sub = state.equipmentSubChoices ?? {};

  if (background) {
    names.push(...resolveBackgroundEquipment(state, catalog));
  }

  if (cls) {
    cls.fixedEquipment.forEach((itemName, idx) => {
      names.push(sub[`f${idx}`] ?? itemName);
    });
    cls.equipmentChoices.forEach((choice, groupIdx) => {
      const optionIndex = state.equipmentChoiceIndices[groupIdx] ?? 0;
      const option = choice.options[optionIndex];
      if (option) {
        option.items.forEach((itemName, itemIdx) => {
          names.push(sub[`c${groupIdx}_${itemIdx}`] ?? itemName);
        });
      }
    });
  }

  return names;
}

function calculateAc(
  state: CharacterCreatorState,
  classId: string,
  scores: CharacterData["abilityScores"],
  itemNames: string[]
): number {
  const dexMod = abilityModifier(scores.dex);
  const conMod = abilityModifier(scores.con);
  const wisMod = abilityModifier(scores.wis);

  let bestArmor: (typeof ARMOR_AC)[string] | null = null;
  let hasShield = false;

  for (const raw of itemNames) {
    const name = raw.toLowerCase();
    if (name === "shield" || name.includes("shield")) hasShield = true;
    const armor = ARMOR_AC[name];
    if (armor && (!bestArmor || armor.base > bestArmor.base)) {
      bestArmor = armor;
    }
  }

  let ac: number;
  if (bestArmor) {
    const dexBonus =
      bestArmor.maxDex === undefined
        ? dexMod
        : Math.min(dexMod, bestArmor.maxDex);
    ac = bestArmor.base + dexBonus + (hasShield ? 2 : 0);
  } else if (usesLizardfolkNaturalArmor(state, false)) {
    ac = 13 + dexMod + (hasShield ? 2 : 0);
  } else if (usesTortleNaturalArmor(state, false)) {
    ac = 17 + (hasShield ? 2 : 0);
  } else if (classId === "barbarian") {
    ac = 10 + dexMod + conMod + (hasShield ? 2 : 0);
  } else if (classId === "monk") {
    ac = 10 + dexMod + wisMod;
  } else {
    ac = 10 + dexMod + (hasShield ? 2 : 0);
  }

  return ac + getSpeciesAcBonus(state);
}

function buildSpells(state: CharacterCreatorState, scores: CharacterData["abilityScores"], catalog?: CreatorCatalog) {
  const cls = resolveClass(state.classId, catalog);
  if (!cls?.spellcasting) {
    return {
      spellcastingHidden: false,
      spellcastingAbility: undefined,
      known: [],
      prepared: [],
      slots: {},
      grantUses: {},
    };
  }

  const ability = cls.spellcasting.ability;
  const cantrips = state.cantripIds
    .map((id) => resolveSpell(id, catalog))
    .filter(Boolean)
    .map((s) => ({
      id: crypto.randomUUID(),
      spellId: s!.id,
      name: s!.name,
      level: 0,
      prepared: true,
      notes: s!.school,
    }));

  const level1 = state.spellIds
    .map((id) => resolveSpell(id, catalog))
    .filter(Boolean)
    .map((s) => ({
      id: crypto.randomUUID(),
      spellId: s!.id,
      name: s!.name,
      level: 1,
      prepared: true,
      notes: s!.school,
    }));

  const spellbook = state.wizardSpellbookIds
    .map((id) => resolveSpell(id, catalog))
    .filter(Boolean)
    .map((s) => ({
      id: crypto.randomUUID(),
      spellId: s!.id,
      name: s!.name,
      level: 1,
      prepared: state.spellIds.includes(s!.id),
      notes: `Spellbook · ${s!.school}`,
    }));

  const slots: CharacterData["spells"]["slots"] = {};
  if (state.classId === "warlock") {
    slots["1"] = { max: 1, used: 0 };
  } else {
    slots["1"] = { max: 2, used: 0 };
  }

  if (cls.spellcasting.preparedCaster) {
    const known =
      state.classId === "wizard" ? [...cantrips, ...spellbook] : [...cantrips, ...level1];
    return {
      spellcastingHidden: false,
      spellcastingAbility: ability,
      known,
      prepared: known.filter((s) => s.prepared),
      slots,
      grantUses: {},
    };
  }

  return {
    spellcastingHidden: false,
    spellcastingAbility: ability,
    known: [...cantrips, ...level1],
    prepared: [],
    slots,
    grantUses: {},
  };
}

export function buildCharacterExport(state: CharacterCreatorState, catalog?: CreatorCatalog): CharacterExport {
  const species = resolveSpecies(state.speciesId, catalog);
  const background = resolveBackground(state.backgroundId, catalog);
  const cls = resolveClass(state.classId, catalog);
  const { scores, breakdown } = computeFinalScores(state, catalog);
  const conMod = abilityModifier(scores.con);
  const prof = proficiencyBonus(1);

  const itemNames = resolveEquipmentNames(state, catalog);
  const expanded = expandEquipmentItems(itemNames);

  let gp = background?.gold ?? 0;

  const speed = getSpeciesSpeed(state);

  let maxHp = (cls?.hitDie ?? 8) + conMod;
  if (state.speciesId === "dwarf" && state.subspeciesId === "hill") {
    maxHp += 1;
  }

  const ac = calculateAc(state, state.classId, scores, itemNames);

  const skillSet = collectSkillProficiencies(state, catalog);
  const skills: CharacterData["skills"] = {};
  for (const key of Object.keys(skillSet) as SkillKey[]) {
    skills[key] = { proficient: true, expertise: false };
  }

  const savingThrows: CharacterData["savingThrows"] = {};
  cls?.savingThrows.forEach((key) => {
    savingThrows[key] = { proficient: true };
  });

  const subclass = cls?.subclasses.find((s) => s.id === state.subclassId);

  let mainWeaponAssigned = false;

  const data: CharacterData = {
    basicInfo: {
      name: state.name,
      playerName: state.playerName,
      level: 1,
      xp: 0,
      classes: cls ? [cls.name] : [],
      class: cls?.name,
      subclass: subclass?.name ?? "",
      species: resolveSpeciesDisplayName(state.speciesId, state.subspeciesId, catalog),
      background: background?.name ?? "",
      alignment: state.alignment,
      portrait: "",
      publicNotes: "",
      dmNotes: "",
    },
    abilityScores: scores,
    abilityScoreBreakdown: breakdown,
    inspiration: 0,
    savingThrows,
    skills,
    languages: collectLanguages(state, catalog),
    speciesLanguageChoices: state.speciesLanguageChoices,
    backgroundLanguageChoices: state.backgroundLanguageChoices,
    toolProficiencies: collectTools(state, catalog),
    weaponProficiencies: collectWeaponProficiencies(state, catalog),
    armorProficiencies: collectArmorProficiencies(state, catalog),
    combat: {
      ac,
      maxHp,
      currentHp: maxHp,
      tempHp: 0,
      initiativeBonus: 0,
      pendingInitiativeRoll: null,
      pendingShortRest: false,
      speed,
      hitDice: `1d${cls?.hitDie ?? 8}`,
      levelUpHpGains: [],
      hpGainsDieOnly: true,
      hitDiceSpent: 0,
      lastLongRestDate: null,
      deathSaves: { successes: 0, failures: 0 },
      conditions: [],
      exhaustion: 0,
      concentration: { active: false, spell: "" },
    },
    attacks: [],
    customActions: [],
    spells: buildSpells(state, scores, catalog),
    inventory: {
      currency: { cp: 0, sp: 0, ep: 0, gp, pp: 0 },
      items: expanded.map((item) => {
        const slug = item.name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-");
        const lower = item.name.toLowerCase();
        const isArmor = lower.includes("armor") || lower.includes("armour");
        const isShield = lower === "shield" || lower.endsWith(" shield");
        const isWeapon =
          !isArmor &&
          !isShield &&
          [
            "axe",
            "sword",
            "bow",
            "crossbow",
            "dagger",
            "mace",
            "staff",
            "spear",
            "hammer",
            "club",
            "sling",
            "dart",
            "javelin",
            "whip",
            "lance",
          ].some((w) => lower.includes(w));
        const wieldMain = isWeapon && !mainWeaponAssigned;
        if (wieldMain) mainWeaponAssigned = true;
        const naturalArmor =
          usesLizardfolkNaturalArmor(state, false) ||
          usesTortleNaturalArmor(state, false);
        return {
          id: crypto.randomUUID(),
          itemId: slug || undefined,
          name: item.name,
          quantity: item.quantity,
          weightLb: item.weightLb,
          equipped: (!naturalArmor && isArmor) || isShield,
          wieldMain,
          wieldOff: false,
          attuned: false,
          magicItem: false,
          notes: "",
          loadedQuantity: 0,
        };
      }),
      notes: "",
    },
    supplies: {
      fedDate: null,
      wateredDate: null,
      daysWithoutFood: 0,
      waterGallonsToday: 0,
      pendingDehydrationSave: null,
    },
    exhaustionLevels: [],
    featureChoices: {
      fightingStyle: state.fightingStyle,
      favoredEnemy: state.favoredEnemy,
      favoredHumanoidSpecies: state.favoredHumanoidSpecies,
      favoredTerrain: state.favoredTerrain,
      favoredEnemyPicks: state.favoredEnemy
        ? [
            {
              enemy: state.favoredEnemy,
              humanoidSpecies: state.favoredHumanoidSpecies,
            },
          ]
        : [],
      favoredTerrains: state.favoredTerrain ? [state.favoredTerrain] : [],
      variantHumanFeat: state.variantHumanFeat,
      magicInitiateClass: "",
      magicInitiateCantripIds: [],
      magicInitiateSpellId: "",
      bonusDruidCantripId: state.bonusDruidCantripId,
      acolyteOfNatureSkill: state.acolyteOfNatureSkill,
      knowledgeDomainLanguages: state.knowledgeDomainLanguages,
      knowledgeDomainSkills: state.knowledgeDomainSkills,
    },
    speciesChoices: {
      halfElfAbilityBonuses: state.halfElfAbilityBonuses,
      speciesSkillChoices: state.speciesSkillChoices,
      speciesWeaponChoices: state.speciesWeaponChoices,
      speciesToolChoice: state.speciesToolChoice,
      speciesSkillOrTool: state.speciesSkillOrTool,
      variantHumanAbilityBonuses: state.variantHumanAbilityBonuses,
      variantHumanSkill: state.variantHumanSkill,
      speciesCantripId: "",
    },
    backgroundChoices: {
      backgroundSkillChoices: state.backgroundSkillChoices,
      backgroundToolPick: state.backgroundToolPick,
      backgroundToolMulti: state.backgroundToolMulti,
      backgroundArtisanTool: state.backgroundArtisanTool,
      backgroundGamingSet: state.backgroundGamingSet,
      backgroundMusicalInstrument: state.backgroundMusicalInstrument,
      backgroundExplorerTool: state.backgroundExplorerTool,
    },
    classSkillChoices: state.classSkills,
    features: [],
    featureUseState: {},
    levelUpFeats: {},
    dmGrantedFeats: [],
  };

  const syncedData = syncFeatureGrants(data, {
    species: catalog?.species,
    classes: catalog?.classes,
    backgrounds: catalog?.backgrounds,
  });

  return {
    version: 1,
    name: state.name,
    playerName: state.playerName,
    data: syncedData,
  };
}

export function validateCreatorState(state: CharacterCreatorState, catalog?: CreatorCatalog): string[] {
  const errors: string[] = [];

  if (!state.name.trim()) errors.push("Character name is required.");
  if (!state.alignment) errors.push("Alignment is required.");
  if (!state.speciesId) errors.push("Species is required.");
  if (!state.backgroundId) errors.push("Background is required.");

  const background = resolveBackground(state.backgroundId, catalog);
  if (background?.skillChoices) {
    if (state.backgroundSkillChoices.length !== background.skillChoices.count) {
      errors.push(
        `${background.name} requires ${background.skillChoices.count} skill choice(s).`
      );
    }
  }
  if (background?.toolPick && !state.backgroundToolPick) {
    errors.push(`${background.name} requires a tool choice.`);
  }
  if (background?.toolPick?.options.includes("gaming set") && state.backgroundToolPick === "gaming set" && !state.backgroundGamingSet) {
    errors.push(`${background.name} requires a gaming set choice.`);
  }
  if (background?.toolPick?.options.includes("artisan's tools") && state.backgroundToolPick === "artisan's tools" && !state.backgroundArtisanTool) {
    errors.push(`${background.name} requires an artisan's tool choice.`);
  }
  if (background?.toolPick?.options.includes("musical instrument") && state.backgroundToolPick === "musical instrument" && !state.backgroundMusicalInstrument) {
    errors.push(`${background.name} requires a musical instrument choice.`);
  }
  if (background?.toolMultiPick) {
    if (state.backgroundToolMulti.length !== background.toolMultiPick.count) {
      errors.push(
        `${background.name} requires ${background.toolMultiPick.count} tool choices.`
      );
    }
    if (state.backgroundToolMulti.includes("gaming set") && !state.backgroundGamingSet) {
      errors.push(`${background.name} requires a gaming set choice.`);
    }
    if (state.backgroundToolMulti.includes("musical instrument") && !state.backgroundMusicalInstrument) {
      errors.push(`${background.name} requires a musical instrument choice.`);
    }
  }
  if (background?.toolProficiencies?.includes("gaming set") && !state.backgroundGamingSet) {
    errors.push(`${background.name} requires a gaming set choice.`);
  }

  const species = resolveSpecies(state.speciesId, catalog);
  if (species?.subspecies?.length && !state.subspeciesId) {
    errors.push("Subspecies is required.");
  }

  if (species?.id === "half-elf") {
    if (state.halfElfAbilityBonuses.length !== 2) {
      errors.push("Half-Elf requires two +1 ability score choices.");
    }
  }

  if (species?.skillChoices && !species.skillOrToolChoice) {
    if (state.speciesSkillChoices.length !== species.skillChoices.count) {
      errors.push(
        `${species.name} requires ${species.skillChoices.count} skill choice(s).`
      );
    }
  }

  if (species?.skillOrToolChoice) {
    if (!state.speciesSkillOrTool) {
      errors.push(`${species.name} requires a skill or tool choice.`);
    } else if (state.speciesSkillOrTool === "skill" && state.speciesSkillChoices.length !== 1) {
      errors.push(`${species.name} requires one skill choice.`);
    } else if (state.speciesSkillOrTool === "tool" && !state.speciesToolChoice) {
      errors.push(`${species.name} requires one tool choice.`);
    }
  }

  if (species?.weaponChoices) {
    if (state.speciesWeaponChoices.length !== species.weaponChoices.count) {
      errors.push(
        `${species.name} requires ${species.weaponChoices.count} weapon choice(s).`
      );
    }
  }

  if (species?.id === "human" && state.subspeciesId === "variant") {
    if (state.variantHumanAbilityBonuses.length !== 2) {
      errors.push("Variant Human requires two +1 ability score choices.");
    }
    if (!state.variantHumanSkill) errors.push("Variant Human requires a skill.");
    if (!state.variantHumanFeat) errors.push("Variant Human requires a feat.");
  }

  if (!state.classId) errors.push("Class is required.");

  const cls = resolveClass(state.classId, catalog);
  if (cls && classRequiresSubclassAtLevel1(state.classId) && !state.subclassId) {
    errors.push("Subclass is required at 1st level for this class.");
  }

  if (state.classId === "fighter" && !state.fightingStyle) {
    errors.push("Fighting style is required.");
  }
  if (state.classId === "ranger") {
    if (!state.favoredEnemy) errors.push("Favored enemy is required.");
    if (
      state.favoredEnemy === TWO_HUMANOID_SPECIES_OPTION &&
      state.favoredHumanoidSpecies.length !== 2
    ) {
      errors.push("Choose exactly two humanoid species for favored enemy.");
    }
    if (!state.favoredTerrain) errors.push("Favored terrain is required.");
  }

  if (state.classId === "cleric" && state.subclassId === "nature") {
    if (!state.bonusDruidCantripId) {
      errors.push("Nature Domain requires a druid cantrip (Acolyte of Nature).");
    }
    if (!state.acolyteOfNatureSkill) {
      errors.push("Nature Domain requires a skill proficiency (Acolyte of Nature).");
    }
  }

  if (state.classId === "cleric" && state.subclassId === "knowledge") {
    if (state.knowledgeDomainLanguages.length !== 2) {
      errors.push("Knowledge Domain requires two bonus languages.");
    }
    if (state.knowledgeDomainSkills.length !== 2) {
      errors.push("Knowledge Domain requires two skill proficiencies.");
    }
  }

  if (!isValidPointBuy(state.baseScores)) {
    errors.push("Ability scores must use exactly 27 point-buy points (scores 8–15 before racial bonuses).");
  }

  if (cls && state.classSkills.length !== cls.skillChoiceCount) {
    errors.push(`Choose ${cls.skillChoiceCount} class skill(s).`);
  }

  if (cls?.spellcasting && classHasSpellcastingAtLevel(cls, 1)) {
    const sc = cls.spellcasting;
    if (state.cantripIds.length !== sc.cantripsKnown) {
      errors.push(`Choose ${sc.cantripsKnown} cantrip(s).`);
    }
    if (sc.spellsKnown && state.spellIds.length !== sc.spellsKnown) {
      errors.push(`Choose ${sc.spellsKnown} 1st-level spell(s).`);
    }
    if (sc.spellbookAtLevel1 && state.wizardSpellbookIds.length !== sc.spellbookAtLevel1) {
      errors.push(`Add ${sc.spellbookAtLevel1} spells to your spellbook.`);
    }
    if (sc.preparedCaster && !sc.spellbookAtLevel1) {
      const ability = sc.ability;
      const mod = abilityModifier(state.baseScores[ability] + (computeRacialBonuses(state)[ability].total));
      const required = Math.max(1, mod + 1);
      if (state.spellIds.length !== required) {
        errors.push(`Prepare ${required} 1st-level spell(s) (Wis/Int mod + level).`);
      }
    }
    if (sc.spellbookAtLevel1) {
      const mod = abilityModifier(state.baseScores.int + (computeRacialBonuses(state).int.total));
      const required = Math.max(1, mod + 1);
      if (state.spellIds.length !== required) {
        errors.push(`Prepare ${required} spell(s) from your spellbook.`);
      }
    }
  }

  return errors;
}
