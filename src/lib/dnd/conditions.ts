/** PHB / SRD conditions catalog — seeded to DB and used as fallback when table is empty. */

export interface PhbCondition {
  slug: string;
  name: string;
  description: string;
  isStandard: boolean;
  source: string;
}

export function slugifyConditionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const PHB_CONDITIONS: PhbCondition[] = [
  {
    slug: "blinded",
    name: "Blinded",
    isStandard: true,
    source: "SRD",
    description:
      "• A blinded creature can't see and automatically fails any ability check that requires sight.\n" +
      "• Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage.",
  },
  {
    slug: "charmed",
    name: "Charmed",
    isStandard: true,
    source: "SRD",
    description:
      "• A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects.\n" +
      "• The charmer has advantage on any ability check to interact socially with the creature.",
  },
  {
    slug: "deafened",
    name: "Deafened",
    isStandard: true,
    source: "SRD",
    description:
      "• A deafened creature can't hear and automatically fails any ability check that requires hearing.",
  },
  {
    slug: "exhaustion",
    name: "Exhaustion",
    isStandard: true,
    source: "SRD",
    description:
      "Exhaustion is measured in six levels. An effect can give a creature one or more levels of exhaustion.\n" +
      "1: Disadvantage on ability checks.\n" +
      "2: Speed halved.\n" +
      "3: Disadvantage on attack rolls and saving throws.\n" +
      "4: Hit point maximum halved.\n" +
      "5: Speed reduced to 0.\n" +
      "6: Death.",
  },
  {
    slug: "frightened",
    name: "Frightened",
    isStandard: true,
    source: "SRD",
    description:
      "• A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight.\n" +
      "• The creature can't willingly move closer to the source of its fear.",
  },
  {
    slug: "grappled",
    name: "Grappled",
    isStandard: true,
    source: "SRD",
    description:
      "• A grappled creature's speed becomes 0, and it can't benefit from any bonus to its speed.\n" +
      "• The condition ends if the grappler is incapacitated.\n" +
      "• The condition also ends if an effect removes the grappled creature from the reach of the grappler or grappling effect.",
  },
  {
    slug: "incapacitated",
    name: "Incapacitated",
    isStandard: true,
    source: "SRD",
    description:
      "• An incapacitated creature can't take actions or reactions.",
  },
  {
    slug: "invisible",
    name: "Invisible",
    isStandard: true,
    source: "SRD",
    description:
      "• An invisible creature is impossible to see without the aid of magic or a special sense. For the purpose of hiding, the creature is heavily obscured. The creature's location can be detected by any noise it makes or any tracks it leaves.\n" +
      "• Attack rolls against the creature have disadvantage, and the creature's attack rolls have advantage.",
  },
  {
    slug: "paralyzed",
    name: "Paralyzed",
    isStandard: true,
    source: "SRD",
    description:
      "• A paralyzed creature is incapacitated and can't move or speak.\n" +
      "• The creature automatically fails Strength and Dexterity saving throws.\n" +
      "• Attack rolls against the creature have advantage.\n" +
      "• Any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature.",
  },
  {
    slug: "petrified",
    name: "Petrified",
    isStandard: true,
    source: "SRD",
    description:
      "• A petrified creature is transformed, along with any nonmagical object it is wearing or carrying, into a solid inanimate substance (usually stone). Its weight increases by a factor of ten, and it ceases aging.\n" +
      "• The creature is incapacitated, can't move or speak, and is unaware of its surroundings.\n" +
      "• Attack rolls against the creature have advantage.\n" +
      "• The creature automatically fails Strength and Dexterity saving throws.\n" +
      "• The creature has resistance to all damage.\n" +
      "• The creature is immune to poison and disease, although a poison or disease already in its system is suspended, not neutralized.",
  },
  {
    slug: "poisoned",
    name: "Poisoned",
    isStandard: true,
    source: "SRD",
    description:
      "• A poisoned creature has disadvantage on attack rolls and ability checks.",
  },
  {
    slug: "prone",
    name: "Prone",
    isStandard: true,
    source: "SRD",
    description:
      "• A prone creature's only movement option is to crawl, unless it stands up and thereby ends the condition.\n" +
      "• The creature has disadvantage on attack rolls.\n" +
      "• An attack roll against the creature has advantage if the attacker is within 5 feet of the creature. Otherwise, the attack roll has disadvantage.",
  },
  {
    slug: "restrained",
    name: "Restrained",
    isStandard: true,
    source: "SRD",
    description:
      "• A restrained creature's speed becomes 0, and it can't benefit from any bonus to its speed.\n" +
      "• Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage.\n" +
      "• The creature has disadvantage on Dexterity saving throws.",
  },
  {
    slug: "stunned",
    name: "Stunned",
    isStandard: true,
    source: "SRD",
    description:
      "• A stunned creature is incapacitated, can't move, and can speak only falteringly.\n" +
      "• The creature automatically fails Strength and Dexterity saving throws.\n" +
      "• Attack rolls against the creature have advantage.",
  },
  {
    slug: "unconscious",
    name: "Unconscious",
    isStandard: true,
    source: "SRD",
    description:
      "• An unconscious creature is incapacitated, can't move or speak, and is unaware of its surroundings.\n" +
      "• The creature drops whatever it's holding and falls prone.\n" +
      "• The creature automatically fails Strength and Dexterity saving throws.\n" +
      "• Attack rolls against the creature have advantage.\n" +
      "• Any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature.",
  },
  {
    slug: "dying",
    name: "Dying",
    isStandard: false,
    source: "Homebrew",
    description:
      "At 0 hit points while dying, you must make a death saving throw at the start of each of your turns.\n" +
      "• 3 successes: you become stable (unconscious at 0 HP, no more death saves until you take damage).\n" +
      "• 3 failures: you die.\n" +
      "• Natural 20: regain 1 hit point and wake up.\n" +
      "• Natural 1: counts as 2 failures.\n" +
      "• Taking damage while at 0 HP: 1 automatic failure (2 on a critical hit).",
  },
  {
    slug: "in-shell",
    name: "In Shell",
    isStandard: false,
    source: "Tortle",
    description:
      "Withdrawn into your shell (Shell Defense).\n" +
      "• +4 AC\n" +
      "• Speed 0\n" +
      "• Advantage on Strength and Constitution saving throws\n" +
      "• Disadvantage on Dexterity saving throws\n" +
      "• Cannot take reactions\n" +
      "• Can only use Emerge from Shell (bonus action) until you emerge",
  },
];

