import {
  characterDataSchema,
  normalizeCustomAbilityMods,
  stripDmNotesFromCharacterData,
  type CharacterData,
} from "@/lib/schemas/character";
import { averageLevelUpHpGain, stripConFromLevelUpHpGains } from "@/lib/character/combat-derivation";
import { syncSavingThrowsFromClass } from "@/lib/character/class-derivation";
import { syncAcFromEquipment } from "@/lib/character/ac-derivation";
import { sanitizeEquippedItems } from "@/lib/character/equip-rules";
import { ensureUniqueInventoryIds } from "@/lib/character/inventory-stack";
import { stripGrantedFeaturesForSave } from "@/lib/character/feature-derivation";
import { migrateFeatureChoices } from "@/lib/character/feature-choices";
import { migrateSkillKeys } from "@/lib/character/skill-migration";
import { resolveCharacterClass } from "@/lib/character/class-derivation";
import { syncFeatureGrants } from "@/lib/character/feature-grant-sync";
import { migrateLanguageChoices } from "@/lib/character/language-choices";
import { normalizeCombatConditions } from "@/lib/dnd/conditions";
import { syncSpellcastingFromClass, migrateFullListPreparedCasterSpells } from "@/lib/dnd/spellcasting";
import { getCharacterLevel, levelFromXp, xpForLevel } from "@/lib/dnd/xp";
import { abilityModifier } from "@/lib/dnd/calculations";
import type { Character } from "@/lib/types/database";

export type ParsedCharacter = Omit<Character, "data"> & { data: CharacterData };

// ---------------------------------------------------------------------------
// Name → catalog slug mapping for migrating existing saves.
// Keys are normalised (lowercase, no punctuation variants). Values are slugs
// in the items table. Only entries that differ from the naive slug derivation
// need to be listed explicitly.
// ---------------------------------------------------------------------------
/** Slugs removed from the catalog — re-resolve from display name on load. */
const REMOVED_ITEM_SLUGS = new Set(["artisans-tools", "musical-instrument"]);

