import type { PhbItem } from "./types";

/** PHB equipment and pack contents with approximate weights (lb). */
export const PHB_ITEMS: PhbItem[] = [
  { id: "abacus", name: "Abacus", weightLb: 2, type: "gear" },
  { id: "acid-vial", name: "Acid (vial)", weightLb: 1, type: "consumable" },
  { id: "alchemists-fire", name: "Alchemist's fire (flask)", weightLb: 1, type: "consumable" },
  { id: "arrow", name: "Arrow", weightLb: 0.05, type: "ammunition" },
  { id: "backpack", name: "Backpack", weightLb: 5, type: "container" },
  { id: "ball-bearings", name: "Ball bearings (bag of 1,000)", weightLb: 2, type: "gear" },
  { id: "barrel", name: "Barrel", weightLb: 70, type: "container" },
  { id: "basket", name: "Basket", weightLb: 2, type: "container" },
  { id: "bedroll", name: "Bedroll", weightLb: 7, type: "gear" },
  { id: "bell", name: "Bell", weightLb: 0, type: "gear" },
  { id: "blanket", name: "Blanket", weightLb: 3, type: "gear" },
  { id: "block-and-tackle", name: "Block and tackle", weightLb: 5, type: "gear" },
  { id: "book", name: "Book", weightLb: 5, type: "gear" },
  { id: "bottle-glass", name: "Bottle, glass", weightLb: 2, type: "gear" },
  { id: "bucket", name: "Bucket", weightLb: 2, type: "gear" },
  { id: "caltrops", name: "Caltrops (bag of 20)", weightLb: 2, type: "gear" },
  { id: "candle", name: "Candle", weightLb: 0, type: "gear" },
  { id: "case-crossbow", name: "Case, crossbow bolt", weightLb: 1, type: "container" },
  { id: "case-map", name: "Case, map or scroll", weightLb: 1, type: "container" },
  { id: "chain", name: "Chain (10 feet)", weightLb: 10, type: "gear" },
  { id: "chalk", name: "Chalk (1 piece)", weightLb: 0, type: "gear" },
  { id: "chest", name: "Chest", weightLb: 25, type: "container" },
  { id: "clothes-common", name: "Clothes, common", weightLb: 3, type: "gear" },
  { id: "clothes-costume", name: "Clothes, costume", weightLb: 4, type: "gear" },
  { id: "clothes-fine", name: "Clothes, fine", weightLb: 6, type: "gear" },
  { id: "clothes-travelers", name: "Clothes, traveler's", weightLb: 4, type: "gear" },
  { id: "component-pouch", name: "Component pouch", weightLb: 2, type: "focus" },
  { id: "crowbar", name: "Crowbar", weightLb: 5, type: "gear" },
  { id: "crossbow-bolt", name: "Crossbow bolt", weightLb: 0.075, type: "ammunition" },
  { id: "flask", name: "Flask or tankard", weightLb: 1, type: "gear" },
  { id: "grappling-hook", name: "Grappling hook", weightLb: 4, type: "gear" },
  { id: "hammer", name: "Hammer", weightLb: 3, type: "gear" },
  { id: "hammer-sledge", name: "Hammer, sledge", weightLb: 10, type: "gear" },
  { id: "healers-kit", name: "Healer's kit", weightLb: 3, type: "gear" },
  { id: "holy-symbol", name: "Holy symbol", weightLb: 1, type: "focus" },
  { id: "holy-water", name: "Holy water (flask)", weightLb: 1, type: "consumable" },
  { id: "hourglass", name: "Hourglass", weightLb: 1, type: "gear" },
  { id: "hunting-trap", name: "Hunting trap", weightLb: 25, type: "gear" },
  { id: "ink", name: "Ink (1 ounce bottle)", weightLb: 0, type: "gear" },
  { id: "ink-pen", name: "Ink pen", weightLb: 0, type: "gear" },
  { id: "iron-pot", name: "Iron pot", weightLb: 10, type: "gear" },
  { id: "jug", name: "Jug or pitcher", weightLb: 4, type: "gear" },
  { id: "ladder", name: "Ladder (10-foot)", weightLb: 25, type: "gear" },
  { id: "lamp", name: "Lamp", weightLb: 1, type: "gear" },
  { id: "lantern-bullseye", name: "Lantern, bullseye", weightLb: 2, type: "gear" },
  { id: "lantern-hooded", name: "Lantern, hooded", weightLb: 2, type: "gear" },
  { id: "lock", name: "Lock", weightLb: 1, type: "gear" },
  { id: "magnifying-glass", name: "Magnifying glass", weightLb: 0, type: "gear" },
  { id: "manacles", name: "Manacles", weightLb: 6, type: "gear" },
  { id: "mirror-steel", name: "Mirror, steel", weightLb: 0.5, type: "gear" },
  { id: "oil-flask", name: "Oil (flask)", weightLb: 1, type: "consumable" },
  { id: "paper", name: "Paper (one sheet)", weightLb: 0, type: "gear" },
  { id: "parchment", name: "Parchment (one sheet)", weightLb: 0, type: "gear" },
  { id: "perfume", name: "Perfume (vial)", weightLb: 0, type: "gear" },
  { id: "pick-miners", name: "Pick, miner's", weightLb: 10, type: "gear" },
  { id: "piton", name: "Piton", weightLb: 0.25, type: "gear" },
  { id: "poison-basic", name: "Poison, basic (vial)", weightLb: 0, type: "consumable" },
  { id: "pole", name: "Pole (10-foot)", weightLb: 7, type: "gear" },
  { id: "pouch", name: "Pouch", weightLb: 1, type: "container" },
  { id: "quiver", name: "Quiver", weightLb: 1, type: "container" },
  { id: "ram-portable", name: "Ram, portable", weightLb: 35, type: "gear" },
  { id: "rations", name: "Rations (1 day)", weightLb: 2, type: "consumable" },
  { id: "robes", name: "Robes", weightLb: 4, type: "gear" },
  { id: "rope-hempen", name: "Rope, hempen (50 feet)", weightLb: 10, type: "gear" },
  { id: "rope-silk", name: "Rope, silk (50 feet)", weightLb: 5, type: "gear" },
  { id: "sack", name: "Sack", weightLb: 0.5, type: "container" },
  { id: "scale-merchants", name: "Scale, merchant's", weightLb: 3, type: "gear" },
  { id: "sealing-wax", name: "Sealing wax", weightLb: 0, type: "gear" },
  { id: "shovel", name: "Shovel", weightLb: 5, type: "gear" },
  { id: "signal-whistle", name: "Signal whistle", weightLb: 0, type: "gear" },
  { id: "signet-ring", name: "Signet ring", weightLb: 0, type: "gear" },
  { id: "signal-horn", name: "Signal horn", weightLb: 2, type: "gear" },
  { id: "soap", name: "Soap", weightLb: 0, type: "gear" },
  { id: "spellbook", name: "Spellbook", weightLb: 3, type: "gear" },
  { id: "spikes-iron", name: "Spikes, iron (10)", weightLb: 5, type: "gear" },
  { id: "spyglass", name: "Spyglass", weightLb: 1, type: "gear" },
  { id: "tent-two-person", name: "Tent, two-person", weightLb: 20, type: "gear" },
  { id: "tinderbox", name: "Tinderbox", weightLb: 1, type: "gear" },
  { id: "torch", name: "Torch", weightLb: 1, type: "gear" },
  { id: "vial", name: "Vial", weightLb: 0, type: "gear" },
  { id: "waterskin", name: "Waterskin", weightLb: 5, type: "gear" },
  { id: "whetstone", name: "Whetstone", weightLb: 1, type: "gear" },
  // Weapons
  { id: "club", name: "Club", weightLb: 2, type: "weapon" },
  { id: "dagger", name: "Dagger", weightLb: 1, type: "weapon" },
  { id: "greatclub", name: "Greatclub", weightLb: 10, type: "weapon" },
  { id: "handaxe", name: "Handaxe", weightLb: 2, type: "weapon" },
  { id: "javelin", name: "Javelin", weightLb: 2, type: "weapon" },
  { id: "light-hammer", name: "Light hammer", weightLb: 2, type: "weapon" },
  { id: "mace", name: "Mace", weightLb: 4, type: "weapon" },
  { id: "quarterstaff", name: "Quarterstaff", weightLb: 4, type: "weapon" },
  { id: "sickle", name: "Sickle", weightLb: 2, type: "weapon" },
  { id: "spear", name: "Spear", weightLb: 3, type: "weapon" },
  { id: "light-crossbow", name: "Light crossbow", weightLb: 5, type: "weapon" },
  { id: "dart", name: "Dart", weightLb: 0.25, type: "weapon" },
  { id: "shortbow", name: "Shortbow", weightLb: 2, type: "weapon" },
  { id: "sling", name: "Sling", weightLb: 0, type: "weapon" },
  { id: "battleaxe", name: "Battleaxe", weightLb: 4, type: "weapon" },
  { id: "flail", name: "Flail", weightLb: 2, type: "weapon" },
  { id: "glaive", name: "Glaive", weightLb: 6, type: "weapon" },
  { id: "greataxe", name: "Greataxe", weightLb: 7, type: "weapon" },
  { id: "greatsword", name: "Greatsword", weightLb: 6, type: "weapon" },
  { id: "halberd", name: "Halberd", weightLb: 6, type: "weapon" },
  { id: "lance", name: "Lance", weightLb: 6, type: "weapon" },
  { id: "longsword", name: "Longsword", weightLb: 3, type: "weapon" },
  { id: "maul", name: "Maul", weightLb: 10, type: "weapon" },
  { id: "morningstar", name: "Morningstar", weightLb: 4, type: "weapon" },
  { id: "pike", name: "Pike", weightLb: 18, type: "weapon" },
  { id: "rapier", name: "Rapier", weightLb: 2, type: "weapon" },
  { id: "scimitar", name: "Scimitar", weightLb: 3, type: "weapon" },
  { id: "shortsword", name: "Shortsword", weightLb: 2, type: "weapon" },
  { id: "trident", name: "Trident", weightLb: 4, type: "weapon" },
  { id: "war-pick", name: "War pick", weightLb: 2, type: "weapon" },
  { id: "warhammer", name: "Warhammer", weightLb: 2, type: "weapon" },
  { id: "whip", name: "Whip", weightLb: 3, type: "weapon" },
  { id: "blowgun", name: "Blowgun", weightLb: 1, type: "weapon" },
  { id: "hand-crossbow", name: "Hand crossbow", weightLb: 3, type: "weapon" },
  { id: "heavy-crossbow", name: "Heavy crossbow", weightLb: 18, type: "weapon" },
  { id: "longbow", name: "Longbow", weightLb: 2, type: "weapon" },
  { id: "net", name: "Net", weightLb: 3, type: "weapon" },
  // Armor
  { id: "padded-armor", name: "Padded armor", weightLb: 8, type: "armor" },
  { id: "leather-armor", name: "Leather armor", weightLb: 10, type: "armor" },
  { id: "studded-leather", name: "Studded leather armor", weightLb: 13, type: "armor" },
  { id: "hide-armor", name: "Hide armor", weightLb: 12, type: "armor" },
  { id: "chain-shirt", name: "Chain shirt", weightLb: 20, type: "armor" },
  { id: "scale-mail", name: "Scale mail", weightLb: 45, type: "armor" },
  { id: "breastplate", name: "Breastplate", weightLb: 20, type: "armor" },
  { id: "half-plate", name: "Half plate", weightLb: 40, type: "armor" },
  { id: "ring-mail", name: "Ring mail", weightLb: 40, type: "armor" },
  { id: "chain-mail", name: "Chain mail", weightLb: 55, type: "armor" },
  { id: "splint-armor", name: "Splint armor", weightLb: 60, type: "armor" },
  { id: "plate-armor", name: "Plate armor", weightLb: 65, type: "armor" },
  { id: "shield", name: "Shield", weightLb: 6, type: "armor" },
  // Packs & kits (expanded as single items)
  { id: "burglars-pack", name: "Burglar's pack", weightLb: 44.5, type: "pack" },
  { id: "diplomats-pack", name: "Diplomat's pack", weightLb: 39, type: "pack" },
  { id: "dungeoneers-pack", name: "Dungeoneer's pack", weightLb: 61.5, type: "pack" },
  { id: "entertainers-pack", name: "Entertainer's pack", weightLb: 38, type: "pack" },
  { id: "explorers-pack", name: "Explorer's pack", weightLb: 59, type: "pack" },
  { id: "priests-pack", name: "Priest's pack", weightLb: 29, type: "pack" },
  { id: "scholars-pack", name: "Scholar's pack", weightLb: 10, type: "pack" },
  { id: "disguise-kit", name: "Disguise kit", weightLb: 3, type: "tool" },
  { id: "forgery-kit", name: "Forgery kit", weightLb: 5, type: "tool" },
  { id: "herbalism-kit", name: "Herbalism kit", weightLb: 3, type: "tool" },
  { id: "thieves-tools", name: "Thieves' tools", weightLb: 1, type: "tool" },
  { id: "navigators-tools", name: "Navigator's tools", weightLb: 2, type: "tool" },
  { id: "arcane-focus", name: "Arcane focus (crystal)", weightLb: 1, type: "focus" },
  { id: "druidic-focus", name: "Druidic focus (sprig of mistletoe)", weightLb: 0, type: "focus" },
  { id: "lute", name: "Lute", weightLb: 2, type: "tool" },
  { id: "musical-instrument", name: "Musical instrument", weightLb: 2, type: "tool" },
  { id: "artisans-tools", name: "Artisan's tools", weightLb: 5, type: "tool" },
  { id: "simple-weapon", name: "Simple weapon", weightLb: 2, type: "weapon" },
  { id: "simple-melee-weapon", name: "Simple melee weapon", weightLb: 2, type: "weapon" },
  { id: "martial-weapon", name: "Martial weapon", weightLb: 4, type: "weapon" },
  { id: "martial-melee-weapon", name: "Martial melee weapon", weightLb: 4, type: "weapon" },
  { id: "belt-pouch", name: "Belt pouch (with coins)", weightLb: 0.5, type: "gear" },
  { id: "vestments", name: "Vestments", weightLb: 4, type: "gear" },
  { id: "incense", name: "Incense (5 sticks)", weightLb: 0, type: "gear" },
  { id: "prayer-book", name: "Prayer book", weightLb: 5, type: "gear" },
  { id: "prayer-wheel", name: "Prayer wheel", weightLb: 1, type: "gear" },
  { id: "fine-clothes", name: "Fine clothes", weightLb: 6, type: "gear" },
  { id: "common-clothes", name: "Common clothes", weightLb: 3, type: "gear" },
  { id: "travelers-clothes", name: "Traveler's clothes", weightLb: 4, type: "gear" },
  { id: "costume", name: "Costume", weightLb: 4, type: "gear" },
  { id: "scroll-case", name: "Scroll case of notes", weightLb: 1, type: "gear" },
  { id: "winter-blanket", name: "Winter blanket", weightLb: 3, type: "gear" },
  { id: "letter-of-introduction", name: "Letter of introduction from guild", weightLb: 0, type: "gear" },
  { id: "insignia-of-rank", name: "Insignia of rank", weightLb: 0, type: "gear" },
  { id: "trophy", name: "Trophy from fallen enemy", weightLb: 1, type: "gear" },
  { id: "deck-of-cards", name: "Deck of cards", weightLb: 0, type: "gear" },
  { id: "belaying-pin", name: "Belaying pin (club)", weightLb: 2, type: "weapon" },
  { id: "lucky-charm", name: "Lucky charm", weightLb: 0, type: "gear" },
  { id: "small-knife", name: "Small knife", weightLb: 0.5, type: "weapon" },
  { id: "map-of-hometown", name: "Map of hometown", weightLb: 0, type: "gear" },
  { id: "pet-mouse", name: "Pet mouse", weightLb: 0, type: "gear" },
  { id: "parent-token", name: "Token from parents", weightLb: 0, type: "gear" },
  { id: "scroll-of-pedigree", name: "Scroll of pedigree", weightLb: 0, type: "gear" },
  { id: "purse", name: "Purse", weightLb: 0.5, type: "container" },
  { id: "staff", name: "Staff", weightLb: 4, type: "weapon" },
  { id: "animal-trophy", name: "Trophy from animal", weightLb: 1, type: "gear" },
  { id: "con-tools", name: "Con tools (10 gp)", weightLb: 1, type: "gear" },
  { id: "dead-colleague-letter", name: "Letter from dead colleague", weightLb: 0, type: "gear" },
  { id: "leather-bound-notebook", name: "Leather-bound notebook", weightLb: 1, type: "gear" },
  { id: "trinket-special", name: "Trinket of special significance", weightLb: 0, type: "gear" },
  { id: "wooden-case-map", name: "Wooden case with map to a ruin", weightLb: 2, type: "gear" },
  { id: "trinket-dig-site", name: "Trinket from dig site", weightLb: 0, type: "gear" },
  { id: "dark-hooded-clothes", name: "Dark common clothes with hood", weightLb: 3, type: "gear" },
];

