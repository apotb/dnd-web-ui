import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import { resolveAllSpellGrants, type SpellGrantSpec } from "@/lib/character/spell-grants";
import type { SpellGrantUsage } from "@/lib/character/spell-grants";
import { getSpell } from "@/lib/dnd/phb/spells";
import type { CharacterData, Spell } from "@/lib/schemas/character";
import type { RestKind } from "@/lib/dnd/rest";

export type { SpellGrantUsage };

export function formatGrantUsageLabel(usage: SpellGrantUsage): string {
  const count = usage.max === 1 ? "1" : String(usage.max);
  return usage.restReset === "short" ? `${count}/short rest` : `${count}/long rest`;
}

export function formatGrantUsesDisplayLine(
  remaining: { current: number; max: number },
  usage: SpellGrantUsage
): string {
  return `Uses: ${remaining.current}/${remaining.max} (${formatGrantUsageLabel(usage)})`;
}

function grantSpecByKey(
  data: CharacterData,
  catalogs: FeatureCatalogs,
  grantKey: string
): SpellGrantSpec | undefined {
  return resolveAllSpellGrants(data, catalogs).find((g) => g.grantKey === grantKey);
}

export function getGrantUsageSpec(
  grantKey: string,
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): SpellGrantUsage | undefined {
  return grantSpecByKey(data, catalogs, grantKey)?.usage;
}

function grantDisplayName(spec: SpellGrantSpec): string {
  const spellName = getSpell(spec.spellId)?.name ?? spec.spellId;
  const source = spec.sourceLabel ?? "Granted";
  return `${spellName} (${source})`;
}

function shouldResetOnRest(
  usage: SpellGrantUsage,
  restKind: RestKind
): boolean {
  if (restKind === "short") return usage.restReset === "short";
  return usage.restReset === "short" || usage.restReset === "long";
}

export function syncGrantUses(
  spells: CharacterData["spells"],
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): CharacterData["spells"] {
  const grants = resolveAllSpellGrants(data, catalogs);
  const prev = spells.grantUses ?? {};
  const grantUses: CharacterData["spells"]["grantUses"] = {};

  for (const spec of grants) {
    if (!spec.usage) continue;
    const existing = prev[spec.grantKey];
    const max = spec.usage.max;
    const current = existing
      ? Math.min(existing.current, max)
      : max;
    grantUses[spec.grantKey] = { current, max };
  }

  return { ...spells, grantUses };
}

export function useGrantSpell(
  data: CharacterData,
  grantKey: string
): CharacterData {
  const entry = data.spells.grantUses?.[grantKey];
  if (!entry || entry.current <= 0) return data;

  return {
    ...data,
    spells: {
      ...data.spells,
      grantUses: {
        ...data.spells.grantUses,
        [grantKey]: { ...entry, current: entry.current - 1 },
      },
    },
  };
}

export function restoreGrantSpell(
  data: CharacterData,
  grantKey: string
): CharacterData {
  const entry = data.spells.grantUses?.[grantKey];
  if (!entry || entry.current >= entry.max) return data;

  return {
    ...data,
    spells: {
      ...data.spells,
      grantUses: {
        ...data.spells.grantUses,
        [grantKey]: { ...entry, current: entry.current + 1 },
      },
    },
  };
}

export function resetGrantUses(
  spells: CharacterData["spells"],
  restKind: RestKind,
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): CharacterData["spells"] {
  const grants = resolveAllSpellGrants(data, catalogs);
  const grantUses = { ...(spells.grantUses ?? {}) };

  for (const spec of grants) {
    if (!spec.usage) continue;
    if (!shouldResetOnRest(spec.usage, restKind)) continue;
    const entry = grantUses[spec.grantKey];
    if (!entry) continue;
    grantUses[spec.grantKey] = { ...entry, current: entry.max };
  }

  return { ...spells, grantUses };
}

export function getGrantUsesForRest(
  data: CharacterData,
  restKind: RestKind,
  catalogs: FeatureCatalogs = {}
): string[] {
  const items: string[] = [];
  const grants = resolveAllSpellGrants(data, catalogs);

  for (const spec of grants) {
    if (!spec.usage || !shouldResetOnRest(spec.usage, restKind)) continue;
    const entry = data.spells.grantUses?.[spec.grantKey];
    if (!entry || entry.current >= entry.max) continue;
    items.push(`${grantDisplayName(spec)} (${entry.current}/${entry.max})`);
  }

  return items;
}

export function hasGrantUsesRestoringOnRest(
  data: CharacterData,
  restKind: RestKind,
  catalogs: FeatureCatalogs = {}
): boolean {
  return getGrantUsesForRest(data, restKind, catalogs).length > 0;
}

export function canCastGrantSpell(
  spell: Spell,
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): boolean {
  if (!spell.grantKey) return true;
  const usage = getGrantUsageSpec(spell.grantKey, data, catalogs);
  if (!usage) return true;
  const entry = data.spells.grantUses?.[spell.grantKey];
  return (entry?.current ?? usage.max) > 0;
}

export function getGrantUsesRemaining(
  grantKey: string,
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): { current: number; max: number } | null {
  const usage = getGrantUsageSpec(grantKey, data, catalogs);
  if (!usage) return null;
  const entry = data.spells.grantUses?.[grantKey];
  return {
    current: entry?.current ?? usage.max,
    max: entry?.max ?? usage.max,
  };
}