const NAME_TO_SLUG: Record<string, string> = {
  // weapons
  "light crossbow": "light-crossbow",
  "hand crossbow": "hand-crossbow",
  "heavy crossbow": "heavy-crossbow",
  "war pick": "war-pick",
  "light hammer": "light-hammer",
  "short sword": "shortsword",
  "belaying pin (club)": "belaying-pin",
  "belaying pin": "belaying-pin",
  // armor
  "padded armor": "padded-armor",
  "padded armour": "padded-armor",
  "leather armor": "leather-armor",
  "leather armour": "leather-armor",
  "studded leather armor": "studded-leather",
  "studded leather armour": "studded-leather",
  "studded leather": "studded-leather",
  "hide armor": "hide-armor",
  "hide armour": "hide-armor",
  "chain shirt": "chain-shirt",
  "scale mail": "scale-mail",
  "half plate": "half-plate",
  "half-plate armor": "half-plate",
  "ring mail": "ring-mail",
  "chain mail": "chain-mail",
  "splint armor": "splint-armor",
  "splint armour": "splint-armor",
  "plate armor": "plate-armor",
  "plate armour": "plate-armor",
  "full plate": "plate-armor",
  // tools / packs
  "thieves' tools": "thieves-tools",
  "thieves tools": "thieves-tools",
  "healer's kit": "healers-kit",
  "healers kit": "healers-kit",
  "herbalism kit": "herbalism-kit",
  "forgery kit": "forgery-kit",
  "disguise kit": "disguise-kit",
  "navigator's tools": "navigators-tools",
  "navigators tools": "navigators-tools",
  "cartographer's tools": "cartographers-tools",
  "burglar's pack": "burglars-pack",
  "dungeoneers pack": "dungeoneers-pack",
  "dungeoneer's pack": "dungeoneers-pack",
  "explorer's pack": "explorers-pack",
  "explorers pack": "explorers-pack",
  "diplomat's pack": "diplomats-pack",
  "diplomats pack": "diplomats-pack",
  "entertainer's pack": "entertainers-pack",
  "entertainers pack": "entertainers-pack",
  "priest's pack": "priests-pack",
  "priests pack": "priests-pack",
  "scholar's pack": "scholars-pack",
  "scholars pack": "scholars-pack",
  // gear
  "hempen rope": "rope-hempen",
  "rope, hempen (50 feet)": "rope-hempen",
  "silk rope": "rope-silk",
  "rope, silk (50 feet)": "rope-silk",
  "ball bearings": "ball-bearings",
  "tinderbox": "tinderbox",
  "hunting trap": "hunting-trap",
  "hourglass": "hourglass",
  "magnifying glass": "magnifying-glass",
  "grappling hook": "grappling-hook",
  "signal whistle": "signal-whistle",
  "signet ring": "signet-ring",
  "sealing wax": "sealing-wax",
  "iron pot": "iron-pot",
  "pot, iron": "iron-pot",
  "lantern, bullseye": "lantern-bullseye",
  "lantern, hooded": "lantern-hooded",
  "lantern bullseye": "lantern-bullseye",
  "lantern hooded": "lantern-hooded",
  "glass bottle": "bottle-glass",
  "merchant's scale": "scale-merchants",
  "merchants scale": "scale-merchants",
  "miner's pick": "pick-miners",
  "miners pick": "pick-miners",
  "steel mirror": "mirror-steel",
  "mirror steel": "mirror-steel",
  "oil (flask)": "oil-flask",
  "oil flask": "oil-flask",
  "poison, basic (vial)": "poison-basic",
  "basic poison": "poison-basic",
  "portable ram": "ram-portable",
  "block and tackle": "block-and-tackle",
  "map or scroll case": "case-map",
  "crossbow bolt case": "case-crossbow",
  "crossbow bolts": "crossbow-bolt",
  "crossbow bolt": "crossbow-bolt",
  // foci
  "arcane focus": "arcane-focus",
  "druidic focus": "druidic-focus",
  "holy symbol": "holy-symbol",
  "component pouch": "component-pouch",
  // misc
  "two-person tent": "tent-two-person",
  "two person tent": "tent-two-person",
  "tent (two-person)": "tent-two-person",
  "hempen rope (50 feet)": "rope-hempen",
  "rations (1 day)": "rations",
  "1 day's rations": "rations",
  "fine clothes": "clothes-fine",
  "common clothes": "clothes-common",
  "traveler's clothes": "clothes-travelers",
  "costume clothes": "clothes-costume",
  "costume": "clothes-costume",
  "winter blanket": "blanket",
  "belt pouch": "belt-pouch",
  "deck of cards": "deck-of-cards",
  "playing cards": "deck-of-cards",
  "playing card set": "playing-card-set",
  "quill": "ink-pen",
  "ink pen": "ink-pen",
  "bottle of black ink": "ink",
  "ink (1 oz. bottle)": "ink",
  "staff": "walking-staff",
  "scroll of pedigree": "scroll-pedigree",
  "map of hometown": "map-hometown",
  "scroll case of notes": "scroll-case-notes",
  "letter of introduction from guild": "letter-of-introduction",
  "incense (5 sticks)": "incense-5-sticks",
  "block of incense": "block-of-incense",
  "blocks of incense": "block-of-incense",
  "little bag of sand": "little-bag-of-sand",
  "bag of sand": "little-bag-of-sand",
  "empty waterskin": "empty-waterskin",
  "tej": "tej",
  "tej (mug)": "tej",
  "prayer book": "prayer-book",
  "prayer wheel": "prayer-wheel",
  "con tools (10 gp)": "con-tools",
  "letter from dead colleague": "letter-dead-colleague",
  "token from parents": "parent-token",
  "trophy from fallen enemy": "trophy-enemy",
  "trophy from animal": "trophy-animal",
  "dark common clothes with hood": "dark-hooded-clothes",
  "50 feet silk rope": "rope-silk",
  "silk rope (50 feet)": "rope-silk",
  "insignia of rank": "insignia-of-rank",
  "insignia rank": "insignia-of-rank",
  "signal horn": "signal-horn",
};

