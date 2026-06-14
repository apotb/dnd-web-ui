import type { PhbClass } from "./types";

export const PHB_CLASSES: PhbClass[] = [
  {
    id: "barbarian",
    name: "Barbarian",
    hitDie: 12,
    savingThrows: ["str", "con"],
    skillChoiceCount: 2,
    skillOptions: [
      "animalHandling",
      "athletics",
      "intimidation",
      "nature",
      "perception",
      "survival",
    ],
    armorProficiencies: ["light armor", "medium armor", "shields"],
    weaponProficiencies: ["simple weapons", "martial weapons"],
    startingGold: { dice: 2, sides: 4, multiplier: 10 },
    fixedEquipment: ["explorer's pack", "four javelins"],
    equipmentChoices: [
      {
        prompt: "Primary weapon",
        options: [
          { label: "(a) greataxe", items: ["greataxe"] },
          { label: "(b) martial melee weapon", items: ["martial melee weapon"] },
        ],
      },
      {
        prompt: "Secondary weapon",
        options: [
          { label: "(a) two handaxes", items: ["handaxe", "handaxe"] },
          { label: "(b) any simple weapon", items: ["simple weapon"] },
        ],
      },
    ],
    subclassLevel: 3,
    subclasses: [
      {
        id: "berserker",
        name: "Path of the Berserker",
        features: [{ name: "Frenzy", description: "Bonus action to enter frenzy for bonus attack each turn; exhaustion after." }],
      },
      {
        id: "totem-warrior",
        name: "Path of the Totem Warrior",
        features: [{ name: "Spirit Seeker", description: "Choose a totem spirit at 3rd level granting benefits while raging." }],
      },
    ],
    features: [
      { name: "Rage", description: "2 rages per long rest. +2 damage, advantage on Str checks/saves, resistance to bludgeoning/piercing/slashing." },
      { name: "Unarmored Defense", description: "AC = 10 + Dex + Con when not wearing armor." },
    ],
  },
  {
    id: "bard",
    name: "Bard",
    hitDie: 8,
    savingThrows: ["dex", "cha"],
    skillChoiceCount: 3,
    skillOptions: [
      "acrobatics",
      "animalHandling",
      "arcana",
      "athletics",
      "deception",
      "history",
      "insight",
      "intimidation",
      "investigation",
      "medicine",
      "nature",
      "perception",
      "performance",
      "persuasion",
      "religion",
      "sleightOfHand",
      "stealth",
      "survival",
    ],
    armorProficiencies: ["light armor"],
    weaponProficiencies: ["simple weapons", "hand crossbows", "longswords", "rapiers", "shortswords"],
    toolProficiencies: ["three musical instruments"],
    startingGold: { dice: 5, sides: 4, multiplier: 10 },
    fixedEquipment: ["leather armor", "dagger", "lute"],
    equipmentChoices: [
      {
        prompt: "Weapon",
        options: [
          { label: "(a) rapier", items: ["rapier"] },
          { label: "(b) longsword", items: ["longsword"] },
          { label: "(c) any simple weapon", items: ["simple weapon"] },
        ],
      },
      {
        prompt: "Pack",
        options: [
          { label: "(a) diplomat's pack", items: ["diplomat's pack"] },
          { label: "(b) entertainer's pack", items: ["entertainer's pack"] },
        ],
      },
      {
        prompt: "Instrument",
        options: [
          { label: "(a) lute", items: ["lute"] },
          { label: "(b) any musical instrument", items: ["musical instrument"] },
        ],
      },
    ],
    subclassLevel: 3,
    subclasses: [
      {
        id: "lore",
        name: "College of Lore",
        features: [{ name: "Bonus Proficiencies", description: "Proficiency with three additional skills of your choice." }],
      },
      {
        id: "valor",
        name: "College of Valor",
        features: [{ name: "Bonus Proficiencies", description: "Proficiency with medium armor, shields, and martial weapons." }],
      },
    ],
    spellcasting: {
      ability: "cha",
      cantripsKnown: 2,
      spellsKnown: 4,
      ritual: true,
      spellListId: "bard",
    },
    features: [
      { name: "Bardic Inspiration", description: "d6 die, number of uses = Cha mod (min 1), recharge on long rest." },
      { name: "Spellcasting", description: "Charisma-based spellcasting." },
    ],
  },
  {
    id: "cleric",
    name: "Cleric",
    hitDie: 8,
    savingThrows: ["wis", "cha"],
    skillChoiceCount: 2,
    skillOptions: ["history", "insight", "medicine", "persuasion", "religion"],
    armorProficiencies: ["light armor", "medium armor", "shields"],
    weaponProficiencies: ["simple weapons"],
    startingGold: { dice: 5, sides: 4, multiplier: 10 },
    fixedEquipment: ["shield", "holy symbol"],
    equipmentChoices: [
      {
        prompt: "Weapon",
        options: [
          { label: "(a) mace", items: ["mace"] },
          { label: "(b) warhammer (if proficient)", items: ["warhammer"] },
          { label: "(c) any simple weapon", items: ["simple weapon"] },
        ],
      },
      {
        prompt: "Armor",
        options: [
          { label: "(a) scale mail", items: ["scale mail"] },
          { label: "(b) leather armor", items: ["leather armor"] },
          { label: "(c) chain mail (if proficient)", items: ["chain mail"] },
        ],
      },
      {
        prompt: "Pack",
        options: [
          { label: "(a) priest's pack", items: ["priest's pack"] },
          { label: "(b) explorer's pack", items: ["explorer's pack"] },
        ],
      },
    ],
    subclassLevel: 1,
    subclasses: [
      { id: "knowledge", name: "Knowledge Domain", features: [{ name: "Blessings of Knowledge", description: "Proficiency in two languages and two of Arcana, History, Nature, or Religion." }] },
      { id: "life", name: "Life Domain", features: [{ name: "Bonus Proficiency", description: "Heavy armor proficiency." }, { name: "Disciple of Life", description: "Healing spells restore additional 2 + spell level HP." }] },
      { id: "light", name: "Light Domain", features: [{ name: "Bonus Cantrip", description: "You learn the light cantrip." }, { name: "Warding Flare", description: "Impose disadvantage on attack against ally within 30 ft." }] },
      { id: "nature", name: "Nature Domain", features: [{ name: "Acolyte of Nature", description: "One druid cantrip; proficiency in one of Animal Handling, Nature, or Survival." }] },
      { id: "tempest", name: "Tempest Domain", features: [{ name: "Bonus Proficiencies", description: "Heavy armor and martial weapons." }, { name: "Wrath of the Storm", description: "Reaction to deal thunder/lightning damage to attacker." }] },
      { id: "trickery", name: "Trickery Domain", features: [{ name: "Blessing of the Trickster", description: "Grant advantage on Stealth to ally within 30 ft." }] },
      { id: "war", name: "War Domain", features: [{ name: "Bonus Proficiencies", description: "Heavy armor and martial weapons." }, { name: "War Priest", description: "Bonus weapon attack when casting a cleric spell." }] },
    ],
    spellcasting: {
      ability: "wis",
      cantripsKnown: 3,
      preparedCaster: true,
      ritual: true,
      spellListId: "cleric",
    },
    features: [{ name: "Divine Domain", description: "Choose a domain at 1st level." }],
  },
  {
    id: "druid",
    name: "Druid",
    hitDie: 8,
    savingThrows: ["int", "wis"],
    skillChoiceCount: 2,
    skillOptions: [
      "arcana",
      "animalHandling",
      "insight",
      "medicine",
      "nature",
      "perception",
      "religion",
      "survival",
    ],
    armorProficiencies: ["light armor", "medium armor", "shields (nonmetal)"],
    weaponProficiencies: [
      "clubs",
      "daggers",
      "darts",
      "javelins",
      "maces",
      "quarterstaffs",
      "scimitars",
      "sickles",
      "slings",
      "spears",
    ],
    toolProficiencies: ["herbalism kit"],
    startingGold: { dice: 2, sides: 4, multiplier: 10 },
    fixedEquipment: ["leather armor", "explorer's pack", "druidic focus"],
    equipmentChoices: [
      {
        prompt: "Weapon",
        options: [
          { label: "(a) wooden shield", items: ["shield"] },
          { label: "(b) any simple weapon", items: ["simple weapon"] },
        ],
      },
      {
        prompt: "Secondary",
        options: [
          { label: "(a) scimitar", items: ["scimitar"] },
          { label: "(b) any simple melee weapon", items: ["simple melee weapon"] },
        ],
      },
    ],
    subclassLevel: 2,
    subclasses: [
      { id: "land", name: "Circle of the Land", features: [{ name: "Bonus Cantrip", description: "Learn one additional druid cantrip." }, { name: "Natural Recovery", description: "Recover spell slots on short rest once per day." }] },
      { id: "moon", name: "Circle of the Moon", features: [{ name: "Combat Wild Shape", description: "Bonus action wild shape; higher CR forms at 1st level." }] },
    ],
    spellcasting: {
      ability: "wis",
      cantripsKnown: 2,
      preparedCaster: true,
      ritual: true,
      spellListId: "druid",
    },
    features: [{ name: "Druidic", description: "Secret language of druids." }],
  },
  {
    id: "fighter",
    name: "Fighter",
    hitDie: 10,
    savingThrows: ["str", "con"],
    skillChoiceCount: 2,
    skillOptions: [
      "acrobatics",
      "animalHandling",
      "athletics",
      "history",
      "insight",
      "intimidation",
      "perception",
      "survival",
    ],
    armorProficiencies: ["all armor", "shields"],
    weaponProficiencies: ["simple weapons", "martial weapons"],
    startingGold: { dice: 5, sides: 4, multiplier: 10 },
    fixedEquipment: [],
    equipmentChoices: [
      {
        prompt: "Armor",
        options: [
          { label: "(a) chain mail", items: ["chain mail"] },
          { label: "(b) leather armor, longbow, and 20 arrows", items: ["leather armor", "longbow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow"] },
        ],
      },
      {
        prompt: "Weapon & shield",
        options: [
          { label: "(a) martial weapon and shield", items: ["martial weapon", "shield"] },
          { label: "(b) two martial weapons", items: ["martial weapon", "martial weapon"] },
        ],
      },
      {
        prompt: "Ranged or sidearm",
        options: [
          { label: "(a) light crossbow and 20 bolts", items: ["light crossbow", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt"] },
          { label: "(b) two handaxes", items: ["handaxe", "handaxe"] },
        ],
      },
      {
        prompt: "Pack",
        options: [
          { label: "(a) dungeoneer's pack", items: ["dungeoneer's pack"] },
          { label: "(b) explorer's pack", items: ["explorer's pack"] },
        ],
      },
    ],
    subclassLevel: 3,
    subclasses: [
      { id: "champion", name: "Champion", features: [{ name: "Improved Critical", description: "Critical hits on 19–20." }] },
      { id: "battle-master", name: "Battle Master", features: [{ name: "Combat Superiority", description: "Four superiority dice (d8) for maneuvers." }] },
      { id: "eldritch-knight", name: "Eldritch Knight", features: [{ name: "Spellcasting", description: "Intelligence-based wizard spells from abjuration and evocation." }] },
    ],
    features: [
      { name: "Fighting Style", description: "Choose a fighting style." },
      { name: "Second Wind", description: "Regain 1d10 + fighter level HP once per short rest." },
    ],
  },
  {
    id: "monk",
    name: "Monk",
    hitDie: 8,
    savingThrows: ["str", "dex"],
    skillChoiceCount: 2,
    skillOptions: [
      "acrobatics",
      "athletics",
      "history",
      "insight",
      "religion",
      "stealth",
    ],
    armorProficiencies: [],
    weaponProficiencies: ["simple weapons", "shortswords"],
    toolProficiencies: ["one artisan's tool or musical instrument"],
    startingGold: { dice: 5, sides: 4, multiplier: 1 },
    fixedEquipment: ["10 darts"],
    equipmentChoices: [
      {
        prompt: "Weapon",
        options: [
          { label: "(a) shortsword", items: ["shortsword"] },
          { label: "(b) any simple weapon", items: ["simple weapon"] },
        ],
      },
      {
        prompt: "Pack",
        options: [
          { label: "(a) dungeoneer's pack", items: ["dungeoneer's pack"] },
          { label: "(b) explorer's pack", items: ["explorer's pack"] },
        ],
      },
    ],
    subclassLevel: 3,
    subclasses: [
      { id: "open-hand", name: "Way of the Open Hand", features: [{ name: "Open Hand Technique", description: "Knock prone, push, or prevent reactions on Flurry hits." }] },
      { id: "shadow", name: "Way of Shadow", features: [{ name: "Shadow Arts", description: "Use ki to cast darkness, darkvision, pass without trace, or silence." }] },
      { id: "four-elements", name: "Way of the Four Elements", features: [{ name: "Disciple of the Elements", description: "Learn elemental disciplines using ki." }] },
    ],
    features: [
      { name: "Unarmored Defense", description: "AC = 10 + Dex + Wis without armor." },
      { name: "Martial Arts", description: "Use Dex for unarmed strikes and monk weapons; bonus unarmed strike." },
    ],
  },
  {
    id: "paladin",
    name: "Paladin",
    hitDie: 10,
    savingThrows: ["wis", "cha"],
    skillChoiceCount: 2,
    skillOptions: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"],
    armorProficiencies: ["all armor", "shields"],
    weaponProficiencies: ["simple weapons", "martial weapons"],
    startingGold: { dice: 5, sides: 4, multiplier: 10 },
    fixedEquipment: ["holy symbol", "javelin", "javelin", "javelin", "javelin", "javelin"],
    equipmentChoices: [
      {
        prompt: "Weapon",
        options: [
          { label: "(a) martial weapon and shield", items: ["martial weapon", "shield"] },
          { label: "(b) two martial weapons", items: ["martial weapon", "martial weapon"] },
        ],
      },
      {
        prompt: "Sidearm",
        options: [
          { label: "(a) five javelins", items: ["javelin", "javelin", "javelin", "javelin", "javelin"] },
          { label: "(b) any simple melee weapon", items: ["simple melee weapon"] },
        ],
      },
      {
        prompt: "Pack",
        options: [
          { label: "(a) priest's pack", items: ["priest's pack"] },
          { label: "(b) explorer's pack", items: ["explorer's pack"] },
        ],
      },
      {
        prompt: "Mount option",
        options: [
          { label: "(a) chain mail", items: ["chain mail"] },
          { label: "(b) leather armor, longbow, 20 arrows", items: ["leather armor", "longbow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow"] },
        ],
      },
    ],
    subclassLevel: 3,
    subclasses: [
      { id: "devotion", name: "Oath of Devotion", features: [{ name: "Channel Divinity", description: "Sacred Weapon and Turn the Unholy." }] },
      { id: "ancients", name: "Oath of the Ancients", features: [{ name: "Channel Divinity", description: "Nature's Wrath and Turn the Faithless." }] },
      { id: "vengeance", name: "Oath of Vengeance", features: [{ name: "Channel Divinity", description: "Abjure Enemy and Vow of Enmity." }] },
    ],
    features: [
      { name: "Divine Sense", description: "Detect celestials, fiends, and undead within 60 ft." },
      { name: "Lay on Hands", description: "Pool of 5 × paladin level HP for healing." },
    ],
  },
  {
    id: "ranger",
    name: "Ranger",
    hitDie: 10,
    savingThrows: ["str", "dex"],
    skillChoiceCount: 3,
    skillOptions: [
      "animalHandling",
      "athletics",
      "insight",
      "investigation",
      "nature",
      "perception",
      "stealth",
      "survival",
    ],
    armorProficiencies: ["light armor", "medium armor", "shields"],
    weaponProficiencies: ["simple weapons", "martial weapons"],
    startingGold: { dice: 5, sides: 4, multiplier: 10 },
    fixedEquipment: [],
    equipmentChoices: [
      {
        prompt: "Armor",
        options: [
          { label: "(a) scale mail", items: ["scale mail"] },
          { label: "(b) leather armor", items: ["leather armor"] },
        ],
      },
      {
        prompt: "Weapons",
        options: [
          { label: "(a) two shortswords", items: ["shortsword", "shortsword"] },
          { label: "(b) two simple melee weapons", items: ["simple melee weapon", "simple melee weapon"] },
        ],
      },
      {
        prompt: "Pack",
        options: [
          { label: "(a) dungeoneer's pack", items: ["dungeoneer's pack"] },
          { label: "(b) explorer's pack", items: ["explorer's pack"] },
        ],
      },
      {
        prompt: "Ranged",
        options: [
          { label: "(a) longbow and 20 arrows", items: ["longbow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow"] },
          { label: "(b) two handaxes", items: ["handaxe", "handaxe"] },
        ],
      },
    ],
    subclassLevel: 3,
    subclasses: [
      { id: "hunter", name: "Hunter", features: [{ name: "Hunter's Prey", description: "Choose Colossus Slayer, Giant Killer, or Horde Breaker at 3rd level." }] },
      { id: "beast-master", name: "Beast Master", features: [{ name: "Ranger's Companion", description: "Bond with a beast companion." }] },
    ],
    features: [
      { name: "Favored Enemy", description: "Advantage on Survival checks to track and Intelligence to recall info about chosen enemy type." },
      {
        name: "Natural Explorer",
        description:
          "While traveling for an hour or more in your favored terrain, you gain the following benefits:\n" +
          "• Difficult terrain doesn't slow your group's travel.\n" +
          "• Your group can't become lost except by magical means.\n" +
          "• Even when engaged in another activity while traveling (such as foraging, navigating, or tracking), you remain alert to danger.\n" +
          "• If you are traveling alone, you can move stealthily at a normal pace.\n" +
          "• When you forage, you find twice as much food as you normally would.\n" +
          "• While tracking other creatures, you learn their exact number, their sizes, and how long ago they passed through the area.",
      },
    ],
  },
  {
    id: "rogue",
    name: "Rogue",
    hitDie: 8,
    savingThrows: ["dex", "int"],
    skillChoiceCount: 4,
    skillOptions: [
      "acrobatics",
      "athletics",
      "deception",
      "insight",
      "intimidation",
      "investigation",
      "perception",
      "performance",
      "persuasion",
      "sleightOfHand",
      "stealth",
    ],
    armorProficiencies: ["light armor"],
    weaponProficiencies: ["simple weapons", "hand crossbows", "longswords", "rapiers", "shortswords"],
    toolProficiencies: ["thieves' tools"],
    startingGold: { dice: 4, sides: 4, multiplier: 10 },
    fixedEquipment: ["leather armor", "two daggers", "thieves' tools"],
    equipmentChoices: [
      {
        prompt: "Weapon",
        options: [
          { label: "(a) rapier", items: ["rapier"] },
          { label: "(b) shortsword", items: ["shortsword"] },
        ],
      },
      {
        prompt: "Ranged",
        options: [
          { label: "(a) shortbow and quiver of 20 arrows", items: ["shortbow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow"] },
          { label: "(b) shortsword", items: ["shortsword"] },
        ],
      },
      {
        prompt: "Pack",
        options: [
          { label: "(a) burglar's pack", items: ["burglar's pack"] },
          { label: "(b) dungeoneer's pack", items: ["dungeoneer's pack"] },
          { label: "(c) explorer's pack", items: ["explorer's pack"] },
        ],
      },
    ],
    subclassLevel: 3,
    subclasses: [
      { id: "thief", name: "Thief", features: [{ name: "Fast Hands", description: "Bonus action Sleight of Hand, use object, or Thieves' Tools." }] },
      { id: "assassin", name: "Assassin", features: [{ name: "Assassinate", description: "Advantage vs creatures that haven't acted; auto-crit on surprised foes." }] },
      { id: "arcane-trickster", name: "Arcane Trickster", features: [{ name: "Mage Hand Legerdemain", description: "Invisible mage hand; sleight of hand with it." }] },
    ],
    features: [
      { name: "Sneak Attack", description: "1d6 extra damage once per turn when you have advantage or ally within 5 ft of target." },
      { name: "Expertise", description: "Double proficiency bonus for two skills you are proficient in." },
      { name: "Thieves' Cant", description: "Secret mix of dialect, jargon, and code." },
    ],
  },
  {
    id: "sorcerer",
    name: "Sorcerer",
    hitDie: 6,
    savingThrows: ["con", "cha"],
    skillChoiceCount: 2,
    skillOptions: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"],
    armorProficiencies: [],
    weaponProficiencies: ["daggers", "darts", "slings", "quarterstaffs", "light crossbows"],
    startingGold: { dice: 3, sides: 4, multiplier: 10 },
    fixedEquipment: ["two daggers", "component pouch"],
    equipmentChoices: [
      {
        prompt: "Focus",
        options: [
          { label: "(a) light crossbow and 20 bolts", items: ["light crossbow", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt"] },
          { label: "(b) any simple weapon", items: ["simple weapon"] },
        ],
      },
      {
        prompt: "Pack",
        options: [
          { label: "(a) dungeoneer's pack", items: ["dungeoneer's pack"] },
          { label: "(b) explorer's pack", items: ["explorer's pack"] },
        ],
      },
      {
        prompt: "Arcane focus",
        options: [
          { label: "(a) component pouch", items: ["component pouch"] },
          { label: "(b) arcane focus", items: ["arcane focus"] },
        ],
      },
    ],
    subclassLevel: 1,
    subclasses: [
      { id: "draconic", name: "Draconic Bloodline", features: [{ name: "Dragon Ancestor", description: "Choose dragon type; draconic resilience and elemental affinity." }] },
      { id: "wild-magic", name: "Wild Magic", features: [{ name: "Wild Magic Surge", description: "Roll on Wild Magic table after casting a sorcerer spell." }, { name: "Tides of Chaos", description: "Gain advantage once per long rest; DM may trigger surge." }] },
    ],
    spellcasting: {
      ability: "cha",
      cantripsKnown: 4,
      spellsKnown: 2,
      ritual: false,
      spellListId: "sorcerer",
    },
    features: [{ name: "Sorcerous Origin", description: "Choose origin at 1st level." }],
  },
  {
    id: "warlock",
    name: "Warlock",
    hitDie: 8,
    savingThrows: ["wis", "cha"],
    skillChoiceCount: 2,
    skillOptions: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"],
    armorProficiencies: ["light armor"],
    weaponProficiencies: ["simple weapons"],
    startingGold: { dice: 4, sides: 4, multiplier: 10 },
    fixedEquipment: ["leather armor", "any simple weapon", "two daggers"],
    equipmentChoices: [
      {
        prompt: "Focus",
        options: [
          { label: "(a) light crossbow and 20 bolts", items: ["light crossbow", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt"] },
          { label: "(b) any simple weapon", items: ["simple weapon"] },
        ],
      },
      {
        prompt: "Pack",
        options: [
          { label: "(a) scholar's pack", items: ["scholar's pack"] },
          { label: "(b) dungeoneer's pack", items: ["dungeoneer's pack"] },
        ],
      },
      {
        prompt: "Arcane focus",
        options: [
          { label: "(a) component pouch", items: ["component pouch"] },
          { label: "(b) arcane focus", items: ["arcane focus"] },
        ],
      },
    ],
    subclassLevel: 1,
    subclasses: [
      { id: "archfey", name: "The Archfey", features: [{ name: "Fey Presence", description: "Charm or frighten creatures in 10-ft cube." }] },
      { id: "fiend", name: "The Fiend", features: [{ name: "Dark One's Blessing", description: "Gain temp HP when you reduce a hostile creature to 0 HP." }] },
      { id: "great-old-one", name: "The Great Old One", features: [{ name: "Awakened Mind", description: "Telepathic communication with creatures you can see within 30 ft." }] },
    ],
    spellcasting: {
      ability: "cha",
      cantripsKnown: 2,
      spellsKnown: 2,
      ritual: false,
      spellListId: "warlock",
    },
    features: [{ name: "Otherworldly Patron", description: "Choose patron at 1st level." }, { name: "Pact Magic", description: "Recover all spell slots on short rest." }],
  },
  {
    id: "wizard",
    name: "Wizard",
    hitDie: 6,
    savingThrows: ["int", "wis"],
    skillChoiceCount: 2,
    skillOptions: ["arcana", "history", "insight", "investigation", "medicine", "religion"],
    armorProficiencies: [],
    weaponProficiencies: ["daggers", "darts", "slings", "quarterstaffs", "light crossbows"],
    startingGold: { dice: 4, sides: 4, multiplier: 10 },
    fixedEquipment: ["spellbook"],
    equipmentChoices: [
      {
        prompt: "Weapon",
        options: [
          { label: "(a) quarterstaff", items: ["quarterstaff"] },
          { label: "(b) dagger", items: ["dagger"] },
        ],
      },
      {
        prompt: "Focus",
        options: [
          { label: "(a) component pouch", items: ["component pouch"] },
          { label: "(b) arcane focus", items: ["arcane focus"] },
        ],
      },
      {
        prompt: "Pack",
        options: [
          { label: "(a) scholar's pack", items: ["scholar's pack"] },
          { label: "(b) explorer's pack", items: ["explorer's pack"] },
        ],
      },
    ],
    subclassLevel: 2,
    subclasses: [
      { id: "abjuration", name: "School of Abjuration", features: [{ name: "Abjuration Savant", description: "Halve gold and time to copy abjuration spells." }] },
      { id: "conjuration", name: "School of Conjuration", features: [{ name: "Conjuration Savant", description: "Halve gold and time to copy conjuration spells." }] },
      { id: "divination", name: "School of Divination", features: [{ name: "Divination Savant", description: "Halve gold and time to copy divination spells." }] },
      { id: "enchantment", name: "School of Enchantment", features: [{ name: "Enchantment Savant", description: "Halve gold and time to copy enchantment spells." }] },
      { id: "evocation", name: "School of Evocation", features: [{ name: "Evocation Savant", description: "Halve gold and time to copy evocation spells." }] },
      { id: "illusion", name: "School of Illusion", features: [{ name: "Illusion Savant", description: "Halve gold and time to copy illusion spells." }] },
      { id: "necromancy", name: "School of Necromancy", features: [{ name: "Necromancy Savant", description: "Halve gold and time to copy necromancy spells." }] },
      { id: "transmutation", name: "School of Transmutation", features: [{ name: "Transmutation Savant", description: "Halve gold and time to copy transmutation spells." }] },
    ],
    spellcasting: {
      ability: "int",
      cantripsKnown: 3,
      spellbookAtLevel1: 6,
      preparedCaster: true,
      ritual: true,
      spellListId: "wizard",
    },
    features: [{ name: "Arcane Recovery", description: "Recover spell slots on short rest once per day." }],
  },
];

export function getClass(id: string): PhbClass | undefined {
  return PHB_CLASSES.find((c) => c.id === id);
}

export function classRequiresSubclassAtLevel1(classId: string): boolean {
  const cls = getClass(classId);
  return cls?.subclassLevel === 1;
}

export const FIGHTING_STYLES = [
  "Archery",
  "Defense",
  "Dueling",
  "Great Weapon Fighting",
  "Protection",
  "Two-Weapon Fighting",
];

export const FAVORED_ENEMIES = [
  "Aberrations",
  "Beasts",
  "Celestials",
  "Constructs",
  "Dragons",
  "Elementals",
  "Fey",
  "Fiends",
  "Giants",
  "Monstrosities",
  "Oozes",
  "Plants",
  "Undead",
  "Two humanoid species",
];

export const FAVORED_TERRAINS = [
  "Arctic",
  "Coast",
  "Desert",
  "Forest",
  "Grassland",
  "Mountain",
  "Swamp",
  "Underdark",
  "Urban",
];
