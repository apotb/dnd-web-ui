import {
  getEffectiveWieldMain,
  getEffectiveWieldOff,
} from "@/lib/character/equip-rules";
import { getAllCharacterFeatures } from "@/lib/character/feature-derivation";
import { getEffectiveWeaponProficiencies } from "@/lib/character/class-derivation";
import type { CharacterData, AbilityKey } from "@/lib/schemas/character";
import type { Item } from "@/lib/schemas/item";
import type { PhbClass } from "@/lib/dnd/phb/types";
import { getWeaponProperties } from "@/lib/schemas/item";
import {
  abilityModifier,
  getProficiencyBonus,
  getAbilityModifiers,
} from "@/lib/dnd/calculations";
import { levelFromXp } from "@/lib/dnd/xp";

/** IDs of PHB cantrips that use a spell attack roll (not saving throw). */
const ATTACK_CANTRIP_IDS = new Set([
  "acid-splash",
  "chill-touch",
  "eldritch-blast",
  "fire-bolt",
  "ray-of-frost",
  "shocking-grasp",
]);

/** Well-known cantrip attack dice by level range (based on character level). */
const CANTRIP_DICE_AT_LEVEL: Record<string, string> = {
  "fire-bolt": "1d10",
  "ray-of-frost": "1d8",
  "chill-touch": "1d8",
  "eldritch-blast": "1d10",
  "shocking-grasp": "1d8",
  "acid-splash": "1d6",
};

const CANTRIP_DAMAGE_TYPE: Record<string, string> = {
  "fire-bolt": "fire",
  "ray-of-frost": "cold",
  "chill-touch": "necrotic",
  "eldritch-blast": "force",
  "shocking-grasp": "lightning",
  "acid-splash": "acid",
};

const CANTRIP_RANGE: Record<string, string> = {
  "fire-bolt": "120 ft",
  "ray-of-frost": "60 ft",
  "chill-touch": "120 ft",
  "eldritch-blast": "120 ft",
  "shocking-grasp": "Touch",
  "acid-splash": "60 ft",
};

function cantripScaledDice(baseDice: string, level: number): string {
  const scale = level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
  if (scale === 1) return baseDice;
  const match = baseDice.match(/^(\d+)d(\d+)$/);
  if (!match) return baseDice;
  return `${scale * parseInt(match[1])}d${match[2]}`;
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
  source: "weapon" | "cantrip" | "manual";
  /** slug of the catalog item that generated this attack, if any */
  itemId?: string;
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

/** Derive attacks from attack cantrips in the character's known spells. */
export function deriveCantripAttacks(character: CharacterData): DerivedAttack[] {
  if (!character.spells.spellcastingAbility) return [];

  const mods = getAbilityModifiers(character.abilityScores);
  const prof = getProficiencyBonus(character);
  const castingMod = mods[character.spells.spellcastingAbility as AbilityKey];
  const attackBonus = castingMod + prof;
  const level = levelFromXp(character.basicInfo.xp ?? 0);

  const attacks: DerivedAttack[] = [];

  for (const spell of character.spells.known) {
    if (spell.level !== 0) continue;

    // Try to match by name to a known attack cantrip ID
    const slug = spell.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");

    if (!ATTACK_CANTRIP_IDS.has(slug)) continue;

    const baseDice = CANTRIP_DICE_AT_LEVEL[slug] ?? "1d6";
    const scaledDice = cantripScaledDice(baseDice, level);
    const damageType = CANTRIP_DAMAGE_TYPE[slug] ?? "";
    const range = CANTRIP_RANGE[slug] ?? "60 ft";

    attacks.push({
      id: `cantrip-${spell.id}`,
      name: spell.name,
      attackBonus,
      damageDice: scaledDice,
      damageType,
      range,
      notes: spell.notes || "",
      source: "cantrip",
    });
  }

  return attacks;
}

/**
 * Combine all attacks for display: derived weapon attacks + cantrip attacks
 * come first, then manual attacks stored in character.attacks[].
 */
export function getAllAttacks(
  character: CharacterData,
  catalogItems: Record<string, Item>,
  catalogClasses?: PhbClass[]
): DerivedAttack[] {
  const weapon = deriveWeaponAttacks(character, catalogItems, catalogClasses);
  const cantrips = deriveCantripAttacks(character);
  const manual: DerivedAttack[] = character.attacks.map((a) => ({
    ...a,
    source: "manual" as const,
  }));

  return [...weapon, ...cantrips, ...manual];
}
