import {
  getEffectiveWieldMain,
  getEffectiveWieldOff,
} from "@/lib/character/equip-rules";
import { getAllCharacterFeatures } from "@/lib/character/feature-derivation";
import { getEffectiveWeaponProficiencies } from "@/lib/character/class-derivation";
import type { CharacterData, Spell } from "@/lib/schemas/character";
import type { Item } from "@/lib/schemas/item";
import type { PhbClass } from "@/lib/dnd/phb/types";
import {
  countAmmunitionInInventory,
  formatAmmunitionLine,
  getAmmunitionDisplayName,
  getAmmunitionSlugForWeapon,
  weaponUsesAmmunition,
} from "@/lib/dnd/ammunition";
import { getWeaponProperties } from "@/lib/schemas/item";
import {
  getAbilityModifiers,
  getProficiencyBonus,
  getSpellAttackBonus,
  getSpellSaveDc,
  formatModifier,
} from "@/lib/dnd/calculations";
import { levelFromXp } from "@/lib/dnd/xp";
import { canCastSpellWithRemainingSlots } from "@/lib/dnd/spellcasting";

type OffensiveSpellRollType = "attack" | "save" | "auto";

interface OffensiveSpellMeta {
  rollType: OffensiveSpellRollType;
  damageDice: string;
  damageType: string;
  range: string;
  saveAbility?: string;
  /** Scale dice at character levels 5, 11, and 17 (cantrip progression). */
  cantripScaling?: boolean;
  /** Eldritch blast adds beams at those same breakpoints. */
  eldritchBlast?: boolean;
  notes?: string;
}

/** Prepared offensive spells in the PHB catalog (attack rolls, saves, or auto-hit). */
const OFFENSIVE_SPELL_METADATA: Record<string, OffensiveSpellMeta> = {
  "acid-splash": {
    rollType: "attack",
    damageDice: "1d6",
    damageType: "acid",
    range: "60 ft",
    cantripScaling: true,
  },
  "chill-touch": {
    rollType: "attack",
    damageDice: "1d8",
    damageType: "necrotic",
    range: "120 ft",
    cantripScaling: true,
  },
  "eldritch-blast": {
    rollType: "attack",
    damageDice: "1d10",
    damageType: "force",
    range: "120 ft",
    eldritchBlast: true,
  },
  "fire-bolt": {
    rollType: "attack",
    damageDice: "1d10",
    damageType: "fire",
    range: "120 ft",
    cantripScaling: true,
  },
  "poison-spray": {
    rollType: "save",
    saveAbility: "Con",
    damageDice: "1d12",
    damageType: "poison",
    range: "10 ft",
    cantripScaling: true,
  },
  "produce-flame": {
    rollType: "attack",
    damageDice: "1d8",
    damageType: "fire",
    range: "30 ft",
    cantripScaling: true,
  },
  "ray-of-frost": {
    rollType: "attack",
    damageDice: "1d8",
    damageType: "cold",
    range: "60 ft",
    cantripScaling: true,
  },
  "sacred-flame": {
    rollType: "save",
    saveAbility: "Dex",
    damageDice: "1d8",
    damageType: "radiant",
    range: "60 ft",
    cantripScaling: true,
    notes: "Ignores cover",
  },
  "shocking-grasp": {
    rollType: "attack",
    damageDice: "1d8",
    damageType: "lightning",
    range: "Touch",
    cantripScaling: true,
  },
  "thorn-whip": {
    rollType: "attack",
    damageDice: "1d6",
    damageType: "piercing",
    range: "30 ft",
    cantripScaling: true,
  },
  "vicious-mockery": {
    rollType: "save",
    saveAbility: "Wis",
    damageDice: "1d4",
    damageType: "psychic",
    range: "60 ft",
    cantripScaling: true,
  },
  "arms-of-hadar": {
    rollType: "save",
    saveAbility: "Str",
    damageDice: "2d6",
    damageType: "necrotic",
    range: "10-ft radius",
    notes: "+1d6 per slot above 1st",
  },
  "burning-hands": {
    rollType: "save",
    saveAbility: "Dex",
    damageDice: "3d6",
    damageType: "fire",
    range: "15-ft cone",
    notes: "+1d6 per slot above 1st",
  },
  "chromatic-orb": {
    rollType: "attack",
    damageDice: "3d8",
    damageType: "varies",
    range: "90 ft",
    notes: "Acid, cold, fire, lightning, poison, or thunder; +1d8 per slot above 1st",
  },
  "guiding-bolt": {
    rollType: "attack",
    damageDice: "4d6",
    damageType: "radiant",
    range: "120 ft",
    notes: "+1d6 per slot above 1st",
  },
  "hellish-rebuke": {
    rollType: "save",
    saveAbility: "Dex",
    damageDice: "2d10",
    damageType: "fire",
    range: "60 ft",
    notes: "Reaction; +1d10 per slot above 1st",
  },
  "inflict-wounds": {
    rollType: "attack",
    damageDice: "3d10",
    damageType: "necrotic",
    range: "Touch",
    notes: "+1d10 per slot above 1st",
  },
  "magic-missile": {
    rollType: "auto",
    damageDice: "3d4+3",
    damageType: "force",
    range: "120 ft",
    notes: "+1 dart per slot above 1st; each dart hits automatically",
  },
  "ray-of-sickness": {
    rollType: "attack",
    damageDice: "2d8",
    damageType: "poison",
    range: "60 ft",
    notes: "+1d8 per slot above 1st",
  },
  "thunderwave": {
    rollType: "save",
    saveAbility: "Con",
    damageDice: "2d8",
    damageType: "thunder",
    range: "15-ft cube",
    notes: "+1d8 per slot above 1st",
  },
  "witch-bolt": {
    rollType: "attack",
    damageDice: "1d12",
    damageType: "lightning",
    range: "30 ft",
    notes: "Concentration; +1d12 per slot above 1st on initial hit",
  },
};

