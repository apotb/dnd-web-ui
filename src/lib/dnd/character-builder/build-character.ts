import type {
  AbilityKey,
  AbilityScoreBreakdown,
  CharacterData,
  CharacterExport,
  Feature,
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
import { isValidPointBuy } from "@/lib/dnd/phb/point-buy";
import { getRace, getRaceDisplayName } from "@/lib/dnd/phb/races";
import { getSpell } from "@/lib/dnd/phb/spells";
import type { CharacterCreatorState } from "./types";

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

export function computeRacialBonuses(state: CharacterCreatorState) {
  const bonuses = emptyBonuses();
  const race = getRace(state.raceId);
  if (!race) return bonuses;

  const label = getRaceDisplayName(state.raceId, state.subraceId);

  if (race.id === "human" && state.subraceId === "variant") {
    for (const key of state.variantHumanAbilityBonuses) {
      addBonus(bonuses, key, 1, "Variant Human");
    }
    return bonuses;
  }

  if (race.abilityBonus.kind === "half-elf") {
    addBonus(bonuses, "cha", 2, "Half-Elf");
    for (const key of state.halfElfAbilityBonuses) {
      addBonus(bonuses, key, 1, "Half-Elf");
    }
    return bonuses;
  }

  if (race.abilityBonus.kind === "fixed") {
    const merged: Partial<Record<AbilityKey, number>> = {
      ...race.abilityBonus.bonuses,
    };
    const sub = race.subraces?.find((s) => s.id === state.subraceId);
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

export function computeFinalScores(state: CharacterCreatorState) {
  const racial = computeRacialBonuses(state);
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
        { label: "Point buy", value: state.baseScores[key] },
        ...racial[key].sources,
      ],
    };
  }

  return { scores, breakdown };
}

function collectSkillProficiencies(state: CharacterCreatorState): Set<SkillKey> {
  const skills = new Set<SkillKey>();
  const race = getRace(state.raceId);
  const background = getBackground(state.backgroundId);

  race?.skillProficiencies?.forEach((s) => skills.add(s));
  background?.skillProficiencies.forEach((s) => skills.add(s));
  state.classSkills.forEach((s) => skills.add(s));
  state.halfElfSkills.forEach((s) => skills.add(s));

  if (state.raceId === "human" && state.subraceId === "variant" && state.variantHumanSkill) {
    skills.add(state.variantHumanSkill);
  }

  return skills;
}

function collectLanguages(state: CharacterCreatorState): string[] {
  const langs = new Set<string>();
  const race = getRace(state.raceId);
  const background = getBackground(state.backgroundId);

  race?.languages.forEach((l) => langs.add(l));
  race?.fixedLanguages?.forEach((l) => langs.add(l));
  background?.fixedLanguages?.forEach((l) => langs.add(l));
  state.raceLanguageChoices.forEach((l) => langs.add(l));
  state.backgroundLanguageChoices.forEach((l) => langs.add(l));

  return [...langs];
}

function collectTools(state: CharacterCreatorState): string[] {
  const tools = new Set<string>();
  const background = getBackground(state.backgroundId);
  const cls = getClass(state.classId);

  background?.toolProficiencies?.forEach((t) => {
    if (t === "artisan's tools" && state.backgroundArtisanTool) {
      tools.add(state.backgroundArtisanTool);
    } else if (t === "gaming set" && state.backgroundGamingSet) {
      tools.add(state.backgroundGamingSet);
    } else if (t === "musical instrument" && state.backgroundMusicalInstrument) {
      tools.add(state.backgroundMusicalInstrument);
    } else if (
      t === "cartographer's tools or navigator's tools" &&
      state.backgroundExplorerTool
    ) {
      tools.add(state.backgroundExplorerTool);
    } else if (!t.includes(" or ") && !t.endsWith(" set")) {
      tools.add(t);
    } else if (t === "gaming set") {
      // handled above
    } else {
      tools.add(t);
    }
  });

  cls?.toolProficiencies?.forEach((t) => tools.add(t));
  if (state.monkTool) tools.add(state.monkTool);

  return [...tools];
}

function resolveEquipmentNames(state: CharacterCreatorState): string[] {
  const names: string[] = [];
  const cls = getClass(state.classId);
  const background = getBackground(state.backgroundId);

  if (background) {
    names.push(...background.equipment);
  }

  if (cls) {
    names.push(...cls.fixedEquipment);
    cls.equipmentChoices.forEach((choice, index) => {
      const optionIndex = state.equipmentChoiceIndices[index] ?? 0;
      const option = choice.options[optionIndex];
      if (option) names.push(...option.items);
    });
  }

  return names;
}

