import type { CharacterData, SkillKey } from "@/lib/schemas/character";
import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import { resolveAllSkillGrants } from "@/lib/character/feature-grant-sync";
import { formatProficiencySources } from "@/lib/character/proficiency-sources";

export function getSkillSourcesMap(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): Map<SkillKey, string[]> {
  const map = new Map<SkillKey, Set<string>>();

  for (const grant of resolveAllSkillGrants(data, catalogs)) {
    for (const skill of grant.skills) {
      const sources = map.get(skill) ?? new Set<string>();
      sources.add(grant.source);
      map.set(skill, sources);
    }
  }

  return new Map(
    [...map.entries()].map(([skill, sources]) => [skill, [...sources].sort()])
  );
}

export function getGrantedSkillSet(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): Set<SkillKey> {
  return new Set(getSkillSourcesMap(data, catalogs).keys());
}

export function isGrantedSkill(
  skill: SkillKey,
  skillSources: Map<SkillKey, string[]>
): boolean {
  return (skillSources.get(skill)?.length ?? 0) > 0;
}

export function isSkillProficient(
  data: CharacterData,
  skill: SkillKey,
  skillSources: Map<SkillKey, string[]>
): boolean {
  const skillData = data.skills[skill];
  return !!skillData?.proficient || isGrantedSkill(skill, skillSources);
}

/** Tooltip for the proficiency dot on the skills list. */
export function formatSkillProficiencyTooltip(
  skill: SkillKey,
  data: CharacterData,
  skillSources: Map<SkillKey, string[]>
): string {
  const skillData = data.skills[skill];
  const sources = skillSources.get(skill) ?? [];

  if (sources.length > 0) {
    return formatProficiencySources(sources);
  }
  if (skillData?.proficient) {
    return "Forced";
  }
  if (skillData?.expertise) {
    return "Expertise";
  }
  return "Not proficient";
}