function cantripScaledDice(baseDice: string, level: number): string {
  const scale = level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
  if (scale === 1) return baseDice;
  const match = baseDice.match(/^(\d+)d(\d+)$/);
  if (!match) return baseDice;
  return `${scale * parseInt(match[1], 10)}d${match[2]}`;
}

function eldritchBlastBeamCount(level: number): number {
  if (level >= 17) return 4;
  if (level >= 11) return 3;
  if (level >= 5) return 2;
  return 1;
}

function spellSlug(spell: Spell): string | null {
  if (spell.spellId) return spell.spellId;
  const slug = spell.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
  return slug || null;
}

/** A single derived or manual attack entry for display. */
export interface DerivedAttack {
  id: string;
  name: string;
  attackBonus: number;
  damageDice: string;
  damageType: string;
  range: string;
  notes: string;
  source: "weapon" | "cantrip" | "spell" | "manual";
  spellLevel?: number;
  rollType?: OffensiveSpellRollType;
  saveAbility?: string;
  saveDc?: number;
  /** slug of the catalog item that generated this attack, if any */
  itemId?: string;
  /** Off-hand weapon attack from two-weapon fighting (bonus action). */
  isOffHand?: boolean;
  /** Catalog slug of ammunition consumed per attack, if any. */
  ammunitionItemId?: string;
  /** Display name of the ammunition type. */
  ammunitionName?: string;
  /** Remaining ammunition in inventory when the attack was derived. */
  ammunitionRemaining?: number;
}

export function formatAttackRollLine(attack: DerivedAttack): string {
  if (attack.rollType === "auto") return "Auto hit";
  if (attack.rollType === "save" && attack.saveDc != null) {
    const ability = attack.saveAbility ? ` ${attack.saveAbility}` : "";
    return `DC ${attack.saveDc}${ability} save`;
  }
  return `${formatModifier(attack.attackBonus)} to hit`;
}

/** Single-line attack summary for combat submit/review UI. */
export function formatAttackDescriptionBlurb(attack: DerivedAttack): string {
  const notes = attack.notes.trim();
  if (notes && /\b(?:Melee|Ranged) (?:Weapon|Spell) Attack:/i.test(notes)) {
    return notes;
  }

  const parts: string[] = [];
  const rollLine = formatAttackRollLine(attack);
  if (rollLine) parts.push(rollLine);
  if (attack.damageDice || attack.damageType) {
    parts.push(`${attack.damageDice} ${attack.damageType}`.trim());
  }
  if (attack.range) parts.push(attack.range);
  if (attack.ammunitionName != null && attack.ammunitionRemaining != null) {
    parts.push(formatAmmunitionLine(attack.ammunitionName, attack.ammunitionRemaining));
  }
  if (notes) parts.push(notes);
  return parts.join(" · ");
}

/** Return true if the character is proficient with a given catalog item weapon. */
function isProficientWithWeapon(
  character: CharacterData,
  weaponCategory: "simple" | "martial",
  itemName: string,
  itemSlug: string,
  catalogClasses?: PhbClass[]
): boolean {
  const profs = getEffectiveWeaponProficiencies(character, catalogClasses).map((p) =>
    p.toLowerCase()
  );
  if (profs.includes("simple weapons") && weaponCategory === "simple") return true;
  if (profs.includes("martial weapons") && weaponCategory === "martial") return true;
  if (profs.includes("simple weapons") && weaponCategory === "simple") return true;
  const slug = itemSlug.toLowerCase();
  const name = itemName.toLowerCase();
  return profs.some((p) => p === slug || p === name);
}