function calculateAc(
  classId: string,
  scores: CharacterData["abilityScores"],
  itemNames: string[]
): number {
  const dexMod = abilityModifier(scores.dex);
  const conMod = abilityModifier(scores.con);
  const wisMod = abilityModifier(scores.wis);

  let bestArmor: (typeof ARMOR_AC)[string] | null = null;
  let armorName = "";
  let hasShield = false;

  for (const raw of itemNames) {
    const name = raw.toLowerCase();
    if (name === "shield" || name.includes("shield")) hasShield = true;
    const armor = ARMOR_AC[name];
    if (armor && (!bestArmor || armor.base > bestArmor.base)) {
      bestArmor = armor;
      armorName = name;
    }
  }

  if (bestArmor) {
    const dexBonus =
      bestArmor.maxDex === undefined
        ? dexMod
        : Math.min(dexMod, bestArmor.maxDex);
    return bestArmor.base + dexBonus + (hasShield ? 2 : 0);
  }

  if (classId === "barbarian") {
    return 10 + dexMod + conMod + (hasShield ? 2 : 0);
  }
  if (classId === "monk") {
    return 10 + dexMod + wisMod;
  }

  return 10 + dexMod + (hasShield ? 2 : 0);
}

function buildFeatures(state: CharacterCreatorState): Feature[] {
  const features: Feature[] = [];
  const race = getRace(state.raceId);
  const cls = getClass(state.classId);
  const background = getBackground(state.backgroundId);
  const sub = cls?.subclasses.find((s) => s.id === state.subclassId);

  race?.traits.forEach((t) =>
    features.push({
      id: crypto.randomUUID(),
      name: t.name,
      description: t.description,
      restReset: "none",
    })
  );

  const subrace = race?.subraces?.find((s) => s.id === state.subraceId);
  subrace?.extras?.forEach((text) =>
    features.push({
      id: crypto.randomUUID(),
      name: subrace.name,
      description: text,
      restReset: "none",
    })
  );

  cls?.features.forEach((f) =>
    features.push({
      id: crypto.randomUUID(),
      name: f.name,
      description: f.description,
      restReset: "long",
    })
  );

  sub?.features.forEach((f) =>
    features.push({
      id: crypto.randomUUID(),
      name: f.name,
      description: f.description,
      restReset: "long",
    })
  );

  if (background) {
    features.push({
      id: crypto.randomUUID(),
      name: background.feature.name,
      description: background.feature.description,
      restReset: "none",
    });
  }

  if (state.fightingStyle) {
    features.push({
      id: crypto.randomUUID(),
      name: `Fighting Style: ${state.fightingStyle}`,
      description: `${state.fightingStyle} fighting style.`,
      restReset: "none",
    });
  }

  if (state.favoredEnemy) {
    features.push({
      id: crypto.randomUUID(),
      name: "Favored Enemy",
      description: state.favoredEnemy,
      restReset: "none",
    });
  }

  if (state.favoredTerrain) {
    features.push({
      id: crypto.randomUUID(),
      name: "Natural Explorer",
      description: `Favored terrain: ${state.favoredTerrain}`,
      restReset: "none",
    });
  }

  if (state.variantHumanFeat) {
    const feat = getFeat(state.variantHumanFeat);
    if (feat) {
      features.push({
        id: crypto.randomUUID(),
        name: feat.name,
        description: feat.description,
        restReset: "none",
      });
    }
  }

  return features;
}

function buildSpells(state: CharacterCreatorState, scores: CharacterData["abilityScores"]) {
  const cls = getClass(state.classId);
  if (!cls?.spellcasting) {
    return { spellcastingAbility: undefined, known: [], prepared: [], slots: {} };
  }

  const ability = cls.spellcasting.ability;
  const cantrips = state.cantripIds
    .map((id) => getSpell(id))
    .filter(Boolean)
    .map((s) => ({
      id: crypto.randomUUID(),
      name: s!.name,
      level: 0,
      prepared: true,
      notes: s!.school,
    }));

  const level1 = state.spellIds
    .map((id) => getSpell(id))
    .filter(Boolean)
    .map((s) => ({
      id: crypto.randomUUID(),
      name: s!.name,
      level: 1,
      prepared: true,
      notes: s!.school,
    }));

  const spellbook = state.wizardSpellbookIds
    .map((id) => getSpell(id))
    .filter(Boolean)
    .map((s) => ({
      id: crypto.randomUUID(),
      name: s!.name,
      level: 1,
      prepared: false,
      notes: `Spellbook · ${s!.school}`,
    }));

  const slots: CharacterData["spells"]["slots"] = {};
  if (state.classId === "warlock") {
    slots["1"] = { max: 1, used: 0 };
  } else {
    slots["1"] = { max: 2, used: 0 };
  }

  if (cls.spellcasting.preparedCaster) {
    return {
      spellcastingAbility: ability,
      known: state.classId === "wizard" ? [...cantrips, ...spellbook] : cantrips,
      prepared: [...cantrips, ...level1],
      slots,
    };
  }

  return {
    spellcastingAbility: ability,
    known: [...cantrips, ...level1],
    prepared: [],
    slots,
  };
}

