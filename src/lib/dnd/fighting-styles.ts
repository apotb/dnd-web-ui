import { getAllCharacterFeatures } from "@/lib/character/feature-derivation";
import { isWornForAc } from "@/lib/character/equip-rules";
import { getWieldedWeaponPair } from "@/lib/dnd/two-weapon-fighting";
import type { DerivedAttack, WeaponGrip } from "@/lib/dnd/attacks";
import type { CharacterData } from "@/lib/schemas/character";
import { getShieldProperties, getWeaponProperties, type Item } from "@/lib/schemas/item";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { PhbClass } from "@/lib/dnd/phb/types";
import { areTokensWithinMeleeRange, isHostileToken } from "@/lib/combat/engagement";

export const FIGHTING_STYLE_ARCHERY = "Archery";
export const FIGHTING_STYLE_DEFENSE = "Defense";
export const FIGHTING_STYLE_DUELING = "Dueling";
export const FIGHTING_STYLE_GREAT_WEAPON_FIGHTING = "Great Weapon Fighting";
export const FIGHTING_STYLE_PROTECTION = "Protection";
export const FIGHTING_STYLE_TWO_WEAPON_FIGHTING = "Two-Weapon Fighting";

const ARCHERY_ATTACK_BONUS = 2;
const DEFENSE_AC_BONUS = 1;
const DUELING_DAMAGE_BONUS = 2;

export function getChosenFightingStyle(character: CharacterData): string {
  return character.featureChoices?.fightingStyle?.trim() ?? "";
}

function matchesFightingStyleName(chosen: string, name: string): boolean {
  return chosen.toLowerCase() === name.toLowerCase();
}

