import type { PhbBackground } from "./types";

/** Backgrounds from Xanathar's Guide to Everything and other 2014-era supplements. */
export const EXTENDED_BACKGROUNDS: PhbBackground[] = [
  {
    id: "city-watch",
    name: "City Watch",
    skillProficiencies: ["athletics", "insight"],
    languageChoices: 2,
    equipment: [
      "uniform",
      "signal horn",
      "manacles",
      "10 feet silk rope",
      "belt pouch",
    ],
    gold: 10,
    feature: {
      name: "Watcher's Eye",
      description:
        "Your experience enables you to spot the presence of law enforcement and criminal elements in a settlement.",
    },
  },
  {
    id: "clan-crafter",
    name: "Clan Crafter",
    skillProficiencies: ["history", "insight"],
    toolProficiencies: ["artisan's tools"],
    languageChoices: 1,
    equipment: [
      "artisan's tools",
      "maker's mark chisel",
      "traveler's clothes",
      "belt pouch",
      "gem worth 10 gp",
    ],
    gold: 5,
    feature: {
      name: "Respect of the Stout Folk",
      description:
        "Dwarves hold your clan name in esteem and will shelter and aid you when you are near dwarven settlements.",
    },
  },
  {
    id: "cloistered-scholar",
    name: "Cloistered Scholar",
    skillProficiencies: ["history"],
    skillChoices: {
      count: 1,
      options: ["arcana", "nature", "religion"],
      prompt: "Scholarly specialty (one skill)",
    },
    languageChoices: 2,
    equipment: [
      "scholar's robes",
      "writing kit",
      "borrowed book on current study",
      "belt pouch",
    ],
    gold: 10,
    feature: {
      name: "Library Access",
      description:
        "You can find most libraries and gain access to them. You may receive assistance from sages and librarians.",
    },
  },
  {
    id: "courtier",
    name: "Courtier",
    skillProficiencies: ["insight", "persuasion"],
    toolPick: {
      options: ["gaming set", "artisan's tools"],
      prompt: "One gaming set or artisan's tools",
    },
    equipment: ["fine clothes", "5 candles", "perfume", "belt pouch"],
    gold: 5,
    feature: {
      name: "Court Functionary",
      description:
        "You know how to navigate courtly intrigue and can find who is in charge in a noble court or bureaucracy.",
    },
  },
  {
    id: "faction-agent",
    name: "Faction Agent",
    skillProficiencies: ["insight"],
    skillChoices: {
      count: 1,
      options: [
        "arcana",
        "deception",
        "history",
        "intimidation",
        "investigation",
        "persuasion",
        "religion",
      ],
      prompt: "Faction specialty (one skill)",
    },
    languageChoices: 2,
    equipment: ["badge or emblem of faction", "common clothes", "belt pouch"],
    gold: 15,
    feature: {
      name: "Safe Haven",
      description:
        "As an agent of your faction, you have access to a secret network of supporters and safe houses.",
    },
  },
  {
    id: "far-traveler",
    name: "Far Traveler",
    skillProficiencies: ["insight", "perception"],
    toolPick: {
      options: ["gaming set", "musical instrument"],
      prompt: "One gaming set or musical instrument",
    },
    languageChoices: 1,
    equipment: [
      "traveler's clothes",
      "poorly wrought maps from homeland",
      "small piece of jewelry worth 10 gp",
      "belt pouch",
    ],
    gold: 5,
    feature: {
      name: "All Eyes on You",
      description:
        "Your accent, mannerisms, and appearance mark you as foreign and draw attention.",
    },
  },
  {
    id: "haunted-one",
    name: "Haunted One",
    skillProficiencies: [],
    skillChoices: {
      count: 2,
      options: ["arcana", "investigation", "religion", "survival"],
      prompt: "Choose two skills",
    },
    languageChoices: 1,
    equipment: [
      "monster hunter's pack",
      "trinket from past",
      "common clothes",
      "belt pouch",
    ],
    gold: 0,
    feature: {
      name: "Heart of Darkness",
      description:
        "Those who share your traumatic past sense a kindred spirit. You can find shelter among others touched by darkness.",
    },
  },
  {
    id: "inheritor",
    name: "Inheritor",
    skillProficiencies: ["survival"],
    skillChoices: {
      count: 1,
      options: ["arcana", "history", "religion"],
      prompt: "Legacy specialty (one skill)",
    },
    toolPick: {
      options: ["gaming set", "musical instrument"],
      prompt: "One gaming set or musical instrument",
    },
    languageChoices: 1,
    equipment: [
      "inheritance (see feature)",
      "traveler's clothes",
      "belt pouch",
    ],
    gold: 15,
    feature: {
      name: "Inheritance",
      description:
        "You inherited an item of value — a weapon, armor, spellbook, or similar heirloom tied to your destiny.",
    },
  },
  {
    id: "knight-of-the-order",
    name: "Knight of the Order",
    skillProficiencies: ["persuasion"],
    skillChoices: {
      count: 1,
      options: ["arcana", "history", "nature", "religion"],
      prompt: "Order specialty (one skill)",
    },
    toolPick: {
      options: ["gaming set", "musical instrument"],
      prompt: "One gaming set or musical instrument",
    },
    languageChoices: 1,
    equipment: [
      "signet ring or scroll of pedigree",
      "banner or flag of order",
      "fine clothes",
      "belt pouch",
    ],
    gold: 10,
    feature: {
      name: "Knightly Regard",
      description:
        "Members of your order recognize your standing and will provide lodging and aid when appropriate.",
    },
  },
  {
    id: "mercenary-veteran",
    name: "Mercenary Veteran",
    skillProficiencies: ["athletics", "persuasion"],
    toolProficiencies: ["gaming set", "vehicles (land)"],
    equipment: [
      "uniform of company",
      "insignia rank",
      "gaming set",
      "common clothes",
      "belt pouch",
    ],
    gold: 10,
    feature: {
      name: "Mercenary Life",
      description:
        "You can find mercenary work between adventures and know mercenary companies and their reputations.",
    },
  },
  {
    id: "urban-bounty-hunter",
    name: "Urban Bounty Hunter",
    skillProficiencies: ["deception", "stealth"],
    toolMultiPick: {
      count: 2,
      options: ["thieves' tools", "gaming set", "musical instrument"],
      prompt: "Choose two: thieves' tools, gaming set, and/or musical instrument",
    },
    equipment: ["studded leather armor", "short sword", "common clothes", "belt pouch"],
    gold: 20,
    feature: {
      name: "Ear to the Ground",
      description:
        "You know how to get information in urban areas through contacts, informants, and street knowledge.",
    },
  },
  {
    id: "uthgardt-tribe-member",
    name: "Uthgardt Tribe Member",
    skillProficiencies: ["athletics", "survival"],
    toolPick: {
      options: ["artisan's tools", "musical instrument"],
      prompt: "One artisan's tools or musical instrument",
    },
    languageChoices: 1,
    equipment: [
      "hunting trap",
      "trophy from hunt",
      "traveler's clothes",
      "belt pouch",
    ],
    gold: 5,
    feature: {
      name: "Uthgardt Heritage",
      description:
        "You know Uthgardt tribal customs and can find safe passage among Uthgardt tribes.",
    },
  },
  {
    id: "waterdhavian-noble",
    name: "Waterdhavian Noble",
    skillProficiencies: ["history", "persuasion"],
    toolPick: {
      options: ["gaming set", "musical instrument"],
      prompt: "One gaming set or musical instrument",
    },
    languageChoices: 1,
    equipment: [
      "fine clothes",
      "signet ring or scroll of pedigree",
      "purse",
    ],
    gold: 20,
    feature: {
      name: "Kept in Style",
      description:
        "Your family sees that you have lodging and food in Waterdeep and can secure invitations to noble events.",
    },
  },
];
