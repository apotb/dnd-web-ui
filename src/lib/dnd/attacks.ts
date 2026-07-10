import {
  getEffectiveWieldMain,
  getEffectiveWieldOff,
} from "@/lib/character/equip-rules";
import {
  getArcheryAttackBonus,
  getDuelingDamageBonus,
} from "@/lib/dnd/fighting-styles";
import { getEffectiveWeaponProficiencies } from "@/lib/character/class-derivation";
import type { CharacterData, Spell } from "@/lib/schemas/character";
import type { Item } from "@/lib/schemas/item";
import type { PhbClass } from "@/lib/dnd/phb/types";
import { getSpell } from "@/lib/dnd/phb/spells";
import { isSpellCastableInCombat } from "@/lib/dnd/spell-casting-time";
import {
  countAmmunitionInInventory,
  formatAmmunitionLine,
  formatThrownWeaponLine,
  getAmmunitionDisplayName,
  getAmmunitionSlugForWeapon,
  weaponConsumesSelfWhenThrown,
  weaponUsesAmmunition,
} from "@/lib/dnd/ammunition";
import { getWeaponProperties } from "@/lib/schemas/item";
import {
  ABILITY_FULL_LABELS,
  getAbilityModifiers,
  getProficiencyBonus,
  getSpellAttackBonus,
  getSpellSaveDc,
  formatModifier,
} from "@/lib/dnd/calculations";
import { getCharacterLevel } from "@/lib/dnd/xp";
import { canCastSpellWithRemainingSlots } from "@/lib/dnd/spellcasting";
import { canCastGrantSpell } from "@/lib/character/spell-grant-uses";
import { isManagedGrantSpell } from "@/lib/character/spell-sources";
import {
  getNaturalAttackSpecs,
  hasMonkMartialArts,
  isMonkWeapon,
  resolveUnarmedDamageDie,
  type NaturalAttackSpec,
} from "@/lib/dnd/unarmed-mechanics";

type OffensiveSpellRollType = "attack" | "save" | "auto";

interface OffensiveSpellMeta {
  rollType: OffensiveSpellRollType;
  damageDice: string;
  damageType: string;
  range: string;
  saveAbility?: string;
  /** When false, a successful save deals no damage (e.g. Sacred Flame). Default true for saves. */
  saveHalfDamageOnSuccess?: boolean;
  /** Scale dice at character levels 5, 11, and 17 (cantrip progression). */
  cantripScaling?: boolean;
  /** Eldritch blast adds beams at those same breakpoints. */
  eldritchBlast?: boolean;
  notes?: string;
}

/** Prepared offensive cantrips in the PHB catalog (attack rolls or saves). */
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
    saveHalfDamageOnSuccess: false,
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
    saveHalfDamageOnSuccess: false,
    damageDice: "1d4",
    damageType: "psychic",
    range: "60 ft",
    cantripScaling: true,
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

export function resolveSpellSlug(spell: Spell): string | null {
  if (spell.spellId) return spell.spellId;
  const slug = spell.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
  return slug || null;
}

export function hasOffensiveSpellAttackMetadata(slug: string): boolean {
  return slug in OFFENSIVE_SPELL_METADATA;
}

export function getOffensiveSpellMetadata(slug: string): OffensiveSpellMeta | undefined {
  return OFFENSIVE_SPELL_METADATA[slug];
}

/** Melee reach weapons (glaive, whip, etc.) attack from this distance in feet. */
export const MELEE_REACH_FT = 10;

export interface AttackBonusSource {
  label: string;
  value: number;
}

function formatAttackBonusSourceLine(source: AttackBonusSource): string {
  return `${source.label}: ${formatModifier(source.value)}`;
}

export function formatAttackBonusTooltip(attack: DerivedAttack): string | null {
  if (attack.rollType === "auto") return "Automatically hits";
  if (attack.rollType === "save") return null;
  if (!attack.attackBonusSources?.length) return null;
  return attack.attackBonusSources.map(formatAttackBonusSourceLine).join("\n");
}

