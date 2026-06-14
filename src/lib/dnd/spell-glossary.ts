export const SPELL_SCHOOL_TOOLTIPS: Record<string, string> = {
  Abjuration:
    "Spells that block, banish, or protect. Often create barriers or end harmful effects.",
  Conjuration:
    "Spells that bring creatures or objects to you, or transport you elsewhere.",
  Divination:
    "Spells that reveal information, whether hidden objects, faraway places, or the future.",
  Enchantment:
    "Spells that affect the minds of others, influencing or controlling behavior.",
  Evocation:
    "Spells that manipulate magical energy to produce a desired effect, often dealing damage.",
  Illusion:
    "Spells that deceive the senses or minds of others.",
  Necromancy:
    "Spells that manipulate life energy: harm, heal, raise the dead, or create undead.",
  Transmutation:
    "Spells that change the properties of a creature, object, or environment.",
};

export const SPELL_COMPONENT_TOOLTIPS = {
  V: "Verbal — requires speaking mystic words.",
  S: "Somatic — requires precise hand gestures.",
  M: "Material — requires particular materials (see spell text).",
} as const;

export const SPELL_FLAG_TOOLTIPS = {
  R: "Ritual — can be cast as a ritual (adds 10 minutes; no spell slot if you have the Ritual Casting feature).",
  C: "Concentration — you must maintain concentration for the spell's duration.",
} as const;

export type SpellComponentLetter = keyof typeof SPELL_COMPONENT_TOOLTIPS;

export function getSpellSchoolTooltip(school: string): string | null {
  const key = school.trim();
  if (!key) return null;
  return (
    SPELL_SCHOOL_TOOLTIPS[key] ??
    SPELL_SCHOOL_TOOLTIPS[key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()] ??
    null
  );
}

/** Extract parenthetical material text from a components string, if any. */
export function extractMaterialComponentText(components: string): string | null {
  for (const part of components.split(",")) {
    const trimmed = part.trim();
    if (/^M\b/i.test(trimmed)) {
      const detail = trimmed.replace(/^M\s*/i, "").trim();
      return detail.length > 0 ? detail : null;
    }
  }
  return null;
}

export function parseSpellComponentLetters(components: string): SpellComponentLetter[] {
  const found = new Set<SpellComponentLetter>();
  for (const part of components.split(",")) {
    const head = part.trim().charAt(0).toUpperCase();
    if (head === "V" || head === "S" || head === "M") {
      found.add(head);
    }
  }
  return (["V", "S", "M"] as const).filter((letter) => found.has(letter));
}

export function getSpellComponentTooltip(
  letter: SpellComponentLetter,
  components?: string
): string {
  if (letter === "M" && components) {
    const material = extractMaterialComponentText(components);
    if (material) {
      return `${SPELL_COMPONENT_TOOLTIPS.M}\n${material}`;
    }
  }
  return SPELL_COMPONENT_TOOLTIPS[letter];
}
