import type { PhbSpell } from "./types";
import { SRD_SPELLS, type GeneratedSpell } from "./srd-spells.generated";

/** PHB cantrips and 1st-level spells appearing on at least one full caster class list. */
export const PHB_SPELLS: PhbSpell[] = [
  // Cantrips (level 0)
  {
    id: "acid-splash",
    name: "Acid Splash",
    level: 0,
    school: "Conjuration",
    castingTime: "1 action",
    range: "60 feet",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "Hurl a bubble of acid at one or two creatures within 5 feet of each other. On a hit, the target takes 1d6 acid damage.",
  },
  {
    id: "blade-ward",
    name: "Blade Ward",
    level: 0,
    school: "Abjuration",
    castingTime: "1 action",
    range: "Self",
    components: "V, S",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    description:
      "You have resistance to bludgeoning, piercing, and slashing damage from weapon attacks until the spell ends.",
  },
  {
    id: "chill-touch",
    name: "Chill Touch",
    level: 0,
    school: "Necromancy",
    castingTime: "1 action",
    range: "120 feet",
    components: "V, S",
    duration: "1 round",
    description:
      "Make a ranged spell attack that deals necrotic damage. The target can't regain hit points until the start of your next turn.",
  },
  {
    id: "dancing-lights",
    name: "Dancing Lights",
    level: 0,
    school: "Evocation",
    castingTime: "1 action",
    range: "120 feet",
    components: "V, S, M (a bit of phosphorus or wychwood, or a glowworm)",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    description:
      "Create up to four torch-sized lights that you can move within range. Each sheds dim light in a 10-foot radius.",
  },
  {
    id: "druidcraft",
    name: "Druidcraft",
    level: 0,
    school: "Transmutation",
    castingTime: "1 action",
    range: "30 feet",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "Create minor nature-themed effects such as predicting weather, making a flower bloom, or igniting a candle.",
  },
  {
    id: "eldritch-blast",
    name: "Eldritch Blast",
    level: 0,
    school: "Evocation",
    castingTime: "1 action",
    range: "120 feet",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "A beam of crackling energy streaks toward a creature. On a hit, it deals force damage and additional beams at higher levels.",
  },
  {
    id: "fire-bolt",
    name: "Fire Bolt",
    level: 0,
    school: "Evocation",
    castingTime: "1 action",
    range: "120 feet",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "Hurl a mote of fire at a creature. On a hit, the target takes fire damage and flammable objects may ignite.",
  },
  {
    id: "friends",
    name: "Friends",
    level: 0,
    school: "Enchantment",
    castingTime: "1 action",
    range: "Self",
    components: "V, S, M (a small amount of makeup)",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    description:
      "You have advantage on Charisma checks against one creature that isn't hostile toward you. When the spell ends, the creature realizes it was charmed.",
  },
  {
    id: "guidance",
    name: "Guidance",
    level: 0,
    school: "Divination",
    castingTime: "1 action",
    range: "Touch",
    components: "V, S",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    description:
      "The target can add 1d4 to one ability check of its choice before the spell ends.",
  },
  {
    id: "light",
    name: "Light",
    level: 0,
    school: "Evocation",
    castingTime: "1 action",
    range: "Touch",
    components: "V, M (a firefly or phosphorescent moss)",
    duration: "1 hour",
    description:
      "Touch an object to make it shed bright light in a 20-foot radius and dim light for an additional 20 feet. The light can be colored.",
  },
  {
    id: "mage-hand",
    name: "Mage Hand",
    level: 0,
    school: "Conjuration",
    castingTime: "1 action",
    range: "30 feet",
    components: "V, S",
    duration: "1 minute",
    description:
      "A spectral floating hand appears and can manipulate objects up to 10 pounds, open doors, or stow or retrieve items.",
  },
  {
    id: "mending",
    name: "Mending",
    level: 0,
    school: "Transmutation",
    castingTime: "1 minute",
    range: "Touch",
    components: "V, S, M (two lodestones)",
    duration: "Instantaneous",
    description:
      "Repair a single break or tear in an object, such as a broken chain, torn cloak, or leaking wineskin.",
  },
  {
    id: "message",
    name: "Message",
    level: 0,
    school: "Transmutation",
    castingTime: "1 action",
    range: "120 feet",
    components: "V, S, M (a short piece of copper wire)",
    duration: "1 round",
    description:
      "Whisper a message to a creature in range; only it can hear you and can reply in a whisper only you can hear.",
  },
  {
    id: "minor-illusion",
    name: "Minor Illusion",
    level: 0,
    school: "Illusion",
    castingTime: "1 action",
    range: "30 feet",
    components: "S, M (a bit of fleece)",
    duration: "1 minute",
    description:
      "Create a sound or a static image no larger than a 5-foot cube. Physical interaction reveals it as an illusion.",
  },
  {
    id: "poison-spray",
    name: "Poison Spray",
    level: 0,
    school: "Conjuration",
    castingTime: "1 action",
    range: "10 feet",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "Extend your hand toward a creature and force it to succeed on a Constitution save or take poison damage.",
  },
  {
    id: "prestidigitation",
    name: "Prestidigitation",
    level: 0,
    school: "Transmutation",
    castingTime: "1 action",
    range: "10 feet",
    components: "V, S",
    duration: "Up to 1 hour",
    description:
      "Perform minor magical tricks such as cleaning an object, warming food, creating a trinket, or marking a surface.",
  },
  {
    id: "produce-flame",
    name: "Produce Flame",
    level: 0,
    school: "Conjuration",
    castingTime: "1 action",
    range: "Self",
    components: "V, S",
    duration: "10 minutes",
    description:
      "A flickering flame appears in your hand, shedding light. You can hurl it as a ranged spell attack that deals fire damage.",
  },
  {
    id: "ray-of-frost",
    name: "Ray of Frost",
    level: 0,
    school: "Evocation",
    castingTime: "1 action",
    range: "60 feet",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "Make a ranged spell attack that deals cold damage. On a hit, the target's speed is reduced by 10 feet until your next turn.",
  },
  {
    id: "resistance",
    name: "Resistance",
    level: 0,
    school: "Abjuration",
    castingTime: "1 action",
    range: "Touch",
    components: "V, S, M (a miniature cloak)",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    description:
      "The target can add 1d4 to one saving throw of its choice before the spell ends.",
  },
  {
    id: "sacred-flame",
    name: "Sacred Flame",
    level: 0,
    school: "Evocation",
    castingTime: "1 action",
    range: "60 feet",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "Flame-like radiance descends on a creature. It must succeed on a Dexterity save or take radiant damage; cover doesn't help.",
  },
  {
    id: "shillelagh",
    name: "Shillelagh",
    level: 0,
    school: "Transmutation",
    castingTime: "1 bonus action",
    range: "Touch",
    components: "V, S, M (mistletoe, a shamrock leaf, and a club or quarterstaff)",
    duration: "1 minute",
    description:
      "A club or quarterstaff becomes magical and uses your spellcasting ability for attack and damage rolls.",
  },
  {
    id: "shocking-grasp",
    name: "Shocking Grasp",
    level: 0,
    school: "Evocation",
    castingTime: "1 action",
    range: "Touch",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "Make a melee spell attack that deals lightning damage. You have advantage if the target wears metal armor, and it can't take reactions until its next turn.",
  },
  {
    id: "spare-the-dying",
    name: "Spare the Dying",
    level: 0,
    school: "Necromancy",
    castingTime: "1 action",
    range: "Touch",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "Stabilize a creature with 0 hit points without needing a medicine check.",
  },
  {
    id: "thaumaturgy",
    name: "Thaumaturgy",
    level: 0,
    school: "Transmutation",
    castingTime: "1 action",
    range: "30 feet",
    components: "V",
    duration: "Up to 1 minute",
    description:
      "Manifest minor miracles such as a booming voice, flickering flames, trembling ground, or an unlocked door opening.",
  },
  {
    id: "thorn-whip",
    name: "Thorn Whip",
    level: 0,
    school: "Transmutation",
    castingTime: "1 action",
    range: "30 feet",
    components: "V, S, M (the stem of a plant with thorns)",
    duration: "Instantaneous",
    description:
      "Make a ranged spell attack that deals piercing damage and pulls the target up to 10 feet closer to you.",
  },
  {
    id: "true-strike",
    name: "True Strike",
    level: 0,
    school: "Divination",
    castingTime: "1 action",
    range: "30 feet",
    components: "S",
    duration: "Concentration, up to 1 round",
    concentration: true,
    description:
      "Extend your hand and point at a target. On your next turn, you gain advantage on your first attack roll against it.",
  },
  {
    id: "vicious-mockery",
    name: "Vicious Mockery",
    level: 0,
    school: "Enchantment",
    castingTime: "1 action",
    range: "60 feet",
    components: "V",
    duration: "Instantaneous",
    description:
      "Unleash a string of insults at a creature. On a failed Wisdom save, it takes psychic damage and has disadvantage on the next attack roll it makes before the end of its next turn.",
  },

  // 1st-level spells
  {
    id: "alarm",
    name: "Alarm",
    level: 1,
    school: "Abjuration",
    castingTime: "1 minute",
    range: "30 feet",
    components: "V, S, M (a tiny bell and a piece of fine silver wire)",
    duration: "8 hours",
    ritual: true,
    description:
      "Set an alarm against intrusion in a 20-foot cube. You are alerted mentally or audibly when a Tiny or larger creature enters.",
  },
  {
    id: "animal-friendship",
    name: "Animal Friendship",
    level: 1,
    school: "Enchantment",
    castingTime: "1 action",
    range: "30 feet",
    components: "V, S, M (a morsel of food)",
    duration: "24 hours",
    description:
      "Choose beasts with Intelligence 3 or less. Each must succeed on a Wisdom save or be charmed by you for the duration.",
  },
  {
    id: "armor-of-agathys",
    name: "Armor of Agathys",
    level: 1,
    school: "Abjuration",
    castingTime: "1 action",
    range: "Self",
    components: "V, S, M (a cup of water)",
    duration: "1 hour",
    description:
      "Gain temporary hit points. When a creature hits you with a melee attack, it takes cold damage while you have any of those temp HP.",
  },
  {
    id: "arms-of-hadar",
    name: "Arms of Hadar",
    level: 1,
    school: "Conjuration",
    castingTime: "1 action",
    range: "Self (10-foot radius)",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "Ghostly tentacles erupt around you. Each creature in range must succeed on a Strength save or take necrotic damage and can't take reactions until its next turn.",
  },
  {
    id: "bane",
    name: "Bane",
    level: 1,
    school: "Enchantment",
    castingTime: "1 action",
    range: "30 feet",
    components: "V, S, M (a drop of blood)",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    description:
      "Up to three creatures must succeed on a Charisma save or subtract 1d4 from attack rolls and saving throws while the spell lasts.",
  },
  {
    id: "bless",
    name: "Bless",
    level: 1,
    school: "Enchantment",
    castingTime: "1 action",
    range: "30 feet",
    components: "V, S, M (a sprinkling of holy water)",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    description:
      "Up to three creatures of your choice add 1d4 to attack rolls and saving throws for the duration.",
  },
  {
    id: "burning-hands",
    name: "Burning Hands",
    level: 1,
    school: "Evocation",
    castingTime: "1 action",
    range: "Self (15-foot cone)",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "A thin sheet of flames shoots from your fingertips. Each creature in a 15-foot cone must make a Dexterity save or take fire damage.",
  },
  {
    id: "charm-person",
    name: "Charm Person",
    level: 1,
    school: "Enchantment",
    castingTime: "1 action",
    range: "30 feet",
    components: "V, S",
    duration: "1 hour",
    description:
      "A humanoid must succeed on a Wisdom save or be charmed by you. It regards you as a friendly acquaintance while charmed.",
  },
  {
    id: "chromatic-orb",
    name: "Chromatic Orb",
    level: 1,
    school: "Evocation",
    castingTime: "1 action",
    range: "90 feet",
    components: "V, S, M (a diamond worth at least 50 gp)",
    duration: "Instantaneous",
    description:
      "Hurl a 4-inch-diameter sphere of energy at a creature. On a hit, it takes damage of a type you choose: acid, cold, fire, lightning, poison, or thunder.",
  },
  {
    id: "color-spray",
    name: "Color Spray",
    level: 1,
    school: "Illusion",
    castingTime: "1 action",
    range: "Self (15-foot cone)",
    components: "V, S, M (a pinch of powder or sand colored red, yellow, and blue)",
    duration: "1 round",
    description:
      "A dazzling array of flashing colors blinds creatures in a 15-foot cone until the end of your next turn.",
  },
  {
    id: "command",
    name: "Command",
    level: 1,
    school: "Enchantment",
    castingTime: "1 action",
    range: "60 feet",
    components: "V",
    duration: "Instantaneous",
    description:
      "Speak a one-word command to a creature you can see. On a failed Wisdom save, it follows the command on its next turn.",
  },
  {
    id: "comprehend-languages",
    name: "Comprehend Languages",
    level: 1,
    school: "Divination",
    castingTime: "1 action",
    range: "Self",
    components: "V, S, M (a pinch of soot and salt)",
    duration: "1 hour",
    ritual: true,
    description:
      "Understand the literal meaning of spoken and written languages you hear or see for the duration.",
  },
  {
    id: "create-or-destroy-water",
    name: "Create or Destroy Water",
    level: 1,
    school: "Transmutation",
    castingTime: "1 action",
    range: "30 feet",
    components: "V, S, M (a drop of water if creating, a few grains of sand if destroying)",
    duration: "Instantaneous",
    description:
      "Create up to 10 gallons of clean water in an open container, or destroy up to 10 gallons of water in an open container within range.",
  },
  {
    id: "cure-wounds",
    name: "Cure Wounds",
    level: 1,
    school: "Evocation",
    castingTime: "1 action",
    range: "Touch",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "A creature you touch regains a number of hit points equal to 1d8 plus your spellcasting ability modifier.",
  },
  {
    id: "detect-evil-and-good",
    name: "Detect Evil and Good",
    level: 1,
    school: "Divination",
    castingTime: "1 action",
    range: "Self",
    components: "V, S",
    duration: "Concentration, up to 10 minutes",
    concentration: true,
    description:
      "Sense the presence of aberrations, celestials, elementals, fey, fiends, and undead within 30 feet and learn their type.",
  },
  {
    id: "detect-magic",
    name: "Detect Magic",
    level: 1,
    school: "Divination",
    castingTime: "1 action",
    range: "Self",
    components: "V, S",
    duration: "Concentration, up to 10 minutes",
    ritual: true,
    concentration: true,
    description:
      "Sense the presence of magic within 30 feet. You can use an action to see a faint aura around any visible magic and learn its school.",
  },
  {
    id: "detect-poison-and-disease",
    name: "Detect Poison and Disease",
    level: 1,
    school: "Divination",
    castingTime: "1 action",
    range: "Self",
    components: "V, S, M (a yew leaf)",
    duration: "Concentration, up to 10 minutes",
    ritual: true,
    concentration: true,
    description:
      "Sense the presence and location of poisons, poisonous creatures, and magical contagions within 30 feet.",
  },
  {
    id: "disguise-self",
    name: "Disguise Self",
    level: 1,
    school: "Illusion",
    castingTime: "1 action",
    range: "Self",
    components: "V, S",
    duration: "1 hour",
    description:
      "Make yourself—including your clothing, armor, weapons, and other belongings—look different until the spell ends.",
  },
  {
    id: "entangle",
    name: "Entangle",
    level: 1,
    school: "Conjuration",
    castingTime: "1 action",
    range: "90 feet",
    components: "V, S",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    description:
      "Grasping weeds and vines sprout in a 20-foot square. A creature in the area must save or be restrained by the plants.",
  },
  {
    id: "expeditious-retreat",
    name: "Expeditious Retreat",
    level: 1,
    school: "Transmutation",
    castingTime: "1 bonus action",
    range: "Self",
    components: "V, S",
    duration: "Concentration, up to 10 minutes",
    concentration: true,
    description:
      "Take the Dash action as a bonus action on each of your turns for the duration.",
  },
  {
    id: "faerie-fire",
    name: "Faerie Fire",
    level: 1,
    school: "Evocation",
    castingTime: "1 action",
    range: "60 feet",
    components: "V",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    description:
      "Outline objects in a 20-foot cube in light. Attack rolls against affected creatures have advantage, and they can't benefit from being invisible.",
  },
  {
    id: "false-life",
    name: "False Life",
    level: 1,
    school: "Necromancy",
    castingTime: "1 action",
    range: "Self",
    components: "V, S, M (a small amount of alcohol or distilled spirits)",
    duration: "1 hour",
    description:
      "Bolster yourself with a necromantic facsimile of life, gaining 1d4 + 4 temporary hit points for the duration.",
  },
  {
    id: "feather-fall",
    name: "Feather Fall",
    level: 1,
    school: "Transmutation",
    castingTime: "1 reaction, which you take when you or a creature within 60 feet of you falls",
    range: "60 feet",
    components: "V, M (a small feather or piece of down)",
    duration: "1 minute",
    description:
      "Choose up to five falling creatures. Their rate of descent slows to 60 feet per round until the spell ends.",
  },
  {
    id: "find-familiar",
    name: "Find Familiar",
    level: 1,
    school: "Conjuration",
    castingTime: "1 hour",
    range: "10 feet",
    components: "V, S, M (10 gp worth of charcoal, incense, and herbs that must be consumed by fire)",
    duration: "Instantaneous",
    ritual: true,
    description:
      "Gain the service of a spirit that takes an animal form you choose. It obeys your commands and can deliver touch spells.",
  },
  {
    id: "fog-cloud",
    name: "Fog Cloud",
    level: 1,
    school: "Conjuration",
    castingTime: "1 action",
    range: "120 feet",
    components: "V, S",
    duration: "Concentration, up to 1 hour",
    concentration: true,
    description:
      "Create a 20-foot-radius sphere of fog that spreads around corners and heavily obscures the area.",
  },
  {
    id: "goodberry",
    name: "Goodberry",
    level: 1,
    school: "Transmutation",
    castingTime: "1 action",
    range: "Touch",
    components: "V, S, M (a sprig of mistletoe)",
    duration: "Instantaneous",
    description:
      "Create up to ten berries infused with magic. A creature can use an action to eat one berry and regain 1 hit point; the berry also provides nourishment for one day.",
  },
  {
    id: "grease",
    name: "Grease",
    level: 1,
    school: "Conjuration",
    castingTime: "1 action",
    range: "60 feet",
    components: "V, S, M (a bit of pork rind or butter)",
    duration: "1 minute",
    description:
      "Slick grease covers a 10-foot square. Creatures entering or starting their turn there must save or fall prone.",
  },
  {
    id: "guiding-bolt",
    name: "Guiding Bolt",
    level: 1,
    school: "Evocation",
    castingTime: "1 action",
    range: "120 feet",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "Make a ranged spell attack that deals radiant damage. The next attack roll against the target before the end of your next turn has advantage.",
  },
  {
    id: "guiding-hand",
    name: "Guiding Hand",
    level: 1,
    school: "Divination",
    castingTime: "1 minute",
    range: "5 feet",
    components: "V, S",
    duration: "Concentration, up to 8 hours",
    ritual: true,
    concentration: true,
    description:
      "Create a Tiny incorporeal hand of shimmering light in an unoccupied space you can see within range. It lasts for the duration but disappears if you teleport or travel to another plane. When it appears, name one major mapped landmark on your plane (such as a city, mountain, castle, or battlefield); the spell fails if no map of that site exists. When you move toward the hand, it moves away at your speed toward the landmark, always staying 5 feet from you. If you don't move toward it, it stays in place and beckons you to follow once every 1d4 minutes.",
  },
  {
    id: "healing-word",
    name: "Healing Word",
    level: 1,
    school: "Evocation",
    castingTime: "1 bonus action",
    range: "60 feet",
    components: "V",
    duration: "Instantaneous",
    description:
      "A creature you can see regains hit points equal to 1d4 plus your spellcasting ability modifier.",
  },
  {
    id: "hellish-rebuke",
    name: "Hellish Rebuke",
    level: 1,
    school: "Evocation",
    castingTime: "1 reaction, which you take in response to being damaged by a creature within 60 feet of you that you can see",
    range: "60 feet",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "The creature that damaged you must succeed on a Dexterity save or take fire damage as you point your finger and invoke infernal power.",
  },
  {
    id: "heroism",
    name: "Heroism",
    level: 1,
    school: "Enchantment",
    castingTime: "1 action",
    range: "Touch",
    components: "V, S",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    description:
      "A willing creature becomes immune to being frightened and gains temporary hit points at the start of each of its turns.",
  },
  {
    id: "hex",
    name: "Hex",
    level: 1,
    school: "Enchantment",
    castingTime: "1 bonus action",
    range: "90 feet",
    components: "V, S, M (the petrified eye of a newt)",
    duration: "Concentration, up to 1 hour",
    concentration: true,
    description:
      "Curse a creature you can see. You deal extra necrotic damage when you hit it, and it has disadvantage on ability checks with an ability you choose.",
  },
  {
    id: "hideous-laughter",
    name: "Hideous Laughter",
    level: 1,
    school: "Enchantment",
    castingTime: "1 action",
    range: "30 feet",
    components: "V, S, M (tiny tarts and a feather that is waved in the air)",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    description:
      "A creature must succeed on a Wisdom save or fall prone, becoming incapacitated and unable to stand as it is overcome with laughter.",
  },
  {
    id: "identify",
    name: "Identify",
    level: 1,
    school: "Divination",
    castingTime: "1 minute",
    range: "Touch",
    components: "V, S, M (a pearl worth at least 100 gp and an owl feather)",
    duration: "Instantaneous",
    ritual: true,
    description:
      "Learn the properties of a magic item you touch, including how to use it and whether it requires attunement.",
  },
  {
    id: "illusory-script",
    name: "Illusory Script",
    level: 1,
    school: "Illusion",
    castingTime: "1 minute",
    range: "Touch",
    components: "V, S, M (a lead-based ink worth at least 10 gp, consumed by the spell)",
    duration: "10 days",
    ritual: true,
    description:
      "Write on parchment so that only creatures you designate can read the message; others see unintelligible writing or a different message.",
  },
  {
    id: "inflict-wounds",
    name: "Inflict Wounds",
    level: 1,
    school: "Necromancy",
    castingTime: "1 action",
    range: "Touch",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "Make a melee spell attack against a creature. On a hit, the target takes necrotic damage.",
  },
  {
    id: "jump",
    name: "Jump",
    level: 1,
    school: "Transmutation",
    castingTime: "1 action",
    range: "Touch",
    components: "V, S, M (a grasshopper's hind leg)",
    duration: "1 minute",
    description:
      "Touch a willing creature. Its jump distance is tripled for the duration.",
  },
  {
    id: "longstrider",
    name: "Longstrider",
    level: 1,
    school: "Transmutation",
    castingTime: "1 action",
    range: "Touch",
    components: "V, S, M (a pinch of dirt)",
    duration: "1 hour",
    description:
      "Touch a creature. Its speed increases by 10 feet until the spell ends.",
  },
  {
    id: "mage-armor",
    name: "Mage Armor",
    level: 1,
    school: "Abjuration",
    castingTime: "1 action",
    range: "Touch",
    components: "V, S, M (a piece of cured leather)",
    duration: "8 hours",
    description:
      "Touch a willing unarmored creature. Its base AC becomes 13 plus its Dexterity modifier for the duration.",
  },
  {
    id: "magic-missile",
    name: "Magic Missile",
    level: 1,
    school: "Evocation",
    castingTime: "1 action",
    range: "120 feet",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "Create three glowing darts of force. Each dart automatically hits a creature you choose, dealing force damage.",
  },
  {
    id: "protection-from-evil-and-good",
    name: "Protection from Evil and Good",
    level: 1,
    school: "Abjuration",
    castingTime: "1 action",
    range: "Touch",
    components: "V, S, M (holy water or powdered silver and iron, consumed by the spell)",
    duration: "Concentration, up to 10 minutes",
    concentration: true,
    description:
      "Ward a willing creature against aberrations, celestials, elementals, fey, fiends, and undead. Those creatures have disadvantage on attacks against the target.",
  },
  {
    id: "purify-food-and-drink",
    name: "Purify Food and Drink",
    level: 1,
    school: "Transmutation",
    castingTime: "1 action",
    range: "10 feet",
    components: "V, S",
    duration: "Instantaneous",
    ritual: true,
    description:
      "All nonmagical food and drink within a 5-foot-radius sphere is purified and rendered free of poison and disease.",
  },
  {
    id: "ray-of-sickness",
    name: "Ray of Sickness",
    level: 1,
    school: "Necromancy",
    castingTime: "1 action",
    range: "60 feet",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "Make a ranged spell attack that deals poison damage. On a hit, the target must succeed on a Constitution save or be poisoned until the end of your next turn.",
  },
  {
    id: "sanctuary",
    name: "Sanctuary",
    level: 1,
    school: "Abjuration",
    castingTime: "1 bonus action",
    range: "30 feet",
    components: "V, S, M (a small silver mirror)",
    duration: "1 minute",
    description:
      "Ward a creature against attack. Before targeting it, an attacker must succeed on a Wisdom save or choose a new target.",
  },
  {
    id: "shield",
    name: "Shield",
    level: 1,
    school: "Abjuration",
    castingTime: "1 reaction, which you take when you are hit by an attack or targeted by the magic missile spell",
    range: "Self",
    components: "V, S",
    duration: "1 round",
    description:
      "An invisible barrier grants you a +5 bonus to AC until the start of your next turn, including against the triggering attack, and blocks magic missile.",
  },
  {
    id: "shield-of-faith",
    name: "Shield of Faith",
    level: 1,
    school: "Abjuration",
    castingTime: "1 bonus action",
    range: "60 feet",
    components: "V, S, M (a small parchment with a bit of holy text written on it)",
    duration: "Concentration, up to 10 minutes",
    concentration: true,
    description:
      "A shimmering field surrounds a creature, granting it a +2 bonus to AC for the duration.",
  },
  {
    id: "silent-image",
    name: "Silent Image",
    level: 1,
    school: "Illusion",
    castingTime: "1 action",
    range: "60 feet",
    components: "V, S, M (a bit of fleece)",
    duration: "Concentration, up to 10 minutes",
    concentration: true,
    description:
      "Create the image of an object, creature, or visible phenomenon no larger than a 15-foot cube. It doesn't create sound, smell, or other sensory effects.",
  },
  {
    id: "sleep",
    name: "Sleep",
    level: 1,
    school: "Enchantment",
    castingTime: "1 action",
    range: "90 feet",
    components: "V, S, M (a pinch of fine sand, rose petals, or a cricket)",
    duration: "1 minute",
    description:
      "Roll 5d8; creatures in range with the lowest current hit points fall unconscious until the spell ends or they take damage.",
  },
  {
    id: "speak-with-animals",
    name: "Speak with Animals",
    level: 1,
    school: "Divination",
    castingTime: "1 action",
    range: "Self",
    components: "V, S",
    duration: "10 minutes",
    ritual: true,
    description:
      "Comprehend and communicate with beasts. They can share information about nearby locations, monsters, and recent events.",
  },
  {
    id: "tensers-floating-disk",
    name: "Tenser's Floating Disk",
    level: 1,
    school: "Conjuration",
    castingTime: "1 action",
    range: "30 feet",
    components: "V, S, M (a drop of mercury)",
    duration: "1 hour",
    ritual: true,
    description:
      "Create a horizontal force disk that follows you and can carry up to 500 pounds. It hovers at waist height and can be used as a step.",
  },
  {
    id: "thunderwave",
    name: "Thunderwave",
    level: 1,
    school: "Evocation",
    castingTime: "1 action",
    range: "Self (15-foot cube)",
    components: "V, S",
    duration: "Instantaneous",
    description:
      "A wave of thunderous force sweeps out from you. Creatures in a 15-foot cube must save or take thunder damage and be pushed 10 feet away.",
  },
  {
    id: "unseen-servant",
    name: "Unseen Servant",
    level: 1,
    school: "Conjuration",
    castingTime: "1 action",
    range: "60 feet",
    components: "V, S, M (a piece of string and a bit of wood)",
    duration: "1 hour",
    ritual: true,
    description:
      "Create an invisible, mindless, shapeless force that performs simple tasks such as cleaning, folding clothes, or serving food.",
  },
  {
    id: "witch-bolt",
    name: "Witch Bolt",
    level: 1,
    school: "Evocation",
    castingTime: "1 action",
    range: "30 feet",
    components: "V, S, M (a twig from a tree that has been struck by lightning)",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    description:
      "A beam of crackling energy lances toward a creature. On a hit, you can use your action on later turns to deal lightning damage to the same target automatically.",
  },
];