export function formatDamageBonusTooltip(attack: DerivedAttack): string | null {
  if (!attack.damageBonusSources?.length) return null;
  return attack.damageBonusSources.map(formatAttackBonusSourceLine).join("\n");
}

function buildAttackBonusSources(
  abilityLabel: string,
  abilityMod: number,
  proficient: boolean,
  proficiencyBonus: number
): AttackBonusSource[] {
  const sources: AttackBonusSource[] = [{ label: abilityLabel, value: abilityMod }];
  if (proficient) {
    sources.push({ label: "Proficiency", value: proficiencyBonus });
  }
  return sources;
}

function buildDamageBonusSources(
  abilityLabel: string,
  abilityMod: number
): AttackBonusSource[] {
  return [{ label: abilityLabel, value: abilityMod }];
}

function getWeaponAttackAbility(
  isFinesse: boolean,
  isRanged: boolean,
  monkWeapon: boolean,
  mods: ReturnType<typeof getAbilityModifiers>
): { mod: number; label: string } {
  if (isFinesse) {
    if (mods.dex >= mods.str) {
      return { mod: mods.dex, label: "Dexterity (finesse)" };
    }
    return { mod: mods.str, label: "Strength (finesse)" };
  }
  if (isRanged) return { mod: mods.dex, label: "Dexterity" };
  if (monkWeapon) return { mod: mods.dex, label: "Dexterity (monk weapon)" };
  return { mod: mods.str, label: "Strength" };
}

function getSpellAttackBonusSources(character: CharacterData): AttackBonusSource[] {
  if (character.spells.spellAttackBonusOverride !== undefined) {
    return [{ label: "Override", value: character.spells.spellAttackBonusOverride }];
  }
  const ability = character.spells.spellcastingAbility;
  if (!ability) return [];
  const mods = getAbilityModifiers(character.abilityScores);
  const prof = getProficiencyBonus(character);
  return buildAttackBonusSources(ABILITY_FULL_LABELS[ability], mods[ability], true, prof);
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
  source: "weapon" | "cantrip" | "spell" | "manual" | "natural";
  spellLevel?: number;
  /** Slot level used to cast a leveled spell (may be higher than spellLevel when upcast). */
  castSlotLevel?: number;
  rollType?: OffensiveSpellRollType;
  saveAbility?: string;
  saveDc?: number;
  /** When false, a successful save deals no damage. Default true for save attacks. */
  saveHalfDamageOnSuccess?: boolean;
  /** slug of the catalog item that generated this attack, if any */
  itemId?: string;
  /** Inventory row id for the equipped weapon stack, if any. */
  inventoryStackId?: string;
  /** Catalog spell slug when this attack comes from a spell (for material components, etc.). */
  spellCatalogSlug?: string;
  /** Off-hand weapon attack from two-weapon fighting (bonus action). */
  isOffHand?: boolean;
  /** Weapon damage dice without ability modifier (for bonus-action display). */
  damageDiceWithoutMod?: string;
  /** Two-handed versatile damage with ability modifier (main-hand melee only). */
  versatileDamageDice?: string;
  /** Two-handed versatile damage dice without ability modifier. */
  versatileDamageDiceWithoutMod?: string;
  /** Catalog slug of ammunition consumed per attack, if any. */
  ammunitionItemId?: string;
  /** Display name of the ammunition type. */
  ammunitionName?: string;
  /** Remaining ammunition in inventory when the attack was derived. */
  ammunitionRemaining?: number;
  /** This attack throws the weapon itself (javelin, handaxe, etc.). */
  throwsWeapon?: boolean;
  /** Display name of the thrown weapon. */
  thrownItemName?: string;
  /** Remaining thrown weapons in this stack when derived. */
  thrownRemaining?: number;
  /** Natural weapon available even when a main-hand weapon is wielded (e.g. Lizardfolk Bite). */
  alwaysAvailable?: boolean;
  /** Only offered as a bonus-action attack in combat. */
  bonusActionOnly?: boolean;
  /** Monk bonus unarmed — only after taking the Attack action. */
  monkBonusUnarmed?: boolean;
  /** Breakdown of attack bonus for character sheet tooltips. */
  attackBonusSources?: AttackBonusSource[];
  /** Breakdown of flat damage modifiers for character sheet tooltips. */
  damageBonusSources?: AttackBonusSource[];
}

