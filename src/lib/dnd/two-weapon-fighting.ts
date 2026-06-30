import {
  getEffectiveWieldMain,
  getEffectiveWieldOff,
  isLightWeapon,
  isOneHandedWeapon,
} from "@/lib/character/equip-rules";
import { getAllCharacterFeatures } from "@/lib/character/feature-derivation";
import type { CharacterData } from "@/lib/schemas/character";
import { getWeaponProperties, type Item } from "@/lib/schemas/item";
import type { PhbClass } from "@/lib/dnd/phb/types";

export interface WieldedWeaponPair {
  main: Item | null;
  off: Item | null;
}

export function hasDualWielder(
  character: CharacterData,
  catalogClasses?: PhbClass[]
): boolean {
  if (character.featureChoices?.variantHumanFeat === "dual-wielder") {
    return true;
  }
  return getAllCharacterFeatures(character, { classes: catalogClasses }).some(
    (f) => /dual wielder/i.test(f.name)
  );
}

export function getWieldedWeaponPair(
  character: CharacterData,
  catalogItems: Record<string, Item>
): WieldedWeaponPair {
  let main: Item | null = null;
  let off: Item | null = null;

  for (const invItem of character.inventory.items) {
    if (!invItem.itemId) continue;
    const catalogItem = catalogItems[invItem.itemId];
    if (!catalogItem || !getWeaponProperties(catalogItem)) continue;

    if (getEffectiveWieldMain(invItem, catalogItem)) {
      main = catalogItem;
    }
    if (getEffectiveWieldOff(invItem)) {
      off = catalogItem;
    }
  }

  return { main, off };
}

function isMeleeWeapon(catalogItem: Item | null | undefined): boolean {
  if (!catalogItem) return false;
  const props = getWeaponProperties(catalogItem);
  return props?.weaponRange === "melee";
}

export function hasWieldedMeleeWeapon(
  character: CharacterData,
  catalogItems: Record<string, Item>
): boolean {
  const { main, off } = getWieldedWeaponPair(character, catalogItems);
  return isMeleeWeapon(main) || isMeleeWeapon(off);
}

export function hasBothHandsWieldingMeleeWeapons(
  character: CharacterData,
  catalogItems: Record<string, Item>
): boolean {
  const { main, off } = getWieldedWeaponPair(character, catalogItems);
  return (
    main != null &&
    off != null &&
    isOneHandedWeapon(main) &&
    isOneHandedWeapon(off) &&
    isMeleeWeapon(main) &&
    isMeleeWeapon(off)
  );
}

export function canTwoWeaponFightSameTurn(
  character: CharacterData,
  catalogItems: Record<string, Item>,
  catalogClasses?: PhbClass[]
): boolean {
  const { main, off } = getWieldedWeaponPair(character, catalogItems);
  if (main == null || off == null) return false;
  if (!isOneHandedWeapon(main) || !isOneHandedWeapon(off)) return false;
  if (hasDualWielder(character, catalogClasses)) return true;
  return isLightWeapon(main) && isLightWeapon(off);
}

export function hasDualWielderAcBonus(
  character: CharacterData,
  catalogItems: Record<string, Item>,
  catalogClasses?: PhbClass[]
): boolean {
  if (!hasDualWielder(character, catalogClasses)) return false;
  return hasBothHandsWieldingMeleeWeapons(character, catalogItems);
}