/** Class lists for PHB spells not present in the SRD generated catalog. */
export const PHB_ONLY_SPELL_CLASSES: Record<string, string[]> = {
  "armor-of-agathys": ["warlock"],
  "arms-of-hadar": ["warlock"],
  "blade-ward": ["bard", "sorcerer", "warlock", "wizard"],
  "chromatic-orb": ["sorcerer", "wizard"],
  friends: ["bard", "sorcerer", "warlock", "wizard"],
  "guiding-hand": ["cleric"],
  hex: ["warlock"],
  "ray-of-sickness": ["sorcerer", "wizard"],
  "tensers-floating-disk": ["wizard"],
  "thorn-whip": ["druid"],
  "witch-bolt": ["sorcerer", "warlock", "wizard"],
};

function resolveSpellClasses(spell: PhbSpell, srd?: GeneratedSpell): string[] {
  if (srd?.classes?.length) return srd.classes;
  if (spell.classes?.length) return spell.classes;
  return PHB_ONLY_SPELL_CLASSES[spell.id] ?? [];
}

/** Merge hand-written PHB entries with full SRD catalog; PHB text wins on slug overlap. */
function mergeSpellCatalogs(): GeneratedSpell[] {
  const byId = new Map<string, GeneratedSpell>();
  for (const spell of SRD_SPELLS) {
    byId.set(spell.id, spell);
  }
  for (const spell of PHB_SPELLS) {
    const srd = byId.get(spell.id);
    byId.set(spell.id, {
      ...(srd ?? { classes: [] }),
      ...spell,
      classes: resolveSpellClasses(spell, srd),
    });
  }
  return [...byId.values()].sort(
    (a, b) => a.level - b.level || a.name.localeCompare(b.name)
  );
}

