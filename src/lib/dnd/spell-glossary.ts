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
  M: "Material — requires particular materials.",
} as const;

export const SPELL_FLAG_TOOLTIPS = {
  R: "Ritual — can be cast as a ritual (adds 10 minutes; no spell slot if you have the Ritual Casting feature).",
  C: "Concentration — you must maintain concentration for the spell's duration.",
} as const;

/** Omit "Concentration" prefix when the C badge already conveys it. */
export function formatSpellDurationForDisplay(
  duration: string,
  options?: { concentration?: boolean }
): string {
  const trimmed = duration.trim();
  if (!trimmed) return "";
  if (!options?.concentration) return trimmed;
  return trimmed.replace(/^Concentration,?\s+/i, "").trim();
}

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
  const parenthetical = components.match(/\bM\s*\(([^)]+)\)/i);
  if (parenthetical) return parenthetical[1]!.trim();

  for (const part of components.split(",")) {
    const trimmed = part.trim();
    if (/^M\b/i.test(trimmed)) {
      const detail = trimmed.replace(/^M\s*/i, "").trim();
      return detail.length > 0 ? detail : null;
    }
  }
  return null;
}

export interface SpellMaterialNotice {
  /** Material description without wrapping parens or consumed suffix. */
  description: string;
  consumed: boolean;
  costly: boolean;
}

function isCostlyMaterialText(text: string): boolean {
  return /\bworth\b/i.test(text) || /\bcosts?\b/i.test(text) || /\d+\s*gp\b/i.test(text);
}

/** Human-readable material requirement for spell cards and combat UI. */
export function getSpellMaterialNotice(components: string): SpellMaterialNotice | null {
  if (!parseSpellComponentLetters(components).includes("M")) return null;

  const raw = extractMaterialComponentText(components);
  if (!raw) {
    return { description: "Material component required", consumed: false, costly: false };
  }

  let description = raw.trim();
  if (description.startsWith("(") && description.endsWith(")")) {
    description = description.slice(1, -1).trim();
  }

  const consumed = /\bconsumed\b/i.test(raw) || /\bconsumed\b/i.test(components);
  if (consumed) {
    description = description
      .replace(/,?\s*consumed by the spell\.?$/i, "")
      .replace(/,?\s*consumed\.?$/i, "")
      .trim();
  }

  return { description, consumed, costly: isCostlyMaterialText(raw) };
}

/** Tooltip / log line for material requirements. */
export function formatSpellMaterialLine(components: string): string | null {
  const notice = getSpellMaterialNotice(components);
  if (!notice) return null;
  const suffix = notice.consumed ? " (consumed)" : "";
  return `Material: ${notice.description}${suffix}`;
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

/** Component letters only (e.g. "V, S, M") without material parenthetical text. */
export function formatSpellComponentsAbbreviated(components: string): string {
  return parseSpellComponentLetters(components).join(", ");
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
