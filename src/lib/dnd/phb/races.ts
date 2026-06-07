import type { PhbRace } from "./types";
import { EXTENDED_RACES } from "./extended-races";

export const PHB_RACES: PhbRace[] = [
  {
    id: "dwarf",
    name: "Dwarf",
    size: "Medium",
    speed: 25,
    abilityBonus: { kind: "fixed", bonuses: { con: 2 } },
    languages: ["Common", "Dwarvish"],
    weaponProficiencies: ["battleaxe", "handaxe", "light hammer", "warhammer"],
    traits: [
      {
        name: "Darkvision",
        description: "You can see in dim light within 60 feet as if bright light, and in darkness as if dim light.",
      },
      {
        name: "Dwarven Resilience",
        description: "Advantage on saves against poison; resistance to poison damage.",
      },
      {
        name: "Stonecunning",
        description: "Add double proficiency bonus to History checks related to stonework.",
      },
    ],
    subraces: [
      {
        id: "hill",
        name: "Hill Dwarf",
        abilityBonus: { wis: 1 },
        extras: ["Dwarven Toughness: +1 HP at 1st level and each level thereafter."],
      },
      {
        id: "mountain",
        name: "Mountain Dwarf",
        abilityBonus: { str: 2 },
        extras: ["Dwarven Armor Training: proficiency with light and medium armor."],
      },
    ],
  },
  {
    id: "elf",
    name: "Elf",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { dex: 2 } },
    languages: ["Common", "Elvish"],
    traits: [
      {
        name: "Darkvision",
        description: "You can see in dim light within 60 feet as if bright light, and in darkness as if dim light.",
      },
      {
        name: "Keen Senses",
        description: "Proficiency in the Perception skill.",
      },
      {
        name: "Fey Ancestry",
        description: "Advantage on saves against being charmed; magic can't put you to sleep.",
      },
      {
        name: "Trance",
        description: "Elves don't sleep. 4 hours of trance counts as 8 hours of rest.",
      },
    ],
    skillProficiencies: ["perception"],
    subraces: [
      {
        id: "high",
        name: "High Elf",
        abilityBonus: { int: 1 },
        extras: [
          "Cantrip: You know one wizard cantrip (Intelligence is your spellcasting ability).",
          "Extra Language: You learn one extra language of your choice.",
        ],
      },
      {
        id: "wood",
        name: "Wood Elf",
        abilityBonus: { wis: 1 },
        extras: [
          "Fleet of Foot: Your walking speed increases to 35 feet.",
          "Mask of the Wild: You can attempt to hide when lightly obscured by natural phenomena.",
        ],
      },
      {
        id: "drow",
        name: "Drow",
        abilityBonus: { cha: 1 },
        extras: [
          "Superior Darkvision: 120 feet.",
          "Sunlight Sensitivity: Disadvantage on attack rolls and Perception checks relying on sight in direct sunlight.",
          "Drow Magic: You know the dancing lights cantrip.",
        ],
      },
    ],
  },
  {
    id: "halfling",
    name: "Halfling",
    size: "Small",
    speed: 25,
    abilityBonus: { kind: "fixed", bonuses: { dex: 2 } },
    languages: ["Common", "Halfling"],
    traits: [
      {
        name: "Lucky",
        description: "When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll and must use the new roll.",
      },
      {
        name: "Brave",
        description: "Advantage on saves against being frightened.",
      },
      {
        name: "Halfling Nimbleness",
        description: "You can move through the space of any creature that is a size larger than you.",
      },
    ],
    subraces: [
      {
        id: "lightfoot",
        name: "Lightfoot Halfling",
        abilityBonus: { cha: 1 },
        extras: ["Naturally Stealthy: You can attempt to hide when obscured only by a creature at least one size larger."],
      },
      {
        id: "stout",
        name: "Stout Halfling",
        abilityBonus: { con: 1 },
        extras: ["Stout Resilience: Advantage on saves against poison; resistance to poison damage."],
      },
    ],
  },
  {
    id: "human",
    name: "Human",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 } },
    languages: ["Common"],
    languageChoices: 1,
    traits: [
      {
        name: "Languages",
        description: "You speak Common and one extra language of your choice.",
      },
    ],
    subraces: [
      {
        id: "standard",
        name: "Standard Human",
        extras: ["+1 to all ability scores."],
      },
      {
        id: "variant",
        name: "Variant Human",
        extras: [
          "+1 to two different ability scores of your choice.",
          "One skill proficiency of your choice.",
          "One feat of your choice.",
        ],
      },
    ],
  },
  {
    id: "dragonborn",
    name: "Dragonborn",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { str: 2, cha: 1 } },
    languages: ["Common", "Draconic"],
    traits: [
      {
        name: "Draconic Ancestry",
        description: "Choose a draconic ancestry. You have a breath weapon and damage resistance based on your ancestry.",
      },
      {
        name: "Breath Weapon",
        description: "Use your breath weapon (DC = 8 + Con mod + prof). Recharges on short or long rest.",
      },
      {
        name: "Damage Resistance",
        description: "You have resistance to the damage type associated with your draconic ancestry.",
      },
    ],
    subraces: [
      { id: "black", name: "Black (Acid)", extras: ["Acid breath (5×30 ft line); acid resistance."] },
      { id: "blue", name: "Blue (Lightning)", extras: ["Lightning breath (5×30 ft line); lightning resistance."] },
      { id: "brass", name: "Brass (Fire)", extras: ["Fire breath (5×30 ft line); fire resistance."] },
      { id: "bronze", name: "Bronze (Lightning)", extras: ["Lightning breath (5×30 ft line); lightning resistance."] },
      { id: "copper", name: "Copper (Acid)", extras: ["Acid breath (5×30 ft line); acid resistance."] },
      { id: "gold", name: "Gold (Fire)", extras: ["Fire breath (15 ft cone); fire resistance."] },
      { id: "green", name: "Green (Poison)", extras: ["Poison breath (15 ft cone); poison resistance."] },
      { id: "red", name: "Red (Fire)", extras: ["Fire breath (15 ft cone); fire resistance."] },
      { id: "silver", name: "Silver (Cold)", extras: ["Cold breath (15 ft cone); cold resistance."] },
      { id: "white", name: "White (Cold)", extras: ["Cold breath (15 ft cone); cold resistance."] },
    ],
  },
  {
    id: "gnome",
    name: "Gnome",
    size: "Small",
    speed: 25,
    abilityBonus: { kind: "fixed", bonuses: { int: 2 } },
    languages: ["Common", "Gnomish"],
    traits: [
      {
        name: "Darkvision",
        description: "You can see in dim light within 60 feet as if bright light, and in darkness as if dim light.",
      },
      {
        name: "Gnome Cunning",
        description: "Advantage on Intelligence, Wisdom, and Charisma saves against magic.",
      },
    ],
    subraces: [
      {
        id: "forest",
        name: "Forest Gnome",
        abilityBonus: { dex: 1 },
        extras: ["Natural Illusionist: You know the minor illusion cantrip.", "Speak with Small Beasts."],
      },
      {
        id: "rock",
        name: "Rock Gnome",
        abilityBonus: { con: 1 },
        extras: ["Artificer's Lore: Double proficiency on History checks about magic items, alchemical objects, or technological devices.", "Tinker: Create tiny clockwork devices."],
      },
    ],
  },
  {
    id: "half-elf",
    name: "Half-Elf",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "half-elf", cha: 2, plusOneChoices: 2, exclude: ["cha"] },
    languages: ["Common", "Elvish"],
    languageChoices: 1,
    traits: [
      {
        name: "Darkvision",
        description: "You can see in dim light within 60 feet as if bright light, and in darkness as if dim light.",
      },
      {
        name: "Fey Ancestry",
        description: "Advantage on saves against being charmed; magic can't put you to sleep.",
      },
      {
        name: "Skill Versatility",
        description: "You gain proficiency in two skills of your choice.",
      },
    ],
    skillProficiencies: [],
  },
  {
    id: "half-orc",
    name: "Half-Orc",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { str: 2, con: 1 } },
    languages: ["Common", "Orc"],
    traits: [
      {
        name: "Darkvision",
        description: "You can see in dim light within 60 feet as if bright light, and in darkness as if dim light.",
      },
      {
        name: "Relentless Endurance",
        description: "When reduced to 0 HP but not killed outright, drop to 1 HP instead (once per long rest).",
      },
      {
        name: "Savage Attacks",
        description: "When you score a critical hit with a melee weapon attack, roll one additional damage die.",
      },
    ],
  },
  {
    id: "tiefling",
    name: "Tiefling",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { cha: 2, int: 1 } },
    languages: ["Common", "Infernal"],
    traits: [
      {
        name: "Darkvision",
        description: "You can see in dim light within 60 feet as if bright light, and in darkness as if dim light.",
      },
      {
        name: "Hellish Resistance",
        description: "You have resistance to fire damage.",
      },
      {
        name: "Infernal Legacy",
        description: "You know the thaumaturgy cantrip. At 3rd level, hellish rebuke; at 5th level, darkness (Charisma).",
      },
    ],
  },
];

export const ALL_RACES: PhbRace[] = [...PHB_RACES, ...EXTENDED_RACES].sort((a, b) =>
  a.name.localeCompare(b.name)
);

export function getRace(id: string): PhbRace | undefined {
  return ALL_RACES.find((r) => r.id === id);
}

export function getRaceDisplayName(raceId: string, subraceId?: string): string {
  const race = getRace(raceId);
  if (!race) return raceId;
  if (subraceId) {
    const sub = race.subraces?.find((s) => s.id === subraceId);
    if (sub) return `${race.name} (${sub.name})`;
  }
  return race.name;
}