function hasTwoWeaponFighting(
  character: CharacterData,
  catalogClasses?: PhbClass[]
): boolean {
  if (/two-weapon fighting/i.test(character.featureChoices?.fightingStyle ?? "")) {
    return true;
  }
  return getAllCharacterFeatures(character, { classes: catalogClasses }).some(
    (f) => /two-weapon fighting/i.test(f.name)
  );
}

function formatDamageDice(dice: string, abilityMod: number, includeMod: boolean): string {
  if (!includeMod) return dice;
  return `${dice}${abilityMod >= 0 ? "+" : ""}${abilityMod}`;
}

/** Derive weapon attacks from wielded inventory items (main and off-hand). */
export function deriveWeaponAttacks(
  character: CharacterData,
  catalogItems: Record<string, Item>,
  catalogClasses?: PhbClass[]
): DerivedAttack[] {
  const attacks: DerivedAttack[] = [];
  const mods = getAbilityModifiers(character.abilityScores);
  const prof = getProficiencyBonus(character);
  const twf = hasTwoWeaponFighting(character, catalogClasses);

  for (const invItem of character.inventory.items) {
    if (!invItem.itemId) continue;
    const catalogItem = catalogItems[invItem.itemId];
    if (!catalogItem) continue;

    const wp = getWeaponProperties(catalogItem);
    if (!wp) continue;

    const mainHand = getEffectiveWieldMain(invItem, catalogItem);
    const offHand = getEffectiveWieldOff(invItem);
    if (!mainHand && !offHand) continue;

    const isFinesse = wp.weaponProperties.includes("finesse");
    const isRanged = wp.weaponRange === "ranged";
    const isThrown = wp.weaponProperties.includes("thrown");

    let abilityMod: number;
    if (isFinesse) {
      abilityMod = Math.max(mods.str, mods.dex);
    } else if (isRanged) {
      abilityMod = mods.dex;
    } else {
      abilityMod = mods.str;
    }

    const proficient = isProficientWithWeapon(
      character,
      wp.weaponCategory,
      catalogItem.name,
      catalogItem.slug,
      catalogClasses
    );
    const attackBonus = abilityMod + (proficient ? prof : 0);

    let range = "";
    if (isRanged && wp.rangeNormal) {
      range = `${wp.rangeNormal}/${wp.rangeLong ?? wp.rangeNormal * 4} ft`;
    } else if (isThrown && wp.throwRangeNormal) {
      range = `${wp.throwRangeNormal}/${wp.throwRangeLong ?? wp.throwRangeNormal * 3} ft`;
    } else if (!isRanged) {
      range = "5 ft";
    }

    const baseName = invItem.name || catalogItem.name;

    const usesAmmunition = isRanged && weaponUsesAmmunition(catalogItem);
    const ammunitionItemId = usesAmmunition
      ? getAmmunitionSlugForWeapon(catalogItem.slug)
      : null;
    const ammunitionName =
      ammunitionItemId != null
        ? getAmmunitionDisplayName(ammunitionItemId, catalogItems)
        : undefined;
    const ammunitionRemaining =
      ammunitionItemId != null
        ? countAmmunitionInInventory(character.inventory.items, ammunitionItemId)
        : undefined;

    const addAttack = (isOffHand: boolean) => {
      const includeMod = !isOffHand || twf;
      const damageDiceStr = wp.damage
        ? formatDamageDice(wp.damage, abilityMod, includeMod)
        : "—";

      const notes: string[] = [];
      if (isOffHand) notes.push("Bonus action");
      if (wp.weaponProperties.includes("versatile") && wp.versatileDamage && !isOffHand) {
        const versMod = abilityMod >= 0 ? `+${abilityMod}` : `${abilityMod}`;
        notes.push(`Two-handed: ${wp.versatileDamage}${versMod}`);
      }
      if (wp.weaponProperties.includes("finesse")) notes.push("Finesse");
      if (wp.weaponProperties.includes("reach")) notes.push("Reach (10 ft)");

      attacks.push({
        id: `weapon-${invItem.id}${isOffHand ? "-off" : ""}`,
        name: isOffHand ? `${baseName} (off-hand)` : baseName,
        attackBonus,
        damageDice: damageDiceStr,
        damageType: wp.damageType,
        range,
        notes: notes.join(", "),
        source: "weapon",
        itemId: invItem.itemId,
        isOffHand,
        ammunitionItemId: ammunitionItemId ?? undefined,
        ammunitionName,
        ammunitionRemaining,
      });
    };

    if (mainHand) addAttack(false);
    if (offHand) addAttack(true);
  }

  return attacks;
}