export const ALL_SPELLS: GeneratedSpell[] = mergeSpellCatalogs();

export function buildSpellLists(spells: PhbSpell[]): Record<string, string[]> {
  const lists: Record<string, string[]> = {};
  for (const spell of spells) {
    for (const listId of spell.classes ?? []) {
      if (!lists[listId]) lists[listId] = [];
      lists[listId].push(spell.id);
    }
  }
  for (const ids of Object.values(lists)) {
    ids.sort((a, b) => a.localeCompare(b));
  }
  return lists;
}

/** Class spell list ids mapped to spell slugs (all levels). */
export const SPELL_LISTS: Record<string, string[]> = buildSpellLists(ALL_SPELLS);

const spellById = new Map(ALL_SPELLS.map((spell) => [spell.id, spell]));

export function getSpell(id: string): PhbSpell | undefined {
  return spellById.get(id);
}

export function getSpellsForList(listId: string): PhbSpell[] {
  return ALL_SPELLS.filter((spell) => spell.classes?.includes(listId));
}

export function getCantripsForList(listId: string): PhbSpell[] {
  return getSpellsForList(listId).filter((spell) => spell.level === 0);
}

export function getLevel1SpellsForList(listId: string): PhbSpell[] {
  return getSpellsForList(listId).filter((spell) => spell.level === 1);
}
