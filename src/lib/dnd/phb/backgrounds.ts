import type { PhbBackground } from "./types";

export const PHB_BACKGROUNDS: PhbBackground[] = [
  {
    id: "acolyte",
    name: "Acolyte",
    skillProficiencies: ["insight", "religion"],
    languageChoices: 2,
    equipment: ["holy symbol", "prayer book or prayer wheel", "incense (5 sticks)", "vestments", "common clothes", "belt pouch"],
    gold: 15,
    feature: {
      name: "Shelter of the Faithful",
      description: "You and adventuring companions can receive free healing and care at temples of your faith.",
    },
  },
  {
    id: "charlatan",
    name: "Charlatan",
    skillProficiencies: ["deception", "sleightOfHand"],
    toolProficiencies: ["disguise kit", "forgery kit"],
    equipment: ["fine clothes", "disguise kit", "con tools (10 gp)", "belt pouch"],
    gold: 15,
    feature: {
      name: "False Identity",
      description: "You have created a second identity with documentation, established acquaintances, and disguise.",
    },
  },
  {
    id: "criminal",
    name: "Criminal",
    skillProficiencies: ["deception", "stealth"],
    toolProficiencies: ["thieves' tools", "gaming set"],
    equipment: ["crowbar", "dark common clothes with hood", "belt pouch"],
    gold: 15,
    feature: {
      name: "Criminal Contact",
      description: "You have a reliable contact who acts as your liaison to a network of criminals.",
    },
  },
  {
    id: "entertainer",
    name: "Entertainer",
    skillProficiencies: ["acrobatics", "performance"],
    toolProficiencies: ["disguise kit", "musical instrument"],
    equipment: ["musical instrument", "costume", "belt pouch"],
    gold: 15,
    feature: {
      name: "By Popular Demand",
      description: "You can find a place to perform and receive free lodging and food of modest or comfortable standard.",
    },
  },
  {
    id: "folk-hero",
    name: "Folk Hero",
    skillProficiencies: ["animalHandling", "survival"],
    toolProficiencies: ["artisan's tools", "vehicles (land)"],
    equipment: ["artisan's tools", "shovel", "iron pot", "common clothes", "belt pouch"],
    gold: 10,
    feature: {
      name: "Rustic Hospitality",
      description: "Common folk will shield you from the law or those seeking you, though they won't risk their lives.",
    },
  },
  {
    id: "guild-artisan",
    name: "Guild Artisan",
    skillProficiencies: ["insight", "persuasion"],
    toolProficiencies: ["artisan's tools"],
    languageChoices: 1,
    equipment: ["artisan's tools", "letter of introduction from guild", "traveler's clothes", "belt pouch"],
    gold: 15,
    feature: {
      name: "Guild Membership",
      description: "Fellow guild members provide lodging and food when necessary, and pay for your funeral.",
    },
  },
  {
    id: "hermit",
    name: "Hermit",
    skillProficiencies: ["medicine", "religion"],
    toolProficiencies: ["herbalism kit"],
    languageChoices: 1,
    equipment: ["scroll case of notes", "winter blanket", "herbalism kit", "common clothes", "belt pouch"],
    gold: 5,
    feature: {
      name: "Discovery",
      description: "The quiet seclusion of your extended hermitage gave you an incredible revelation.",
    },
  },
  {
    id: "noble",
    name: "Noble",
    skillProficiencies: ["history", "persuasion"],
    toolProficiencies: ["gaming set"],
    languageChoices: 1,
    equipment: ["fine clothes", "signet ring", "scroll of pedigree", "purse"],
    gold: 25,
    feature: {
      name: "Position of Privilege",
      description: "Commoners assume you have the right to be wherever you are and defer to you.",
    },
  },
  {
    id: "outlander",
    name: "Outlander",
    skillProficiencies: ["athletics", "survival"],
    toolProficiencies: ["musical instrument"],
    languageChoices: 1,
    equipment: ["staff", "hunting trap", "trophy from animal", "traveler's clothes", "belt pouch"],
    gold: 10,
    feature: {
      name: "Wanderer",
      description: "You have excellent memory for maps and geography and can find food and fresh water for up to six people each day.",
    },
  },
  {
    id: "sage",
    name: "Sage",
    skillProficiencies: ["arcana", "history"],
    languageChoices: 2,
    equipment: ["bottle of black ink", "quill", "small knife", "letter from dead colleague", "common clothes", "belt pouch"],
    gold: 10,
    feature: {
      name: "Researcher",
      description: "When you attempt to learn or recall lore, if you don't know it you often know where to find it.",
    },
  },
  {
    id: "sailor",
    name: "Sailor",
    skillProficiencies: ["athletics", "perception"],
    toolProficiencies: ["navigator's tools", "vehicles (water)"],
    equipment: ["belaying pin (club)", "50 feet silk rope", "lucky charm", "common clothes", "belt pouch"],
    gold: 10,
    feature: {
      name: "Ship's Passage",
      description: "You can secure free passage on a sailing ship for yourself and companions.",
    },
  },
  {
    id: "soldier",
    name: "Soldier",
    skillProficiencies: ["athletics", "intimidation"],
    toolProficiencies: ["gaming set", "vehicles (land)"],
    equipment: ["insignia of rank", "trophy from fallen enemy", "deck of cards", "common clothes", "belt pouch"],
    gold: 10,
    feature: {
      name: "Military Rank",
      description: "Soldiers still recognize your authority and influence and defer to you if of lower rank.",
    },
  },
  {
    id: "urchin",
    name: "Urchin",
    skillProficiencies: ["sleightOfHand", "stealth"],
    toolProficiencies: ["disguise kit", "thieves' tools"],
    equipment: ["small knife", "map of hometown", "pet mouse", "token from parents", "common clothes", "belt pouch"],
    gold: 10,
    feature: {
      name: "City Secrets",
      description: "You know the secret patterns and flow of cities and can find passages others would miss.",
    },
  },
];

export function getBackground(id: string): PhbBackground | undefined {
  return PHB_BACKGROUNDS.find((b) => b.id === id);
}

export const STANDARD_LANGUAGES = [
  "Common",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
  "Abyssal",
  "Celestial",
  "Draconic",
  "Deep Speech",
  "Infernal",
  "Primordial",
  "Sylvan",
  "Undercommon",
];

export const ARTISAN_TOOLS = [
  "Alchemist's supplies",
  "Brewer's supplies",
  "Calligrapher's supplies",
  "Carpenter's tools",
  "Cartographer's tools",
  "Cobbler's tools",
  "Cook's utensils",
  "Glassblower's tools",
  "Jeweler's tools",
  "Leatherworker's tools",
  "Mason's tools",
  "Painter's supplies",
  "Potter's tools",
  "Smith's tools",
  "Tinkerer's tools",
  "Weaver's tools",
  "Woodcarver's tools",
];

export const GAMING_SETS = [
  "Dice set",
  "Dragonchess set",
  "Playing card set",
  "Three-Dragon Ante set",
];

export const MUSICAL_INSTRUMENTS = [
  "Bagpipes",
  "Drum",
  "Dulcimer",
  "Flute",
  "Lute",
  "Lyre",
  "Horn",
  "Pan flute",
  "Shawm",
  "Viol",
];
