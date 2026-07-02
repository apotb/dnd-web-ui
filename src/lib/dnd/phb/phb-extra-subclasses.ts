import type { PhbSubclass } from "./types";

/** PHB subclasses not present in the SRD API — merged after SRD seed. */
export const PHB_EXTRA_SUBCLASSES: Record<string, PhbSubclass[]> = {
  barbarian: [
    {
      id: "totem-warrior",
      name: "Path of the Totem Warrior",
      features: [
        {
          name: "Spirit Seeker",
          description:
            "Choose a totem spirit at 3rd level granting benefits while raging.",
          minLevel: 3,
        },
      ],
    },
  ],
  bard: [
    {
      id: "valor",
      name: "College of Valor",
      features: [
        {
          name: "Combat Inspiration",
          description:
            "Bardic Inspiration can add to AC or weapon damage rolls.",
          minLevel: 3,
        },
      ],
    },
  ],
  cleric: [
    {
      id: "knowledge",
      name: "Knowledge Domain",
      features: [
        {
          name: "Blessings of Knowledge",
          description:
            "Proficiency in two languages and two of Arcana, History, Nature, or Religion.",
          minLevel: 1,
        },
      ],
    },
    {
      id: "light",
      name: "Light Domain",
      features: [
        {
          name: "Bonus Cantrip",
          description: "You learn the light cantrip.",
          minLevel: 1,
        },
        {
          name: "Warding Flare",
          description:
            "Impose disadvantage on attack against ally within 30 ft.",
          minLevel: 1,
        },
      ],
    },
    {
      id: "nature",
      name: "Nature Domain",
      features: [
        {
          name: "Acolyte of Nature",
          description:
            "One druid cantrip; proficiency in one of Animal Handling, Nature, or Survival.",
          minLevel: 1,
        },
      ],
    },
    {
      id: "tempest",
      name: "Tempest Domain",
      features: [
        {
          name: "Bonus Proficiencies",
          description: "Heavy armor and martial weapons.",
          minLevel: 1,
        },
        {
          name: "Wrath of the Storm",
          description:
            "Reaction to deal thunder/lightning damage to attacker.",
          minLevel: 1,
        },
      ],
    },
    {
      id: "trickery",
      name: "Trickery Domain",
      features: [
        {
          name: "Blessing of the Trickster",
          description: "Grant advantage on Stealth to ally within 30 ft.",
          minLevel: 1,
        },
      ],
    },
    {
      id: "war",
      name: "War Domain",
      features: [
        {
          name: "Bonus Proficiencies",
          description: "Heavy armor and martial weapons.",
          minLevel: 1,
        },
        {
          name: "War Priest",
          description:
            "Bonus weapon attack when casting a cleric spell.",
          minLevel: 1,
        },
      ],
    },
  ],
  druid: [
    {
      id: "moon",
      name: "Circle of the Moon",
      features: [
        {
          name: "Combat Wild Shape",
          description:
            "Bonus action wild shape; higher CR forms at 1st level.",
          minLevel: 2,
        },
      ],
    },
  ],
  fighter: [
    {
      id: "battle-master",
      name: "Battle Master",
      features: [
        {
          name: "Combat Superiority",
          description: "Four superiority dice (d8) for maneuvers.",
          minLevel: 3,
        },
      ],
    },
    {
      id: "eldritch-knight",
      name: "Eldritch Knight",
      features: [
        {
          name: "Spellcasting",
          description:
            "Intelligence-based wizard spells from abjuration and evocation.",
          minLevel: 3,
        },
      ],
    },
  ],
  monk: [
    {
      id: "shadow",
      name: "Way of Shadow",
      features: [
        {
          name: "Shadow Arts",
          description:
            "Use ki to cast darkness, darkvision, pass without trace, or silence.",
          minLevel: 3,
        },
      ],
    },
    {
      id: "four-elements",
      name: "Way of the Four Elements",
      features: [
        {
          name: "Disciple of the Elements",
          description: "Learn elemental disciplines using ki.",
          minLevel: 3,
        },
      ],
    },
  ],
  paladin: [
    {
      id: "ancients",
      name: "Oath of the Ancients",
      features: [
        {
          name: "Channel Divinity",
          description: "Nature's Wrath and Turn the Faithless.",
          minLevel: 3,
        },
      ],
    },
    {
      id: "vengeance",
      name: "Oath of Vengeance",
      features: [
        {
          name: "Channel Divinity",
          description: "Abjure Enemy and Vow of Enmity.",
          minLevel: 3,
        },
      ],
    },
  ],
  ranger: [
    {
      id: "beast-master",
      name: "Beast Master",
      features: [
        {
          name: "Ranger's Companion",
          description: "Bond with a beast companion.",
          minLevel: 3,
        },
      ],
    },
  ],
  rogue: [
    {
      id: "assassin",
      name: "Assassin",
      features: [
        {
          name: "Assassinate",
          description:
            "Advantage vs creatures that haven't acted; auto-crit on surprised foes.",
          minLevel: 3,
        },
      ],
    },
    {
      id: "arcane-trickster",
      name: "Arcane Trickster",
      features: [
        {
          name: "Mage Hand Legerdemain",
          description: "Invisible mage hand; sleight of hand with it.",
          minLevel: 3,
        },
      ],
    },
  ],
  sorcerer: [
    {
      id: "draconic",
      name: "Draconic Bloodline",
      features: [
        {
          name: "Dragon Ancestor",
          description:
            "Choose dragon type; draconic resilience and elemental affinity.",
          minLevel: 1,
        },
      ],
    },
    {
      id: "wild-magic",
      name: "Wild Magic",
      features: [
        {
          name: "Wild Magic Surge",
          description: "Roll on Wild Magic table after casting a sorcerer spell.",
          minLevel: 1,
        },
        {
          name: "Tides of Chaos",
          slug: "tides-of-chaos",
          description:
            "Gain advantage once per long rest; DM may trigger surge.",
          minLevel: 1,
          mechanics: { kind: "uses", max: 1, restReset: "long" },
        },
      ],
    },
  ],
  warlock: [
    {
      id: "fiend",
      name: "The Fiend",
      features: [
        {
          name: "Dark One's Blessing",
          description:
            "Gain temp HP when you reduce a hostile creature to 0 HP.",
          minLevel: 1,
        },
      ],
    },
    {
      id: "great-old-one",
      name: "The Great Old One",
      features: [
        {
          name: "Awakened Mind",
          description:
            "Telepathic communication with creatures you can see within 30 ft.",
          minLevel: 1,
        },
      ],
    },
  ],
  wizard: [
    {
      id: "abjuration",
      name: "School of Abjuration",
      features: [
        {
          name: "Abjuration Savant",
          description: "Halve gold and time to copy abjuration spells.",
          minLevel: 2,
        },
      ],
    },
    {
      id: "conjuration",
      name: "School of Conjuration",
      features: [
        {
          name: "Conjuration Savant",
          description: "Halve gold and time to copy conjuration spells.",
          minLevel: 2,
        },
      ],
    },
    {
      id: "divination",
      name: "School of Divination",
      features: [
        {
          name: "Divination Savant",
          description: "Halve gold and time to copy divination spells.",
          minLevel: 2,
        },
      ],
    },
    {
      id: "enchantment",
      name: "School of Enchantment",
      features: [
        {
          name: "Enchantment Savant",
          description: "Halve gold and time to copy enchantment spells.",
          minLevel: 2,
        },
      ],
    },
    {
      id: "illusion",
      name: "School of Illusion",
      features: [
        {
          name: "Illusion Savant",
          description: "Halve gold and time to copy illusion spells.",
          minLevel: 2,
        },
      ],
    },
    {
      id: "necromancy",
      name: "School of Necromancy",
      features: [
        {
          name: "Necromancy Savant",
          description: "Halve gold and time to copy necromancy spells.",
          minLevel: 2,
        },
      ],
    },
    {
      id: "transmutation",
      name: "School of Transmutation",
      features: [
        {
          name: "Transmutation Savant",
          description: "Halve gold and time to copy transmutation spells.",
          minLevel: 2,
        },
      ],
    },
  ],
};