export type WeaponGrip = "one-handed" | "two-handed";

export function isVersatileWeaponAttack(attack: DerivedAttack): boolean {
  return (
    attack.source === "weapon" &&
    !attack.isOffHand &&
    !attack.throwsWeapon &&
    Boolean(attack.versatileDamageDice)
  );
}

export function resolveWeaponGripDamageDice(
  attack: DerivedAttack,
  grip: WeaponGrip
): string {
  if (grip === "two-handed" && attack.versatileDamageDice) {
    return attack.versatileDamageDice;
  }
  return attack.damageDice;
}

export function formatAttackRollLine(attack: DerivedAttack): string {
  if (attack.rollType === "auto") return "Auto hit";
  if (attack.rollType === "save" && attack.saveDc != null) {
    const ability = attack.saveAbility ? ` ${attack.saveAbility}` : "";
    return `DC ${attack.saveDc}${ability} save`;
  }
  return `${formatModifier(attack.attackBonus)} to hit`;
}

function parseNormalRangeFt(range: string): number {
  const trimmed = range.trim();
  const bandMatch = trimmed.match(/^(\d+)\s*\/\s*\d+\s*ft$/i);
  if (bandMatch) return parseInt(bandMatch[1], 10);
  const singleMatch = trimmed.match(/^(\d+)\s*ft$/i);
  if (singleMatch) return parseInt(singleMatch[1], 10);
  return 5;
}

function parseWeaponRangeBands(
  range: string
): { normalRangeFt: number; longRangeFt: number } | null {
  const match = range.trim().match(/^(\d+)\s*\/\s*(\d+)\s*ft$/i);
  if (!match) return null;
  const normalRangeFt = parseInt(match[1], 10);
  const longRangeFt = parseInt(match[2], 10);
  if (!Number.isFinite(normalRangeFt) || !Number.isFinite(longRangeFt)) return null;
  if (longRangeFt <= normalRangeFt) return null;
  return { normalRangeFt, longRangeFt };
}

export function formatWeaponRangeBandTooltip(range: string): string | null {
  const bands = parseWeaponRangeBands(range);
  if (!bands) return null;
  return [
    `Range: ${bands.normalRangeFt} ft`,
    `Long range: ${bands.longRangeFt} ft`,
    "Attacks beyond normal range and up to long range are made with disadvantage on the attack roll.",
  ].join("\n");
}

export function formatAttackRangeTooltip(attack: DerivedAttack): string | null {
  return formatWeaponRangeBandTooltip(attack.range);
}

/** Weapon attack roll that is not thrown (includes reach melee). */
export function isMeleeWeaponAttack(attack: DerivedAttack): boolean {
  if (attack.source !== "weapon") return false;
  if (attack.throwsWeapon || attack.id.endsWith("-thrown")) return false;
  if ((attack.rollType ?? "attack") !== "attack") return false;
  if (parseWeaponRangeBands(attack.range)) return false;
  return parseNormalRangeFt(attack.range) <= MELEE_REACH_FT;
}

