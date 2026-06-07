import type { PhbRace } from "./types";

/**
 * Supplemental races using D&D 5e (2014) rules from:
 * EEPC, Volo's Guide to Monsters, Mordenkainen's Tome of Foes, Eberron: Rising from the Last War.
 */
export const EXTENDED_RACES: PhbRace[] = [
  {
    id: "aarakocra",
    name: "Aarakocra",
    size: "Medium",
    speed: 25,
    abilityBonus: { kind: "fixed", bonuses: { dex: 2, wis: 1 } },
    languages: ["Common", "Aarakocra", "Auran"],
    traits: [
      {
        name: "Flight",
        description: "You have a flying speed of 50 feet. You can't fly while wearing medium or heavy armor.",
      },
      {
        name: "Talons",
        description: "You are proficient with your unarmed strikes, which deal 1d4 slashing damage on a hit.",
      },
    ],
  },
  {
    id: "aasimar",
    name: "Aasimar",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { cha: 2 } },
    languages: ["Common", "Celestial"],
    traits: [
      {
        name: "Darkvision",
        description: "You can see in dim light within 60 feet as if bright light, and in darkness as if dim light.",
      },
      {
        name: "Celestial Resistance",
        description: "You have resistance to necrotic and radiant damage.",
      },
      {
        name: "Healing Hands",
        description: "As an action, you touch a creature and restore hit points equal to your level (once per long rest).",
      },
      {
        name: "Light Bearer",
        description: "You know the light cantrip. Charisma is your spellcasting ability for it.",
      },
    ],
    subraces: [
      {
        id: "protector",
        name: "Protector",
        abilityBonus: { wis: 1 },
        extras: ["Radiant Soul: Once per long rest, sprout spectral wings for 1 minute and deal extra radiant damage once per turn."],
      },
      {
        id: "scourge",
        name: "Scourge",
        abilityBonus: { con: 1 },
        extras: ["Radiant Consumption: Once per long rest, emit damaging radiant light for 1 minute."],
      },
      {
        id: "fallen",
        name: "Fallen",
        abilityBonus: { str: 1 },
        extras: ["Necrotic Shroud: Once per long rest, frighten nearby creatures and deal extra necrotic damage once per turn."],
      },
    ],
  },
  {
    id: "bugbear",
    name: "Bugbear",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { str: 2, dex: 1 } },
    languages: ["Common", "Goblin"],
    skillProficiencies: ["stealth"],
    traits: [
      {
        name: "Darkvision",
        description: "You can see in dim light within 60 feet as if bright light, and in darkness as if dim light.",
      },
      {
        name: "Long-Limbed",
        description: "When you make a melee attack on your turn, your reach is 5 feet greater than normal.",
      },
      {
        name: "Powerful Build",
        description: "You count as one size larger when determining carrying capacity and the weight you can push, drag, or lift.",
      },
      {
        name: "Surprise Attack",
        description: "If you hit a creature surprised by you, it takes an extra 2d6 damage from the attack (once per turn).",
      },
      {
        name: "Sneaky",
        description: "You are proficient in the Stealth skill.",
      },
    ],
  },
  {
    id: "changeling",
    name: "Changeling",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { cha: 2, dex: 1 } },
    languages: ["Common"],
    languageChoices: 2,
    skillChoices: { count: 2, prompt: "Changeling Instincts (two skills)" },
    traits: [
      {
        name: "Shapechanger",
        description: "As an action, you can change your appearance and voice. You determine the specifics; your clothing and equipment aren't changed.",
      },
      {
        name: "Changeling Instincts",
        description: "You gain proficiency with two skills of your choice.",
      },
    ],
  },
  {
    id: "firbolg",
    name: "Firbolg",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { wis: 2, str: 1 } },
    languages: ["Common", "Elvish", "Giant"],
    traits: [
      {
        name: "Firbolg Magic",
        description: "You can cast detect magic and disguise self (Wisdom). Once per short or long rest each.",
      },
      {
        name: "Hidden Step",
        description: "As a bonus action, you turn invisible until the start of your next turn or until you attack, deal damage, or force a save (once per short or long rest).",
      },
      {
        name: "Powerful Build",
        description: "You count as one size larger when determining carrying capacity.",
      },
      {
        name: "Speech of Beast and Leaf",
        description: "You have limited ability to communicate with beasts and plants.",
      },
    ],
  },
  {
    id: "genasi",
    name: "Genasi",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: {} },
    languages: ["Common", "Primordial"],
    traits: [
      {
        name: "Elemental Legacy",
        description: "Your subrace determines your elemental cantrip, resistance, and other traits.",
      },
    ],
    subraces: [
      {
        id: "air",
        name: "Air Genasi",
        abilityBonus: { dex: 2, wis: 1 },
        extras: ["Unending Breath", "Mingle with the Wind (shocking grasp)", "Lightning resistance"],
      },
      {
        id: "earth",
        name: "Earth Genasi",
        abilityBonus: { str: 2, con: 1 },
        extras: ["Earth Walk", "Merge with Stone (blade ward)", "Pass without trace 1/day"],
      },
      {
        id: "fire",
        name: "Fire Genasi",
        abilityBonus: { int: 2, con: 1 },
        extras: ["Darkvision 60 ft", "Fire resistance", "Reach to the Blaze (produce flame)"],
      },
      {
        id: "water",
        name: "Water Genasi",
        abilityBonus: { wis: 2, con: 1 },
        extras: ["Acid resistance", "Amphibious", "Call to the Wave (shape water)", "Swim speed 30 ft"],
      },
    ],
  },
  {
    id: "githyanki",
    name: "Githyanki",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { str: 2, int: 1 } },
    languages: ["Common", "Gith"],
    languageChoices: 1,
    skillOrToolChoice: { prompt: "Decadent Mastery (one skill or one tool)" },
    weaponProficiencies: ["greatsword", "longsword", "shortsword"],
    traits: [
      {
        name: "Decadent Mastery",
        description: "You learn one language of your choice and gain proficiency with one skill or tool of your choice.",
      },
      {
        name: "Githyanki Psionics",
        description: "You know the mage hand cantrip; at 3rd level jump; at 5th level misty step (Intelligence).",
      },
    ],
  },
  {
    id: "githzerai",
    name: "Githzerai",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { int: 2, wis: 1 } },
    languages: ["Common", "Gith"],
    traits: [
      {
        name: "Mental Discipline",
        description: "You have advantage on saving throws against the charmed and frightened conditions.",
      },
      {
        name: "Githzerai Psionics",
        description: "You know the mage hand cantrip; at 3rd level shield; at 5th level detect thoughts (Wisdom).",
      },
    ],
  },
  {
    id: "goblin",
    name: "Goblin",
    size: "Small",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { dex: 2, con: 1 } },
    languages: ["Common", "Goblin"],
    traits: [
      {
        name: "Darkvision",
        description: "You can see in dim light within 60 feet as if bright light, and in darkness as if dim light.",
      },
      {
        name: "Fury of the Small",
        description: "When you damage a creature larger than you, add your level to the damage (once per short or long rest).",
      },
      {
        name: "Nimble Escape",
        description: "You can take the Disengage or Hide action as a bonus action on each of your turns.",
      },
    ],
  },
  {
    id: "goliath",
    name: "Goliath",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { str: 2, con: 1 } },
    languages: ["Common", "Giant"],
    skillProficiencies: ["athletics"],
    traits: [
      {
        name: "Natural Athlete",
        description: "You have proficiency in the Athletics skill.",
      },
      {
        name: "Stone's Endurance",
        description: "When you take damage, you can use your reaction to roll 1d12 + Con mod and reduce the damage by that total (once per short or long rest).",
      },
      {
        name: "Powerful Build",
        description: "You count as one size larger when determining carrying capacity.",
      },
      {
        name: "Mountain Born",
        description: "You are acclimated to high altitude, including elevations above 20,000 feet, and cold climates.",
      },
    ],
  },
  {
    id: "hobgoblin",
    name: "Hobgoblin",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { con: 2, int: 1 } },
    languages: ["Common", "Goblin"],
    weaponChoices: { count: 2, prompt: "Martial Training (two martial weapons)" },
    armorProficiencies: ["light armor"],
    traits: [
      {
        name: "Darkvision",
        description: "You can see in dim light within 60 feet as if bright light, and in darkness as if dim light.",
      },
      {
        name: "Martial Training",
        description: "You are proficient with two martial weapons of your choice and with light armor.",
      },
      {
        name: "Saving Face",
        description: "When you miss an attack roll or fail an ability check or save, add +5 to the roll after seeing the result (once per short or long rest).",
      },
    ],
  },
  {
    id: "kalashtar",
    name: "Kalashtar",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { wis: 2, cha: 1 } },
    languages: ["Common", "Quori"],
    languageChoices: 1,
    traits: [
      {
        name: "Dual Mind",
        description: "You have advantage on Wisdom saving throws.",
      },
      {
        name: "Mental Discipline",
        description: "You have resistance to psychic damage.",
      },
      {
        name: "Mind Link",
        description: "You can telepathically speak to any creature you can see within 10 feet.",
      },
      {
        name: "Severed from Dreams",
        description: "You don't dream and are immune to spells and effects that require you to dream.",
      },
    ],
  },
  {
    id: "kenku",
    name: "Kenku",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { dex: 2, wis: 1 } },
    languages: ["Common", "Auran"],
    skillChoices: {
      count: 2,
      options: ["acrobatics", "deception", "stealth", "sleightOfHand"],
      prompt: "Kenku Training (two skills)",
    },
    traits: [
      {
        name: "Expert Forgery",
        description: "You can duplicate another creature's handwriting and craftwork given enough time and materials.",
      },
      {
        name: "Kenku Training",
        description: "You are proficient in your choice of two skills from Acrobatics, Deception, Stealth, and Sleight of Hand.",
      },
      {
        name: "Mimicry",
        description: "You can mimic sounds you have heard, including voices.",
      },
    ],
  },
  {
    id: "kobold",
    name: "Kobold",
    size: "Small",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { dex: 2, str: -2 } },
    languages: ["Common", "Draconic"],
    traits: [
      {
        name: "Darkvision",
        description: "You can see in dim light within 60 feet as if bright light, and in darkness as if dim light.",
      },
      {
        name: "Grovel, Cower, and Beg",
        description: "As an action on your turn, you can cower to distract foes; until your next turn, your allies gain advantage on attacks against enemies within 10 feet of you (once per short or long rest).",
      },
      {
        name: "Pack Tactics",
        description: "You have advantage on an attack roll against a creature if at least one of your allies is within 5 feet of the creature and the ally isn't incapacitated.",
      },
      {
        name: "Sunlight Sensitivity",
        description: "You have disadvantage on attack rolls and Wisdom (Perception) checks that rely on sight when you or your target is in direct sunlight.",
      },
    ],
  },
  {
    id: "lizardfolk",
    name: "Lizardfolk",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { con: 2, wis: 1 } },
    languages: ["Common", "Draconic"],
    skillChoices: {
      count: 2,
      options: ["animalHandling", "nature", "perception", "stealth", "survival"],
      prompt: "Two skill proficiencies",
    },
    traits: [
      {
        name: "Bite",
        description: "Your fanged maw is a natural weapon (1d6 + Str piercing on a hit).",
      },
      {
        name: "Cunning Artisan",
        description: "As part of a short rest, you can harvest bone and hide from a slain beast to craft a shield, club, javelin, or 1d4 blowgun darts.",
      },
      {
        name: "Hold Breath",
        description: "You can hold your breath for up to 15 minutes at a time.",
      },
      {
        name: "Natural Armor",
        description: "Your AC is 13 + Dex modifier when you aren't wearing armor.",
      },
      {
        name: "Hungry Jaws",
        description: "As a bonus action, make a bite attack; if it hits, you gain temporary HP equal to your Con mod (minimum 1, once per short or long rest).",
      },
    ],
  },
  {
    id: "orc",
    name: "Orc",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { str: 2, con: 1 } },
    languages: ["Common", "Orc"],
    skillChoices: {
      count: 2,
      options: [
        "animalHandling",
        "insight",
        "intimidation",
        "medicine",
        "nature",
        "perception",
        "survival",
      ],
      prompt: "Primal Intuition (two skills)",
    },
    traits: [
      {
        name: "Darkvision",
        description: "You can see in dim light within 60 feet as if bright light, and in darkness as if dim light.",
      },
      {
        name: "Aggressive",
        description: "As a bonus action, you can move up to your speed toward a hostile creature you can see.",
      },
      {
        name: "Powerful Build",
        description: "You count as one size larger when determining carrying capacity.",
      },
      {
        name: "Primal Intuition",
        description: "You gain proficiency in two skills from Animal Handling, Insight, Intimidation, Medicine, Nature, Perception, and Survival.",
      },
    ],
  },
  {
    id: "shifter",
    name: "Shifter",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { dex: 1 } },
    languages: ["Common"],
    traits: [
      {
        name: "Darkvision",
        description: "You can see in dim light within 60 feet as if bright light, and in darkness as if dim light.",
      },
      {
        name: "Shifting",
        description: "As a bonus action, you shift for 1 minute to gain temporary HP and a subrace benefit (once per short or long rest).",
      },
    ],
    subraces: [
      {
        id: "beasthide",
        name: "Beasthide",
        abilityBonus: { con: 2 },
        extras: ["While shifted, gain 1d6 extra temporary HP and +1 AC."],
      },
      {
        id: "longtooth",
        name: "Longtooth",
        abilityBonus: { str: 2 },
        extras: ["While shifted, grow fangs for an unarmed strike (1d6 + Str piercing) as a bonus action."],
      },
      {
        id: "swiftstride",
        name: "Swiftstride",
        abilityBonus: { dex: 2, cha: 1 },
        extras: ["While shifted, walk speed increases by 10 feet and you can move up to 10 feet as a reaction when a creature ends its turn within 30 feet."],
      },
      {
        id: "wildhunt",
        name: "Wildhunt",
        abilityBonus: { wis: 2 },
        extras: ["While shifted, you have advantage on Wisdom checks and no creature within 30 feet can make attack rolls with advantage against you unless you are incapacitated."],
      },
    ],
  },
  {
    id: "tabaxi",
    name: "Tabaxi",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { dex: 2, cha: 1 } },
    languages: ["Common"],
    languageChoices: 1,
    skillProficiencies: ["perception", "stealth"],
    traits: [
      {
        name: "Darkvision",
        description: "You can see in dim light within 60 feet as if bright light, and in darkness as if dim light.",
      },
      {
        name: "Feline Agility",
        description: "When you move on your turn in combat, you can double your speed until the end of the turn (once per turn).",
      },
      {
        name: "Cat's Claws",
        description: "Your claws are natural weapons (1d4 + Str slashing). You have a climbing speed equal to your walking speed.",
      },
      {
        name: "Cat's Talent",
        description: "You have proficiency in the Perception and Stealth skills.",
      },
    ],
  },
  {
    id: "triton",
    name: "Triton",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { str: 1, con: 1, cha: 1 } },
    languages: ["Common", "Primordial"],
    traits: [
      {
        name: "Amphibious",
        description: "You can breathe air and water.",
      },
      {
        name: "Control Air and Water",
        description: "You can cast fog cloud; at 3rd level gust of wind; at 5th level wall of water (Charisma).",
      },
      {
        name: "Emissary of the Sea",
        description: "Aquatic beasts can understand your speech and you can communicate simple ideas to them.",
      },
      {
        name: "Guardians of the Depths",
        description: "You have resistance to cold damage and can breathe underwater.",
      },
    ],
  },
  {
    id: "warforged",
    name: "Warforged",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { con: 2 } },
    languages: ["Common"],
    languageChoices: 1,
    traits: [
      {
        name: "Constructed Resilience",
        description: "You have advantage on saves against poison, resistance to poison damage, and don't need to eat, drink, breathe, or sleep.",
      },
      {
        name: "Sentry's Rest",
        description: "When you take a long rest, you spend 6 hours in an inactive but conscious state.",
      },
      {
        name: "Integrated Protection",
        description: "Your body can be enhanced with armor you are proficient with.",
      },
    ],
    subraces: [
      {
        id: "str",
        name: "+1 Strength",
        abilityBonus: { str: 1 },
        extras: ["One other ability score of your choice increases by 1 (Strength)."],
      },
      {
        id: "dex",
        name: "+1 Dexterity",
        abilityBonus: { dex: 1 },
        extras: ["One other ability score of your choice increases by 1 (Dexterity)."],
      },
      {
        id: "int",
        name: "+1 Intelligence",
        abilityBonus: { int: 1 },
        extras: ["One other ability score of your choice increases by 1 (Intelligence)."],
      },
    ],
  },
  {
    id: "yuan-ti-pureblood",
    name: "Yuan-ti Pureblood",
    size: "Medium",
    speed: 30,
    abilityBonus: { kind: "fixed", bonuses: { cha: 2, int: 1 } },
    languages: ["Common", "Abyssal", "Draconic"],
    traits: [
      {
        name: "Darkvision",
        description: "You can see in dim light within 60 feet as if bright light, and in darkness as if dim light.",
      },
      {
        name: "Innate Spellcasting",
        description: "You know the poison spray cantrip; at 3rd level animal friendship; at 5th level suggestion (Charisma).",
      },
      {
        name: "Magic Resistance",
        description: "You have advantage on saving throws against spells and other magical effects.",
      },
      {
        name: "Poison Immunity",
        description: "You are immune to poison damage and the poisoned condition.",
      },
    ],
  },
];
