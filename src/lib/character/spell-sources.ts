import type { CharacterData, Spell } from "@/lib/schemas/character";
import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import { featureSourceLabel } from "@/lib/character/feature-derivation";
import {
  MANAGED_SPELL_GRANT_PREFIX,
  resolveAllSpellGrants,
  type SpellGrantSpec,
} from "@/lib/character/feature-grant-sync";
import type { SpellGrantSource } from "@/lib/character/spell-grants";
import { formatGrantUsageLabel } from "@/lib/character/spell-grant-uses";

export function isManagedGrantSpell(spell: Spell): boolean {
  return !!spell.grantKey?.startsWith(MANAGED_SPELL_GRANT_PREFIX);
}

function grantSourceFromKey(grantKey: string): SpellGrantSource | null {
  if (grantKey.startsWith("grant:species:")) return "species";
  if (grantKey.startsWith("grant:subclass:")) return "subclass";
  if (grantKey.startsWith("grant:class:")) return "class";
  if (grantKey.startsWith("grant:background:")) return "background";
  if (grantKey.startsWith("grant:feat:")) return "feat";
  return null;
}

export function getSpellGrantSpecs(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): SpellGrantSpec[] {
  return resolveAllSpellGrants(data, catalogs);
}

export function buildSpellGrantSourceMap(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): Map<string, string> {
  const map = new Map<string, string>();
  for (const spec of resolveAllSpellGrants(data, catalogs)) {
    const label =
      spec.sourceLabel ??
      (spec.source === "feat" ? "Feat" : featureSourceLabel(spec.source));
    map.set(spec.grantKey, label);
  }
  return map;
}

export function buildSpellGrantUsageMap(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): Map<string, string> {
  const map = new Map<string, string>();
  for (const spec of resolveAllSpellGrants(data, catalogs)) {
    if (spec.usage) {
      map.set(spec.grantKey, formatGrantUsageLabel(spec.usage));
    } else if (spec.notes) {
      map.set(spec.grantKey, spec.notes);
    }
  }
  return map;
}

/** Display label for a managed grant spell (source badge text). */
export function spellGrantSourceLabel(
  spell: Spell,
  sourceMap?: Map<string, string>
): string | null {
  if (!spell.grantKey?.startsWith(MANAGED_SPELL_GRANT_PREFIX)) return null;
  if (sourceMap?.has(spell.grantKey)) {
    return sourceMap.get(spell.grantKey)!;
  }
  const source = grantSourceFromKey(spell.grantKey);
  if (!source) return "Granted";
  return source === "feat" ? "Feat" : featureSourceLabel(source);
}

export function hasManagedSpellGrants(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): boolean {
  return resolveAllSpellGrants(data, catalogs).length > 0;
}