/** Combat tooltip category: Melee, Ranged, Thrown, Spell, Cantrip, etc. */
export function getAttackCategoryLabel(attack: DerivedAttack): string {
  if (attack.source === "cantrip") return "Cantrip";
  if (attack.source === "spell") {
    return attack.spellLevel != null && attack.spellLevel > 0
      ? `Spell ${attack.spellLevel}`
      : "Spell";
  }
  if (attack.throwsWeapon || attack.id.endsWith("-thrown")) return "Thrown";

  const rollType = attack.rollType ?? "attack";
  if (rollType === "attack") {
    if (isMeleeWeaponAttack(attack)) return "Melee";
    if (parseNormalRangeFt(attack.range) > 5) return "Ranged";
    return "Melee";
  }

  if (attack.source === "manual" || attack.source === "natural") return "Melee";
  return "Special";
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
  if (attack.throwsWeapon && attack.thrownItemName != null && attack.thrownRemaining != null) {
    parts.push(formatThrownWeaponLine(attack.thrownItemName, attack.thrownRemaining));
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

export { hasTwoWeaponFighting } from "@/lib/dnd/fighting-styles";

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
  const monkMartialArts = hasMonkMartialArts(character, catalogClasses);

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
    const monkWeapon = monkMartialArts && isMonkWeapon(catalogItem);

    const { mod: abilityMod, label: abilityLabel } = getWeaponAttackAbility(
      isFinesse,
      isRanged,
      monkWeapon,
      mods
    );

    const proficient = isProficientWithWeapon(
      character,
      wp.weaponCategory,
      catalogItem.name,
      catalogItem.slug,
      catalogClasses
    );
    const attackBonus = abilityMod + (proficient ? prof : 0);
    const attackBonusSources = buildAttackBonusSources(abilityLabel, abilityMod, proficient, prof);
    const damageBonusSources = buildDamageBonusSources(abilityLabel, abilityMod);
    const baseName = invItem.name || catalogItem.name;

    const usesAmmunition = isRanged && weaponUsesAmmunition(catalogItem);
    const throwsWeapon = weaponConsumesSelfWhenThrown(catalogItem);
    const isMeleeThrowable = !isRanged && isThrown && wp.throwRangeNormal != null;
    const throwRange = isThrown && wp.throwRangeNormal
      ? `${wp.throwRangeNormal}/${wp.throwRangeLong ?? wp.throwRangeNormal * 3} ft`
      : "";
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

    const hasReach = wp.weaponProperties.includes("reach");
    const meleeRangeFt = hasReach ? MELEE_REACH_FT : 5;
    const meleeRange = `${meleeRangeFt} ft`;

    let singleRange = "";
    if (isRanged && wp.rangeNormal) {
      singleRange = `${wp.rangeNormal}/${wp.rangeLong ?? wp.rangeNormal * 4} ft`;
    } else if (isThrown && wp.throwRangeNormal) {
      singleRange = throwRange;
    } else if (!isRanged) {
      singleRange = meleeRange;
    }

    const addAttack = (isOffHand: boolean, mode: "single" | "melee" | "thrown") => {
      const baseDice = wp.damage ?? "—";
      const isThrownAttackMode = mode === "thrown";
      const archeryBonus = getArcheryAttackBonus(
        character,
        isRanged && !isThrownAttackMode,
        catalogClasses
      );
      const duelingBonus = getDuelingDamageBonus(
        character,
        catalogItems,
        {
          isOffHand,
          isRanged,
          isThrown: isThrownAttackMode,
          catalogItem,
        },
        catalogClasses
      );
      const attackBonusWithStyles = attackBonus + archeryBonus;
      const attackBonusSourcesWithStyles = [...attackBonusSources];
      if (archeryBonus > 0) {
        attackBonusSourcesWithStyles.push({ label: "Archery", value: archeryBonus });
      }
      const damageMod = abilityMod + duelingBonus;
      const damageBonusSourcesWithStyles = [...damageBonusSources];
      if (duelingBonus > 0) {
        damageBonusSourcesWithStyles.push({ label: "Dueling", value: duelingBonus });
      }
      const damageDiceStr = formatDamageDice(baseDice, damageMod, true);
      const damageDiceWithoutMod = baseDice;

      const offHandSuffix = isOffHand ? " (off-hand)" : "";
      const name =
        mode === "thrown"
          ? `${baseName}${offHandSuffix} (thrown)`
          : isOffHand
            ? `${baseName} (off-hand)`
            : baseName;

      const idSuffix = isOffHand ? "-off" : "";
      const modeSuffix = mode === "single" ? "" : `-${mode}`;

      const versatileDamageDice =
        mode !== "thrown" &&
        wp.weaponProperties.includes("versatile") &&
        wp.versatileDamage &&
        !isOffHand
          ? formatDamageDice(wp.versatileDamage, damageMod, true)
          : undefined;
      const versatileDamageDiceWithoutMod =
        versatileDamageDice != null ? wp.versatileDamage : undefined;

      const notes: string[] = [];
      if (versatileDamageDice) {
        notes.push(`Versatile (two-handed): ${versatileDamageDice}`);
      }
      if (wp.weaponProperties.includes("finesse")) notes.push("Finesse");
      if (monkWeapon) notes.push("Monk weapon");

      const attackRange =
        mode === "thrown" ? throwRange : isRanged ? singleRange : meleeRange;
      const isThrownAttack = mode === "thrown" && throwsWeapon;

      attacks.push({
        id: `weapon-${invItem.id}${idSuffix}${modeSuffix}`,
        name,
        attackBonus: attackBonusWithStyles,
        attackBonusSources: attackBonusSourcesWithStyles,
        damageBonusSources: damageBonusSourcesWithStyles,
        damageDice: damageDiceStr,
        damageDiceWithoutMod,
        versatileDamageDice,
        versatileDamageDiceWithoutMod,
        damageType: wp.damageType,
        range: attackRange,
        notes: notes.join(", "),
        source: "weapon",
        itemId: invItem.itemId,
        inventoryStackId: invItem.id,
        isOffHand,
        ammunitionItemId: ammunitionItemId ?? undefined,
        ammunitionName,
        ammunitionRemaining,
        throwsWeapon: isThrownAttack || undefined,
        thrownItemName: isThrownAttack ? baseName : undefined,
        thrownRemaining: isThrownAttack ? invItem.quantity : undefined,
      });
    };

    const addAttacksForWield = (isOffHand: boolean) => {
      if (isMeleeThrowable) {
        addAttack(isOffHand, "melee");
        addAttack(isOffHand, "thrown");
      } else {
        addAttack(isOffHand, "single");
      }
    };

    if (mainHand) addAttacksForWield(false);
    if (offHand) addAttacksForWield(true);
  }

  return attacks;
}

