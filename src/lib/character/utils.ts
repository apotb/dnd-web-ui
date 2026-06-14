import {
  characterDataSchema,
  stripDmNotesFromCharacterData,
  type CharacterData,
} from "@/lib/schemas/character";
import { xpForLevel } from "@/lib/dnd/xp";
import {
  combatantDataSchema,
  stripDmNotesFromCombatantData,
  type CombatantData,
} from "@/lib/schemas/combat";
import type { Character, EncounterCombatant } from "@/lib/types/database";

export type ParsedCharacter = Omit<Character, "data"> & { data: CharacterData };
export type ParsedCombatant = Omit<EncounterCombatant, "data"> & {
  data: CombatantData;
};

// ---------------------------------------------------------------------------
// Name → catalog slug mapping for migrating existing saves.
// Keys are normalised (lowercase, no punctuation variants). Values are slugs
// in the items table. Only entries that differ from the naive slug derivation
// need to be listed explicitly.
// ---------------------------------------------------------------------------
const NAME_TO_SLUG: Record<string, string> = {
  // weapons
  "light crossbow": "light-crossbow",
  "hand crossbow": "hand-crossbow",
  "heavy crossbow": "heavy-crossbow",
  "war pick": "war-pick",
  "light hammer": "light-hammer",
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
  "artisan's tools": "artisans-tools",
  "artisans tools": "artisans-tools",
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
  "playing cards": "deck-of-cards",
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
 */
function migrateCharacterData(raw: Record<string, unknown>): Record<string, unknown> {
  // --- XP migration ---
  const basicInfo = raw.basicInfo as Record<string, unknown> | undefined;
  if (basicInfo && basicInfo.xp === undefined) {
    const storedLevel = typeof basicInfo.level === "number" ? basicInfo.level : 1;
    basicInfo.xp = xpForLevel(Math.max(1, storedLevel));
    raw = { ...raw, basicInfo: { ...basicInfo } };
  }

  // --- Item catalog migration ---
  const inventory = raw.inventory as Record<string, unknown> | undefined;
  if (!inventory) return raw;

  const items = inventory.items;
  if (!Array.isArray(items)) return raw;

  const migratedItems = items.map((item: unknown) => {
    if (typeof item !== "object" || item === null) return item;
    const entry = item as Record<string, unknown>;

    // Already has an itemId — nothing to do
    if (entry.itemId) return entry;

    const name = typeof entry.name === "string" ? entry.name : "";
    if (!name) return entry;

    const slug = resolveSlug(name);
    if (!slug) return entry;

    return { ...entry, itemId: slug };
  });

  return {
    ...raw,
    inventory: { ...inventory, items: migratedItems },
  };
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

export function parseCombatantRow(
  row: EncounterCombatant,
  isDm: boolean
): ParsedCombatant {
  const data = combatantDataSchema.parse(row.data);
  return {
    ...row,
    data: isDm ? data : stripDmNotesFromCombatantData(data),
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