const PHB_BY_SLUG = new Map(PHB_CONDITIONS.map((c) => [c.slug, c]));
const PHB_BY_NAME = new Map(
  PHB_CONDITIONS.map((c) => [c.name.toLowerCase(), c.slug])
);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function buildCatalogMaps(catalog: readonly PhbCondition[]) {
  const bySlug = new Map(catalog.map((c) => [c.slug, c]));
  const byName = new Map(catalog.map((c) => [c.name.toLowerCase(), c.slug]));
  return { bySlug, byName };
}

export function getConditionBySlug(
  slug: string,
  catalog: readonly PhbCondition[] = PHB_CONDITIONS
): PhbCondition | null {
  return catalog.find((c) => c.slug === slug) ?? PHB_BY_SLUG.get(slug) ?? null;
}

export function getConditionDisplayName(
  slug: string,
  catalog: readonly PhbCondition[] = PHB_CONDITIONS
): string {
  return getConditionBySlug(slug, catalog)?.name ?? slug;
}

export function getConditionTooltip(
  slug: string,
  catalog: readonly PhbCondition[] = PHB_CONDITIONS
): string | null {
  const condition = getConditionBySlug(slug, catalog);
  if (!condition) return null;
  const description = condition.description.trim();
  return description ? `${condition.name}\n${description}` : condition.name;
}

/** Map legacy display names or slugs to canonical catalog slugs. */
export function normalizeConditionSlug(
  entry: string,
  catalog: readonly PhbCondition[] = PHB_CONDITIONS
): string | null {
  const trimmed = entry.trim();
  if (!trimmed) return null;

  const { bySlug, byName } = buildCatalogMaps(catalog);
  const lower = trimmed.toLowerCase();

  if (bySlug.has(trimmed)) return trimmed;
  if (bySlug.has(lower)) return lower;
  if (byName.has(lower)) return byName.get(lower)!;

  const slugified = slugifyConditionName(trimmed);
  if (bySlug.has(slugified)) return slugified;

  if (PHB_BY_NAME.has(lower)) return PHB_BY_NAME.get(lower)!;
  if (PHB_BY_SLUG.has(slugified)) return slugified;

  // Preserve homebrew slugs already stored in slug form.
  if (SLUG_PATTERN.test(lower)) return lower;

  return null;
}

export function normalizeCombatConditions(
  stored: string[],
  catalog: readonly PhbCondition[] = PHB_CONDITIONS
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const entry of stored) {
    const slug = normalizeConditionSlug(entry, catalog);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    result.push(slug);
  }

  return result;
}

export function applyConditionSlugs(
  conditions: string[],
  slugsToAdd: string[]
): string[] {
  const next = new Set(conditions);
  for (const slug of slugsToAdd) {
    if (slug) next.add(slug);
  }
  return [...next];
}

export function removeConditionSlugs(
  conditions: string[],
  slugsToRemove: string[]
): string[] {
  const remove = new Set(slugsToRemove);
  return conditions.filter((slug) => !remove.has(slug));
}

/** Conditions that leave a creature unable to act (PHB incapacitated or equivalent). */
export const INCAPACITATING_CONDITION_SLUGS = new Set([
  "incapacitated",
  "paralyzed",
  "petrified",
  "stunned",
  "unconscious",
]);

export function conditionSlugsIncapacitate(slugs: string[]): boolean {
  for (const slug of slugs) {
    const normalized = normalizeConditionSlug(slug);
    if (normalized && INCAPACITATING_CONDITION_SLUGS.has(normalized)) return true;
  }
  return false;
}

/** Structured ability-check effects for active conditions (used by check-roll-mode derivation). */
export interface ConditionCheckEffect {
  disadvantageAllChecks?: boolean;
  advantageAllChecks?: boolean;
  /** Appended to the source detail when the effect is situational. */
  situational?: string;
}

export const CONDITION_CHECK_EFFECTS: Partial<Record<string, ConditionCheckEffect>> = {
  poisoned: { disadvantageAllChecks: true },
  frightened: {
    disadvantageAllChecks: true,
    situational: "while the source of its fear is within line of sight",
  },
};
