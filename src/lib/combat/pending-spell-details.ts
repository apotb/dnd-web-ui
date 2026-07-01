import type { CombatOption } from "@/lib/combat/combat-options";
import type { DerivedAttack } from "@/lib/dnd/attacks";
import { formatSlotLevelLabel } from "@/lib/dnd/combat-spells";
import { getSpell } from "@/lib/dnd/phb/spells";
import type { PhbSpell } from "@/lib/dnd/phb/types";
import { formatSpellMaterialLine } from "@/lib/dnd/spell-glossary";
import type {
  PendingAttack,
  PendingAttackTarget,
  PendingSpellDetails,
} from "@/lib/schemas/combat-state";
import { parseAttackRangeSpec } from "@/lib/combat/targeting";

export function buildPendingSpellDetailsFromCatalog(
  catalog: PhbSpell,
  options: {
    spellId: string;
    characterSpellId?: string;
    spellLevel: number;
    castSlotLevel: number;
    castingCost: "action" | "bonus-action";
    isDeclarationOnly?: boolean;
    targetingSummary?: string | null;
  }
): PendingSpellDetails {
  const materialLine = catalog.components
    ? formatSpellMaterialLine(catalog.components)
    : null;

  return {
    spellId: options.spellId,
    characterSpellId: options.characterSpellId,
    spellLevel: options.spellLevel,
    castSlotLevel: options.castSlotLevel,
    castingCost: options.castingCost,
    school: catalog.school ?? undefined,
    castingTime: catalog.castingTime ?? undefined,
    range: catalog.range ?? undefined,
    duration: catalog.duration ?? undefined,
    components: catalog.components ?? undefined,
    materialLine: materialLine ?? undefined,
    concentration: catalog.concentration ?? false,
    ritual: catalog.ritual ?? false,
    description: catalog.description ?? undefined,
    isDeclarationOnly: options.isDeclarationOnly ?? false,
    targetingSummary: options.targetingSummary ?? undefined,
    castSlotLabel:
      options.castSlotLevel > 0
        ? formatSlotLevelLabel(options.castSlotLevel)
        : undefined,
  };
}

export function formatPendingSpellTargetingSummary(
  targets: PendingAttackTarget[],
  attack?: DerivedAttack | null,
  aoeCenter?: { x: number; y: number } | null
): string | null {
  if (targets.length > 0) {
    return `Targets: ${targets.map((target) => target.label).join(", ")}`;
  }

  const spec = attack ? parseAttackRangeSpec(attack) : null;
  if (spec?.isAoe && aoeCenter) {
    const shape =
      spec.aoeShape === "cone"
        ? "cone"
        : spec.aoeShape === "cube"
          ? "cube"
          : "radius";
    return `Area (${shape}) at grid (${aoeCenter.x}, ${aoeCenter.y})`;
  }

  if (attack?.range?.trim()) {
    return `Range: ${attack.range.trim()}`;
  }

  return null;
}

export function resolvePendingSpellDetailsForAttack(
  option: CombatOption,
  attack: DerivedAttack,
  targets: PendingAttackTarget[],
  aoeCenter: { x: number; y: number } | null
): PendingSpellDetails | null {
  const spellCast = option.spellCast;
  const slug = attack.spellCatalogSlug ?? spellCast?.spellId;
  if (!slug) return null;

  const catalog = getSpell(slug);
  if (!catalog) return null;

  const castSlotLevel =
    spellCast?.castSlotLevel ?? attack.castSlotLevel ?? attack.spellLevel ?? 0;
  const spellLevel = spellCast?.level ?? attack.spellLevel ?? catalog.level;
  const castingCost =
    spellCast?.castingCost ??
    (option.kind === "bonus-action" ? "bonus-action" : "action");

  return buildPendingSpellDetailsFromCatalog(catalog, {
    spellId: slug,
    characterSpellId: spellCast?.characterSpellId,
    spellLevel,
    castSlotLevel,
    castingCost,
    isDeclarationOnly: false,
    targetingSummary: formatPendingSpellTargetingSummary(targets, attack, aoeCenter),
  });
}

export function resolvePendingSpellDetailsForDeclareCast(
  option: CombatOption
): PendingSpellDetails | null {
  const spellCast = option.spellCast;
  if (!spellCast) return null;

  const catalog = getSpell(spellCast.spellId);
  if (!catalog) return null;

  return buildPendingSpellDetailsFromCatalog(catalog, {
    spellId: spellCast.spellId,
    characterSpellId: spellCast.characterSpellId,
    spellLevel: spellCast.level,
    castSlotLevel: spellCast.castSlotLevel,
    castingCost: spellCast.castingCost,
    isDeclarationOnly: true,
    targetingSummary: catalog.range ? `Range: ${catalog.range}` : null,
  });
}

export function attachSpellDetailsToPending(
  pending: PendingAttack,
  option: CombatOption,
  attack?: DerivedAttack | null
): PendingAttack {
  if (pending.spellDetails) return pending;

  const spellDetails = attack
    ? resolvePendingSpellDetailsForAttack(
        option,
        attack,
        pending.targets,
        pending.aoeCenter ?? null
      )
    : resolvePendingSpellDetailsForDeclareCast(option);

  if (!spellDetails) return pending;
  return { ...pending, spellDetails };
}