function buildNaturalAttackEntry(
  spec: NaturalAttackSpec,
  character: CharacterData,
  catalogClasses?: PhbClass[]
): DerivedAttack {
  const mods = getAbilityModifiers(character.abilityScores);
  const prof = getProficiencyBonus(character);
  const monk = hasMonkMartialArts(character, catalogClasses);
  const level = getCharacterLevel(character);
  const useMonkRules = monk && spec.isUnarmedStrike;
  const abilityMod = useMonkRules ? mods.dex : mods.str;
  const abilityLabel = useMonkRules ? "Dexterity (monk unarmed)" : "Strength";
  const damageDice = resolveUnarmedDamageDie(
    spec.baseDice,
    useMonkRules ? level : null
  );
  const proficient = spec.proficient || !!(monk && spec.isUnarmedStrike);
  const attackBonus = abilityMod + (proficient ? prof : 0);
  const attackBonusSources = buildAttackBonusSources(abilityLabel, abilityMod, proficient, prof);
  const damageBonusSources = buildDamageBonusSources(abilityLabel, abilityMod);
  const damageDiceStr = formatDamageDice(damageDice, abilityMod, true);

  return {
    id: spec.id,
    name: spec.name,
    attackBonus,
    attackBonusSources,
    damageBonusSources,
    damageDice: damageDiceStr,
    damageDiceWithoutMod: damageDice,
    damageType: spec.damageType,
    range: "5 ft",
    notes: spec.notes ?? "",
    source: "natural",
    alwaysAvailable: spec.alwaysAvailable,
    bonusActionOnly: spec.bonusActionOnly,
    monkBonusUnarmed: spec.id === "unarmed-strike-bonus",
  };
}

/** Derive unarmed strikes and species natural weapons for this character. */
export function deriveNaturalAttacks(
  character: CharacterData,
  catalogClasses?: PhbClass[]
): DerivedAttack[] {
  return getNaturalAttackSpecs(character, catalogClasses).map((spec) =>
    buildNaturalAttackEntry(spec, character, catalogClasses)
  );
}