/** Derive unarmed strike for this character. */
export function deriveUnarmedStrike(character: CharacterData): DerivedAttack {
  const mods = getAbilityModifiers(character.abilityScores);
  const prof = getProficiencyBonus(character);
  const damage = Math.max(1, 1 + mods.str);
  return {
    id: "unarmed-strike",
    name: "Unarmed Strike",
    attackBonus: mods.str + prof,
    damageDice: `${damage}`,
    damageType: "bludgeoning",
    range: "5 ft",
    notes: "",
    source: "manual",
  };
}

function buildOffensiveSpellEntry(
  spell: Spell,
  meta: OffensiveSpellMeta,
  attackBonus: number,
  saveDc: number | undefined,
  characterLevel: number
): DerivedAttack {
  let damageDice = meta.damageDice;
  const noteParts: string[] = [];

  if (spell.notes.trim()) noteParts.push(spell.notes.trim());
  if (meta.notes) noteParts.push(meta.notes);

  if (meta.eldritchBlast) {
    const beams = eldritchBlastBeamCount(characterLevel);
    if (beams > 1) {
      damageDice = `${beams}d10`;
      noteParts.push(`${beams} beams`);
    }
  } else if (meta.cantripScaling || spell.level === 0) {
    damageDice = cantripScaledDice(meta.damageDice, characterLevel);
  }

  if (spell.level > 0) {
    noteParts.unshift(`${spell.level}${spellLevelSuffix(spell.level)}-level spell`);
  }

  return {
    id: `spell-${spell.id}`,
    name: spell.name,
    attackBonus,
    damageDice,
    damageType: meta.damageType,
    range: meta.range,
    notes: noteParts.join(" · "),
    source: spell.level === 0 ? "cantrip" : "spell",
    spellLevel: spell.level,
    rollType: meta.rollType,
    saveAbility: meta.saveAbility,
    saveDc: meta.rollType === "save" ? saveDc : undefined,
  };
}

function spellLevelSuffix(level: number): string {
  if (level === 1) return "st";
  if (level === 2) return "nd";
  if (level === 3) return "rd";
  return "th";
}

/** Derive attacks from offensive spells (cantrips and prepared leveled spells). */
export function deriveSpellAttacks(character: CharacterData): DerivedAttack[] {
  if (!character.spells.spellcastingAbility) return [];

  const attackBonus = getSpellAttackBonus(character) ?? 0;
  const saveDc = getSpellSaveDc(character) ?? undefined;
  const characterLevel = levelFromXp(character.basicInfo.xp ?? 0);

  const attacks: DerivedAttack[] = [];

  for (const spell of character.spells.known) {
    if (spell.level > 0 && !spell.prepared) continue;
    if (
      spell.level > 0 &&
      !canCastSpellWithRemainingSlots(character.spells.slots, spell.level)
    ) {
      continue;
    }

    const slug = spellSlug(spell);
    if (!slug) continue;

    const meta = OFFENSIVE_SPELL_METADATA[slug];
    if (!meta) continue;

    attacks.push(
      buildOffensiveSpellEntry(spell, meta, attackBonus, saveDc, characterLevel)
    );
  }

  return attacks.sort((a, b) => {
    const levelA = a.spellLevel ?? 0;
    const levelB = b.spellLevel ?? 0;
    if (levelA !== levelB) return levelA - levelB;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

/** @deprecated Use deriveSpellAttacks */
export function deriveCantripAttacks(character: CharacterData): DerivedAttack[] {
  return deriveSpellAttacks(character).filter((a) => a.source === "cantrip");
}

/**
 * Combine all attacks for display: derived weapon attacks + spell attacks
 * come first, then manual attacks stored in character.attacks[].
 */
export function getAllAttacks(
  character: CharacterData,
  catalogItems: Record<string, Item>,
  catalogClasses?: PhbClass[]
): DerivedAttack[] {
  const weapon = deriveWeaponAttacks(character, catalogItems, catalogClasses);
  const spells = deriveSpellAttacks(character);
  const manual: DerivedAttack[] = character.attacks.map((a) => ({
    ...a,
    source: "manual" as const,
  }));

  return [...weapon, ...spells, ...manual];
}
