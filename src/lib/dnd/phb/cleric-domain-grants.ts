/** PHB cleric domain bonus proficiencies (Life, Tempest, War). */
export const CLERIC_DOMAIN_PROFICIENCIES: Record<
  string,
  { armor?: string[]; weapons?: string[] }
> = {
  life: { armor: ["heavy armor"] },
  tempest: { armor: ["heavy armor"], weapons: ["martial weapons"] },
  war: { armor: ["heavy armor"], weapons: ["martial weapons"] },
};

export const KNOWLEDGE_DOMAIN_SKILL_OPTIONS = [
  "arcana",
  "history",
  "nature",
  "religion",
] as const;

export const KNOWLEDGE_DOMAIN_LANGUAGE_GRANT_KEY =
  "grant:subclass:blessings-of-knowledge-languages";

export const KNOWLEDGE_DOMAIN_SKILL_GRANT_KEY =
  "grant:subclass:blessings-of-knowledge-skills";