/** @deprecated Use deriveNaturalAttacks or getAllAttacks */
export function deriveUnarmedStrike(
  character: CharacterData,
  catalogClasses?: PhbClass[]
): DerivedAttack {
  const attacks = deriveNaturalAttacks(character, catalogClasses);
  return (
    attacks.find((a) => a.id === "unarmed-strike") ?? {
      id: "unarmed-strike",
      name: "Unarmed Strike",
      attackBonus: getAbilityModifiers(character.abilityScores).str,
      damageDice: "1",
      damageType: "bludgeoning",
      range: "5 ft",
      notes: "",
      source: "natural",
    }
  );
}

function buildOffensiveSpellEntry(
  spell: Spell,
  meta: OffensiveSpellMeta,
  character: CharacterData,
  saveDc: number | undefined,
  characterLevel: number,
  castSlotLevel?: number
): DerivedAttack {
  const attackBonus = getSpellAttackBonus(character) ?? 0;
  const attackBonusSources =
    meta.rollType === "attack" ? getSpellAttackBonusSources(character) : undefined;
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

  const effectiveCastLevel = castSlotLevel ?? spell.level;
  if (effectiveCastLevel > 0) {
    noteParts.unshift(
      `${effectiveCastLevel}${spellLevelSuffix(effectiveCastLevel)}-level spell`
    );
  }

  const slug = resolveSpellSlug(spell);

  return {
    id: `spell-${spell.id}`,
    name: spell.name,
    attackBonus,
    attackBonusSources,
    damageDice,
    damageType: meta.damageType,
    range: meta.range,
    notes: noteParts.join(" · "),
    source: spell.level === 0 ? "cantrip" : "spell",
    spellLevel: spell.level,
    castSlotLevel: effectiveCastLevel > 0 ? effectiveCastLevel : undefined,
    spellCatalogSlug: slug ?? undefined,
    rollType: meta.rollType,
    saveAbility: meta.saveAbility,
    saveDc: meta.rollType === "save" ? saveDc : undefined,
    saveHalfDamageOnSuccess:
      meta.rollType === "save" ? meta.saveHalfDamageOnSuccess ?? true : undefined,
  };
}

/** Build a single offensive spell attack for combat casting (supports upcast slot level). */
export function buildSpellAttackForCast(
  character: CharacterData,
  spell: Spell,
  castSlotLevel: number
): DerivedAttack | null {
  if (spell.level > 0) return null;
  if (!character.spells.spellcastingAbility) return null;

  const slug = resolveSpellSlug(spell);
  if (!slug) return null;

  const meta = OFFENSIVE_SPELL_METADATA[slug];
  if (!meta) return null;

  const saveDc = getSpellSaveDc(character) ?? undefined;
  const characterLevel = getCharacterLevel(character);

  return buildOffensiveSpellEntry(
    spell,
    meta,
    character,
    saveDc,
    characterLevel,
    castSlotLevel
  );
}

function spellLevelSuffix(level: number): string {
  if (level === 1) return "st";
  if (level === 2) return "nd";
  if (level === 3) return "rd";
  return "th";
}

/** Derive attack buttons from offensive cantrips only. Leveled spells use declare-cast + DM review. */
export function deriveSpellAttacks(character: CharacterData): DerivedAttack[] {
  if (!character.spells.spellcastingAbility) return [];

  const saveDc = getSpellSaveDc(character) ?? undefined;
  const characterLevel = getCharacterLevel(character);

  const attacks: DerivedAttack[] = [];

  for (const spell of character.spells.known) {
    if (spell.level > 0) continue;
    if (isManagedGrantSpell(spell) && !canCastGrantSpell(spell, character)) {
      continue;
    }

    const slug = resolveSpellSlug(spell);
    if (!slug) continue;

    const catalog = getSpell(slug);
    if (!catalog || !isSpellCastableInCombat(catalog)) continue;

    const meta = OFFENSIVE_SPELL_METADATA[slug];
    if (!meta) continue;

    attacks.push(
      buildOffensiveSpellEntry(spell, meta, character, saveDc, characterLevel)
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
  const natural = deriveNaturalAttacks(character, catalogClasses);
  const manual: DerivedAttack[] = character.attacks.map((a) => ({
    ...a,
    source: "manual" as const,
  }));

  return [...weapon, ...spells, ...natural, ...manual];
}