export function buildCharacterExport(state: CharacterCreatorState): CharacterExport {
  const race = getRace(state.raceId);
  const background = getBackground(state.backgroundId);
  const cls = getClass(state.classId);
  const { scores, breakdown } = computeFinalScores(state);
  const conMod = abilityModifier(scores.con);
  const prof = proficiencyBonus(1);

  const itemNames = resolveEquipmentNames(state);
  const expanded = expandEquipmentItems(itemNames);

  let gp = background?.gold ?? 0;

  const speed =
    state.raceId === "elf" && state.subraceId === "wood"
      ? 35
      : race?.speed ?? 30;

  let maxHp = (cls?.hitDie ?? 8) + conMod;
  if (state.raceId === "dwarf" && state.subraceId === "hill") {
    maxHp += 1;
  }

  const ac = calculateAc(state.classId, scores, itemNames);

  const skillSet = collectSkillProficiencies(state);
  const skills: CharacterData["skills"] = {};
  for (const key of Object.keys(skillSet) as SkillKey[]) {
    skills[key] = { proficient: true, expertise: false };
  }

  const savingThrows: CharacterData["savingThrows"] = {};
  cls?.savingThrows.forEach((key) => {
    savingThrows[key] = { proficient: true };
  });

  const subclass = cls?.subclasses.find((s) => s.id === state.subclassId);

  const data: CharacterData = {
    basicInfo: {
      name: state.name,
      playerName: state.playerName,
      level: 1,
      classes: cls ? [cls.name] : [],
      class: cls?.name,
      subclass: subclass?.name ?? "",
      species: getRaceDisplayName(state.raceId, state.subraceId),
      background: background?.name ?? "",
      alignment: state.alignment,
      portrait: "",
      publicNotes: "",
      dmNotes: "",
    },
    abilityScores: scores,
    abilityScoreBreakdown: breakdown,
    savingThrows,
    skills,
    languages: collectLanguages(state),
    toolProficiencies: collectTools(state),
    combat: {
      ac,
      maxHp,
      currentHp: maxHp,
      tempHp: 0,
      initiativeBonus: 0,
      speed,
      hitDice: `1d${cls?.hitDie ?? 8}`,
      deathSaves: { successes: 0, failures: 0 },
      conditions: [],
      exhaustion: 0,
      concentration: { active: false, spell: "" },
    },
    attacks: [],
    spells: buildSpells(state, scores),
    inventory: {
      currency: { cp: 0, sp: 0, ep: 0, gp, pp: 0 },
      items: expanded.map((item) => ({
        id: crypto.randomUUID(),
        name: item.name,
        quantity: item.quantity,
        weightLb: item.weightLb,
        equipped:
          item.name.toLowerCase().includes("armor") ||
          item.name.toLowerCase() === "shield" ||
          ["longsword", "rapier", "shortsword", "greataxe", "mace", "quarterstaff", "dagger"].some(
            (w) => item.name.toLowerCase().includes(w)
          ),
        magicItem: false,
        notes: "",
      })),
      notes: "",
    },
    features: buildFeatures(state),
  };

  return {
    version: 1,
    name: state.name,
    playerName: state.playerName,
    data,
  };
}

export function validateCreatorState(state: CharacterCreatorState): string[] {
  const errors: string[] = [];

  if (!state.name.trim()) errors.push("Character name is required.");
  if (!state.alignment) errors.push("Alignment is required.");
  if (!state.raceId) errors.push("Race is required.");
  if (!state.backgroundId) errors.push("Background is required.");

  const race = getRace(state.raceId);
  if (race?.subraces?.length && !state.subraceId) {
    errors.push("Subrace is required.");
  }

  if (race?.id === "half-elf") {
    if (state.halfElfAbilityBonuses.length !== 2) {
      errors.push("Half-Elf requires two +1 ability score choices.");
    }
    if (state.halfElfSkills.length !== 2) {
      errors.push("Half-Elf requires two skill proficiencies.");
    }
  }

  if (race?.id === "human" && state.subraceId === "variant") {
    if (state.variantHumanAbilityBonuses.length !== 2) {
      errors.push("Variant Human requires two +1 ability score choices.");
    }
    if (!state.variantHumanSkill) errors.push("Variant Human requires a skill.");
    if (!state.variantHumanFeat) errors.push("Variant Human requires a feat.");
  }

  if (!state.classId) errors.push("Class is required.");

  const cls = getClass(state.classId);
  if (cls && classRequiresSubclassAtLevel1(state.classId) && !state.subclassId) {
    errors.push("Subclass is required at 1st level for this class.");
  }

  if (state.classId === "fighter" && !state.fightingStyle) {
    errors.push("Fighting style is required.");
  }
  if (state.classId === "ranger") {
    if (!state.favoredEnemy) errors.push("Favored enemy is required.");
    if (!state.favoredTerrain) errors.push("Favored terrain is required.");
  }

  if (!isValidPointBuy(state.baseScores)) {
    errors.push("Ability scores must use exactly 27 point-buy points (scores 8–15 before racial bonuses).");
  }

  if (cls && state.classSkills.length !== cls.skillChoiceCount) {
    errors.push(`Choose ${cls.skillChoiceCount} class skill(s).`);
  }

  if (cls?.spellcasting) {
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
  }

  return errors;
}