export function hasFightingStyleFromFeatures(
  character: CharacterData,
  styleName: string,
  catalogClasses?: PhbClass[]
): boolean {
  const pattern = new RegExp(styleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return getAllCharacterFeatures(character, { classes: catalogClasses }).some((feature) =>
    pattern.test(feature.name)
  );
}

function hasFightingStyle(
  character: CharacterData,
  styleName: string,
  catalogClasses?: PhbClass[]
): boolean {
  const chosen = getChosenFightingStyle(character);
  if (matchesFightingStyleName(chosen, styleName)) return true;
  return hasFightingStyleFromFeatures(character, styleName, catalogClasses);
}

export function hasArchery(
  character: CharacterData,
  catalogClasses?: PhbClass[]
): boolean {
  return hasFightingStyle(character, FIGHTING_STYLE_ARCHERY, catalogClasses);
}

export function hasDefense(
  character: CharacterData,
  catalogClasses?: PhbClass[]
): boolean {
  return hasFightingStyle(character, FIGHTING_STYLE_DEFENSE, catalogClasses);
}

export function hasDueling(
  character: CharacterData,
  catalogClasses?: PhbClass[]
): boolean {
  return hasFightingStyle(character, FIGHTING_STYLE_DUELING, catalogClasses);
}

export function hasGreatWeaponFighting(
  character: CharacterData,
  catalogClasses?: PhbClass[]
): boolean {
  return hasFightingStyle(
    character,
    FIGHTING_STYLE_GREAT_WEAPON_FIGHTING,
    catalogClasses
  );
}

export function hasProtection(
  character: CharacterData,
  catalogClasses?: PhbClass[]
): boolean {
  return hasFightingStyle(character, FIGHTING_STYLE_PROTECTION, catalogClasses);
}

export function hasTwoWeaponFighting(
  character: CharacterData,
  catalogClasses?: PhbClass[]
): boolean {
  return hasFightingStyle(
    character,
    FIGHTING_STYLE_TWO_WEAPON_FIGHTING,
    catalogClasses
  );
}

export function isShieldWielded(
  character: CharacterData,
  catalogItems: Record<string, Item>
): boolean {
  return character.inventory.items.some((item) => {
    if (!item.equipped) return false;
    const catalog = item.itemId ? catalogItems[item.itemId] : null;
    if (catalog && getShieldProperties(catalog) != null) return true;
    const name = (catalog?.name ?? item.name).toLowerCase().trim();
    return name === "shield" || name.endsWith(" shield");
  });
}

function isLegacyArmorName(name: string): boolean {
  const key = name.toLowerCase().trim();
  if (key.includes(" armor") || key.includes(" armour")) return true;
  return [
    "padded armor",
    "leather armor",
    "studded leather armor",
    "studded leather",
    "hide armor",
    "chain shirt",
    "scale mail",
    "breastplate",
    "half plate",
    "ring mail",
    "chain mail",
    "splint armor",
    "plate armor",
  ].includes(key);
}

export function isWearingArmorForDefense(
  character: CharacterData,
  catalogItems: Record<string, Item>
): boolean {
  return character.inventory.items.some((item) => {
    const catalog = item.itemId ? catalogItems[item.itemId] : null;
    if (!isWornForAc(item, catalog)) return false;
    if (catalog?.category === "armor") return true;
    return isLegacyArmorName(catalog?.name ?? item.name);
  });
}

export function getArcheryAttackBonus(
  character: CharacterData,
  isRangedWeapon: boolean,
  catalogClasses?: PhbClass[]
): number {
  if (!isRangedWeapon || !hasArchery(character, catalogClasses)) return 0;
  return ARCHERY_ATTACK_BONUS;
}

export function getDefenseAcBonus(
  character: CharacterData,
  catalogItems: Record<string, Item>,
  catalogClasses?: PhbClass[]
): number {
  if (!hasDefense(character, catalogClasses)) return 0;
  if (!isWearingArmorForDefense(character, catalogItems)) return 0;
  return DEFENSE_AC_BONUS;
}

export function qualifiesForDueling(
  character: CharacterData,
  catalogItems: Record<string, Item>,
  context: {
    isOffHand: boolean;
    isRanged: boolean;
    isThrown: boolean;
    catalogItem: Item;
  },
  catalogClasses?: PhbClass[]
): boolean {
  if (!hasDueling(character, catalogClasses)) return false;
  if (context.isOffHand || context.isRanged || context.isThrown) return false;

  const wp = getWeaponProperties(context.catalogItem);
  if (!wp || wp.weaponRange === "ranged") return false;
  if (wp.weaponProperties.includes("two-handed")) return false;

  const { off } = getWieldedWeaponPair(character, catalogItems);
  return off == null;
}

export function getDuelingDamageBonus(
  character: CharacterData,
  catalogItems: Record<string, Item>,
  context: {
    isOffHand: boolean;
    isRanged: boolean;
    isThrown: boolean;
    catalogItem: Item;
  },
  catalogClasses?: PhbClass[]
): number {
  return qualifiesForDueling(character, catalogItems, context, catalogClasses)
    ? DUELING_DAMAGE_BONUS
    : 0;
}

export function qualifiesForGreatWeaponFighting(
  character: CharacterData,
  catalogItems: Record<string, Item>,
  attack: DerivedAttack,
  weaponGrip: WeaponGrip,
  catalogClasses?: PhbClass[]
): boolean {
  if (!hasGreatWeaponFighting(character, catalogClasses)) return false;
  if (attack.source !== "weapon" || attack.isOffHand || attack.throwsWeapon) return false;

  const catalogItem = attack.itemId ? catalogItems[attack.itemId] : null;
  if (!catalogItem) return false;

  const wp = getWeaponProperties(catalogItem);
  if (!wp || wp.weaponRange === "ranged") return false;
  if (wp.weaponProperties.includes("two-handed")) return true;
  return wp.weaponProperties.includes("versatile") && weaponGrip === "two-handed";
}

export function canUseProtectionReaction(
  protector: CombatToken,
  protectorCharacter: CharacterData,
  target: CombatToken,
  attacker: CombatToken,
  state: CombatState,
  catalogItems: Record<string, Item>,
  catalogClasses?: PhbClass[]
): boolean {
  if (!protector.placed || !target.placed) return false;
  if (protector.id === attacker.id || protector.id === target.id) return false;
  if (!isHostileToken(attacker, target)) return false;
  if (!areTokensWithinMeleeRange(protector, target)) return false;
  if (state.reactionUsedTokenIds.includes(protector.id)) return false;
  if (!hasProtection(protectorCharacter, catalogClasses)) return false;
  return isShieldWielded(protectorCharacter, catalogItems);
}

export function findProtectionEligibleTokens(
  target: CombatToken,
  attacker: CombatToken,
  state: CombatState,
  charactersById: Record<string, ParsedCharacter>,
  catalogItems: Record<string, Item>,
  classCatalog?: PhbClass[]
): CombatToken[] {
  if (!target.placed || target.id === attacker.id) return [];

  return state.tokens.filter((token) => {
    if (token.kind !== "party" && token.kind !== "ally") return false;
    if (!token.characterId) return false;
    const character = charactersById[token.characterId];
    if (!character) return false;
    return canUseProtectionReaction(
      token,
      character.data,
      target,
      attacker,
      state,
      catalogItems,
      classCatalog
    );
  });
}