function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Derive a candidate slug from a free-text item name. */
function nameToSlug(name: string): string {
  return normalise(name)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

/**
 * Try to resolve a free-text item name to a catalog slug.
 * Returns the slug if a match is found, otherwise null.
 */
function resolveSlug(name: string): string | null {
  const key = normalise(name);
  if (NAME_TO_SLUG[key]) return NAME_TO_SLUG[key];
  // Try the slug directly (e.g. "longsword" → "longsword")
  const slug = nameToSlug(name);
  return slug || null;
}

/**
 * One-time migration applied on read. Safe to run on already-migrated data.
 *
 * - Adds `itemId` to inventory items matchable to the catalog by name.
 * - Seeds `basicInfo.xp` from `basicInfo.level` for saves that predate XP tracking.
 * - Coerces `customAbilityMods` values to integers (form saves may store strings).
 */
function migrateCharacterData(raw: Record<string, unknown>): Record<string, unknown> {
  // --- XP migration ---
  const basicInfo = raw.basicInfo as Record<string, unknown> | undefined;
  if (basicInfo && basicInfo.xp === undefined) {
    const storedLevel = typeof basicInfo.level === "number" ? basicInfo.level : 1;
    basicInfo.xp = xpForLevel(Math.max(1, storedLevel));
    raw = { ...raw, basicInfo: { ...basicInfo } };
  }

  // Seed committed level from XP for legacy saves that never had level set
  if (basicInfo) {
    const xp =
      typeof basicInfo.xp === "number" ? basicInfo.xp : 0;
    const storedLevel = typeof basicInfo.level === "number" ? basicInfo.level : 0;
    if (storedLevel < 1) {
      raw = {
        ...raw,
        basicInfo: {
          ...basicInfo,
          level: levelFromXp(xp),
        },
      };
    }
  }

  // --- Custom ability mod migration ---
  raw = {
    ...raw,
    customAbilityMods: normalizeCustomAbilityMods(raw.customAbilityMods),
  };

  // --- Feature choices (class/species customizable features) ---
  raw = migrateFeatureChoices(raw as unknown as CharacterData) as Record<string, unknown>;

  // --- Language choices (species / background picks) ---
  raw = migrateLanguageChoices(raw as unknown as CharacterData) as Record<string, unknown>;

  // --- Skill keys (display-name keys from pre-schema saves) ---
  raw = migrateSkillKeys(raw as unknown as CharacterData) as Record<string, unknown>;

  // --- Combat conditions (legacy display names → catalog slugs) ---
  const combat = raw.combat as Record<string, unknown> | undefined;
  if (combat && Array.isArray(combat.conditions)) {
    raw = {
      ...raw,
      combat: {
        ...combat,
        conditions: normalizeCombatConditions(combat.conditions as string[]),
      },
    };
  }

  // --- Level-up HP gains: strip bundled CON from legacy saves ---
  const combatRaw = raw.combat as Record<string, unknown> | undefined;
  const charData = raw as unknown as CharacterData;
  if (combatRaw) {
    const existingGains = combatRaw.levelUpHpGains;
    const hpGainsDieOnly = combatRaw.hpGainsDieOnly === true;
    if (
      !hpGainsDieOnly &&
      Array.isArray(existingGains) &&
      existingGains.length > 0
    ) {
      const conMod = abilityModifier(charData.abilityScores.con);
      raw = {
        ...raw,
        combat: {
          ...combatRaw,
          levelUpHpGains: stripConFromLevelUpHpGains(
            existingGains as number[],
            conMod
          ),
          hpGainsDieOnly: true,
        },
      };
    }
  }

  // --- Level-up HP gains backfill for characters above level 1 ---
  const combatAfterMigration = raw.combat as Record<string, unknown> | undefined;
  const committedLevel = getCharacterLevel(charData);
  const existingGains = combatAfterMigration?.levelUpHpGains;
  if (
    committedLevel > 1 &&
    (!Array.isArray(existingGains) || existingGains.length === 0)
  ) {
    const avgGain = averageLevelUpHpGain(charData);
    const gains = Array.from({ length: committedLevel - 1 }, () => avgGain);
    raw = {
      ...raw,
      combat: {
        ...(combatAfterMigration ?? {}),
        levelUpHpGains: gains,
        hpGainsDieOnly: true,
      },
    };
  }

  // --- Spellcasting ability, slots, and cantrip preparation from class ---
  const spellClass = resolveCharacterClass(raw as unknown as CharacterData);
  const spellLevel = getCharacterLevel(raw as unknown as CharacterData);
  if (spellClass?.spellcasting) {
    let migrated = raw as unknown as CharacterData;
    migrated = migrateFullListPreparedCasterSpells(migrated, spellClass);
    raw = {
      ...raw,
      spells: syncSpellcastingFromClass(
        migrated,
        spellClass,
        spellLevel
      ),
    };
  }

  // --- Saving throws from class (not manually edited) ---
  raw = {
    ...raw,
    savingThrows: syncSavingThrowsFromClass(raw as unknown as CharacterData),
  };

  // --- Item catalog migration ---
  const inventory = raw.inventory as Record<string, unknown> | undefined;
  if (!inventory) {
    return syncAcFromEquipment(
      syncFeatureGrants(
        stripGrantedFeaturesForSave(raw as unknown as CharacterData)
      )
    ) as Record<string, unknown>;
  }

  const items = inventory.items;
  if (!Array.isArray(items)) {
    return syncAcFromEquipment(
      syncFeatureGrants(
        stripGrantedFeaturesForSave(raw as unknown as CharacterData)
      )
    ) as Record<string, unknown>;
  }

  const migratedItems = items.map((item: unknown) => {
    if (typeof item !== "object" || item === null) return item;
    const entry = item as Record<string, unknown>;

    const name = typeof entry.name === "string" ? entry.name : "";

    const existingId =
      typeof entry.itemId === "string" ? entry.itemId : undefined;
    if (existingId && !REMOVED_ITEM_SLUGS.has(existingId)) {
      return entry;
    }

    if (!name) return entry;

    const slug = resolveSlug(name);
    if (!slug) {
      if (existingId) {
        const { itemId: _removed, ...rest } = entry;
        return rest;
      }
      return entry;
    }

    return { ...entry, itemId: slug };
  });

  const speciesName =
    (raw as { basicInfo?: { species?: string } }).basicInfo?.species ?? "";

  return syncAcFromEquipment(
    syncFeatureGrants(
      stripGrantedFeaturesForSave({
        ...(raw as unknown as CharacterData),
        inventory: {
          ...inventory,
          items: sanitizeEquippedItems(
            ensureUniqueInventoryIds(
              migratedItems as CharacterData["inventory"]["items"]
            ),
            {},
            speciesName
          ),
        },
      } as CharacterData)
    )
  ) as Record<string, unknown>;
}

export function parseCharacterRow(row: Character, isDm: boolean): ParsedCharacter {
  const migrated = migrateCharacterData(
    (row.data ?? {}) as Record<string, unknown>
  );
  const data = characterDataSchema.parse(migrated);
  return {
    ...row,
    data: isDm ? data : stripDmNotesFromCharacterData(data),
  };
}

export function syncCharacterTopLevelFields(
  name: string,
  playerName: string,
  data: CharacterData
): CharacterData {
  return {
    ...data,
    basicInfo: {
      ...data.basicInfo,
      name: name || data.basicInfo.name,
      playerName: playerName || data.basicInfo.playerName,
    },
  };
}
