import type { CharacterData, SkillKey } from "@/lib/schemas/character";
import { skillKeySchema } from "@/lib/schemas/character";
import { SKILL_LABELS } from "@/lib/dnd/calculations";

const VALID_SKILL_KEYS = new Set<string>(skillKeySchema.options);

const LABEL_TO_SKILL_KEY = new Map<string, SkillKey>();
for (const [key, label] of Object.entries(SKILL_LABELS) as [SkillKey, string][]) {
  LABEL_TO_SKILL_KEY.set(label.toLowerCase(), key);
}

function resolveSkillKey(rawKey: string): SkillKey | null {
  if (VALID_SKILL_KEYS.has(rawKey)) {
    return rawKey as SkillKey;
  }
  return LABEL_TO_SKILL_KEY.get(rawKey.trim().toLowerCase()) ?? null;
}

/**
 * Remap skill entries stored under display names (pre-schema) to canonical keys.
 * Only exact label matches are migrated (case-insensitive).
 */
export function migrateSkillKeys(data: CharacterData): CharacterData {
  const skills = data.skills ?? {};
  const nextSkills: CharacterData["skills"] = {};
  let skillsChanged = false;

  for (const [rawKey, prof] of Object.entries(skills)) {
    const resolved = resolveSkillKey(rawKey);
    if (resolved) {
      if (resolved !== rawKey) skillsChanged = true;
      nextSkills[resolved] = prof;
    } else {
      nextSkills[rawKey] = prof;
    }
  }

  let grantedSkillKeys = data.grantedSkillKeys;
  if (grantedSkillKeys) {
    const nextGranted: NonNullable<CharacterData["grantedSkillKeys"]> = {};
    let grantedChanged = false;
    for (const [rawKey, grantKey] of Object.entries(grantedSkillKeys)) {
      const resolved = resolveSkillKey(rawKey);
      if (resolved) {
        if (resolved !== rawKey) grantedChanged = true;
        nextGranted[resolved] = grantKey;
      } else {
        nextGranted[rawKey as SkillKey] = grantKey;
      }
    }
    if (grantedChanged) {
      grantedSkillKeys = nextGranted;
    }
  }

  if (!skillsChanged && grantedSkillKeys === data.grantedSkillKeys) {
    return data;
  }

  return {
    ...data,
    skills: skillsChanged ? nextSkills : data.skills,
    grantedSkillKeys,
  };
}