const ITEM_BY_NAME = new Map<string, PhbItem>();

for (const item of PHB_ITEMS) {
  ITEM_BY_NAME.set(normalizeItemName(item.name), item);
  ITEM_BY_NAME.set(normalizeItemName(item.id.replace(/-/g, " ")), item);
}

function normalizeItemName(name: string): string {
  return name.toLowerCase().replace(/['']/g, "'").trim();
}

export function resolveItem(name: string): PhbItem {
  const key = normalizeItemName(name);
  const found = ITEM_BY_NAME.get(key);
  if (found) return found;
  return {
    id: key.replace(/\s+/g, "-"),
    name,
    weightLb: 0,
    type: "gear",
  };
}

export function expandEquipmentItems(names: string[]): { name: string; weightLb: number; quantity: number }[] {
  const counts = new Map<string, { name: string; weightLb: number; quantity: number }>();
  for (const raw of names) {
    const item = resolveItem(raw);
    const existing = counts.get(item.name);
    if (existing) {
      existing.quantity += 1;
    } else {
      counts.set(item.name, { name: item.name, weightLb: item.weightLb, quantity: 1 });
    }
  }
  return [...counts.values()];
}

export function rollStartingGold(dice: number, sides: number, multiplier: number): number {
  let total = 0;
  for (let i = 0; i < dice; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total * multiplier;
}
