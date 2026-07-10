import { resolveCanonicalItemSlug } from "@/lib/items/slug-aliases";

export interface SpellMaterialAlternative {
  itemSlug: string;
  quantity?: number;
}

/** One OR-group: player picks exactly one alternative. Multiple groups are ANDed. */
export interface SpellMaterialChoiceGroup {
  label: string;
  alternatives: SpellMaterialAlternative[];
  consumed: boolean;
}

export interface SpellMaterialSpec {
  choiceGroups: SpellMaterialChoiceGroup[];
  /** When true, non-costly groups can be waived by component pouch or spellcasting focus. */
  focusWaivable: boolean;
}

/** Catalog item slugs that satisfy the same material (non-removed duplicates). */
export const SPELL_MATERIAL_ITEM_ALIASES: Record<string, string[]> = {
  "block-of-incense": ["incense-5-sticks", "burning-incense"],
};

export const SPELL_MATERIAL_REQUIREMENTS: Record<string, SpellMaterialSpec> = {
  message: {
    focusWaivable: true,
    choiceGroups: [
      {
        label: "Copper wire",
        alternatives: [{ itemSlug: "copper-wire" }],
        consumed: false,
      },
    ],
  },
  "fog-cloud": {
    focusWaivable: true,
    choiceGroups: [
      {
        label: "Phosphorus or wychwood",
        alternatives: [{ itemSlug: "phosphorus" }],
        consumed: false,
      },
    ],
  },
  "locate-animals-or-plants": {
    focusWaivable: true,
    choiceGroups: [
      {
        label: "Lodestones",
        alternatives: [{ itemSlug: "lodestone", quantity: 2 }],
        consumed: false,
      },
    ],
  },
  fireball: {
    focusWaivable: true,
    choiceGroups: [
      {
        label: "Bat guano and sulfur",
        alternatives: [{ itemSlug: "bat-guano-and-sulfur" }],
        consumed: false,
      },
    ],
  },
  "contact-other-plane": {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Charcoal, incense, and herbs",
        alternatives: [{ itemSlug: "charcoal-incense-herbs-10gp" }],
        consumed: true,
      },
    ],
  },
  identify: {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Pearl",
        alternatives: [{ itemSlug: "pearl-worth-100-gp" }],
        consumed: false,
      },
      {
        label: "Owl feather",
        alternatives: [{ itemSlug: "owl-feather" }],
        consumed: false,
      },
    ],
  },
  "magic-mouth": {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Lead-based ink",
        alternatives: [{ itemSlug: "lead-based-ink-10gp" }],
        consumed: true,
      },
    ],
  },
  "protection-from-evil-and-good": {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Holy water or powdered silver and iron",
        alternatives: [
          { itemSlug: "holy-water" },
          { itemSlug: "powdered-silver-and-iron-100-gp" },
        ],
        consumed: true,
      },
    ],
  },
  "continual-flame": {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Ruby dust",
        alternatives: [{ itemSlug: "ruby-dust-50-gp" }],
        consumed: true,
      },
    ],
  },
  "gentle-repose": {
    focusWaivable: true,
    choiceGroups: [
      {
        label: "Pinch of salt",
        alternatives: [{ itemSlug: "pinch-of-salt" }],
        consumed: true,
      },
      {
        label: "Copper coins",
        alternatives: [{ itemSlug: "copper-coin", quantity: 2 }],
        consumed: true,
      },
    ],
  },
  "glyph-of-warding": {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Incense",
        alternatives: [{ itemSlug: "burning-incense" }],
        consumed: true,
      },
      {
        label: "Diamond dust",
        alternatives: [{ itemSlug: "diamond-dust-200-gp" }],
        consumed: true,
      },
    ],
  },
  revivify: {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Diamonds",
        alternatives: [{ itemSlug: "diamonds-300-gp" }],
        consumed: true,
      },
    ],
  },
  "raise-dead": {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Diamond",
        alternatives: [{ itemSlug: "diamond-1000-gp" }],
        consumed: true,
      },
    ],
  },
  resurrection: {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Diamond dust",
        alternatives: [{ itemSlug: "diamond-5000-gp" }],
        consumed: true,
      },
      {
        label: "Herbs, oils, and incense",
        alternatives: [{ itemSlug: "herbs-oils-incense-1000-gp" }],
        consumed: true,
      },
    ],
  },
  "greater-restoration": {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Diamond dust",
        alternatives: [{ itemSlug: "diamond-dust-100-gp" }],
        consumed: true,
      },
    ],
  },
  heal: {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Rare oils and unguents",
        alternatives: [{ itemSlug: "rare-oils-unguents-1000-gp" }],
        consumed: true,
      },
    ],
  },
  hallow: {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Incense",
        alternatives: [{ itemSlug: "incense-250-gp" }],
        consumed: true,
      },
      {
        label: "Ivory strips",
        alternatives: [{ itemSlug: "ivory-strips-50-gp", quantity: 4 }],
        consumed: false,
      },
    ],
  },
  sequester: {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Jewel",
        alternatives: [{ itemSlug: "jewel-1000-gp" }],
        consumed: true,
      },
    ],
  },
  scrying: {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Gem-encrusted bowl",
        alternatives: [{ itemSlug: "gem-encrusted-bowl-1000-gp" }],
        consumed: true,
      },
    ],
  },
  "true-seeing": {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Eye ointment",
        alternatives: [{ itemSlug: "eye-ointment-25-gp" }],
        consumed: true,
      },
    ],
  },
  simulacrum: {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Powdered ruby",
        alternatives: [{ itemSlug: "ruby-dust-1500-gp" }],
        consumed: true,
      },
    ],
  },
  clone: {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Agate",
        alternatives: [{ itemSlug: "agate-1000-gp" }],
        consumed: true,
      },
    ],
  },
  "magic-jar": {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Miniature platinum sword",
        alternatives: [{ itemSlug: "platinum-sword-miniature-250-gp" }],
        consumed: false,
      },
    ],
  },
  "plane-shift": {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Forked metal rod",
        alternatives: [{ itemSlug: "forked-metal-rod-250-gp" }],
        consumed: false,
      },
    ],
  },
  "true-resurrection": {
    focusWaivable: false,
    choiceGroups: [
      {
        label: "Sprinkling of holy water",
        alternatives: [{ itemSlug: "holy-water-sprinkle" }],
        consumed: true,
      },
      {
        label: "Diamonds",
        alternatives: [{ itemSlug: "diamonds-25000-gp" }],
        consumed: true,
      },
    ],
  },
  "spirit-guardians": {
    focusWaivable: true,
    choiceGroups: [],
  },
  aid: {
    focusWaivable: true,
    choiceGroups: [
      {
        label: "Tiny strip of white cloth",
        alternatives: [{ itemSlug: "tiny-strip-of-white-cloth" }],
        consumed: false,
      },
    ],
  },
  "enhance-ability": {
    focusWaivable: true,
    choiceGroups: [
      {
        label: "Beast fur or feather",
        alternatives: [{ itemSlug: "beast-fur-or-feather" }],
        consumed: false,
      },
    ],
  },
};

export function getSpellMaterialSpec(spellSlug: string): SpellMaterialSpec | null {
  return SPELL_MATERIAL_REQUIREMENTS[spellSlug] ?? null;
}

export function spellRequiresMaterialEnforcement(spellSlug: string): boolean {
  const spec = getSpellMaterialSpec(spellSlug);
  if (!spec) return false;
  return spec.choiceGroups.length > 0 || spec.focusWaivable;
}

export function expandMaterialItemSlugs(itemSlug: string): string[] {
  const canonical = resolveCanonicalItemSlug(itemSlug);
  const aliases = SPELL_MATERIAL_ITEM_ALIASES[canonical] ?? [];
  return [...new Set([canonical, itemSlug, ...aliases])];
}
