import { resolveCharacterClass } from "@/lib/character/class-derivation";
import {
  calculateEffectiveMaxHpBreakdown,
  syncCombatDerivedStats,
} from "@/lib/character/combat-derivation";
import type { GrantedFeature } from "@/lib/character/feature-derivation";
import { deriveGrantedFeatures } from "@/lib/character/feature-derivation";
import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import {
  featureActionId,
  resolveMechanicsFromCatalog,
  type ResolvedMechanicalFeature,
} from "@/lib/dnd/catalog-feature-mechanics";
import { findSubclassByName } from "@/lib/content/catalog-tooltip";
import { abilityModifier } from "@/lib/dnd/calculations";
import { removeConditionSlugs } from "@/lib/dnd/conditions";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import type { PhbClass, PhbSpecies } from "@/lib/dnd/phb/types";
import { levelFromXp } from "@/lib/dnd/xp";
import type {
  ActionCost,
  CharacterData,
  Feature,
} from "@/lib/schemas/character";
import type { CharacterActionEntry } from "@/lib/dnd/character-actions";

type MechanicalRestKind = "short" | "long";

export const ARCANE_RECOVERY_ID = "granted:class:arcane-recovery";
export const NATURAL_RECOVERY_ID = "granted:subclass:natural-recovery";
export const SECOND_WIND_ID = "granted:class:second-wind";
export const RAGE_ID = "granted:class:rage";
export const BARDIC_INSPIRATION_ID = "granted:class:bardic-inspiration";
export const LAY_ON_HANDS_ID = "granted:class:lay-on-hands";
export const LAY_ON_HANDS_ACTION_ID = `feature:${LAY_ON_HANDS_ID}`;
export const LAY_ON_HANDS_CURE_COST = 5;
export const LAY_ON_HANDS_ACTION_DESCRIPTION =
  "As an action, touch a creature to restore HP from a pool of 5 × paladin level, or spend 5 pool HP to cure one poison or disease.";
export const TIDES_OF_CHAOS_ID = "granted:subclass:tides-of-chaos";

export type MechanicalFeatureKind =
  | "uses"
  | "hp-pool"
  | "short-rest-slots"
  | "short-rest-heal";

export interface MechanicalFeatureContext {
  data: CharacterData;
  classes: PhbClass[];
  speciesList?: PhbSpecies[];
  level: number;
  cls: PhbClass | undefined;
  subclassId: string | undefined;
}

export interface MechanicalFeatureDef {
  id: string;
  kind: MechanicalFeatureKind;
  restReset: Feature["restReset"];
  qualifies: (ctx: MechanicalFeatureContext) => boolean;
  maxValue: (ctx: MechanicalFeatureContext) => number;
  /** Max spell slot level that can be recovered (short-rest-slots only). */
  maxRecoverableSlotLevel?: number;
  /** When set, injects a combat/sheet action without parsing feature description text. */
  usesAction?: boolean;
  actionCost?: ActionCost;
  actionName?: string;
  actionDescription?: string;
}

export interface SpellRecoveryLevelOption {
  level: number;
  used: number;
  maxRecoverable: number;
}

export interface SpellRecoveryOptions {
  featureId: string;
  featureName: string;
  budget: number;
  maxSlotLevel: number;
  levels: SpellRecoveryLevelOption[];
  available: boolean;
}

export interface SpellRecoverySelection {
  level: number;
  count: number;
}

function resolveCatalogs(catalogs: FeatureCatalogs = {}) {
  return {
    classes: catalogs.classes?.length ? catalogs.classes : PHB_CLASSES,
    species: catalogs.species ?? [],
  };
}

/** Whether any entry in the character's class list matches the given class id. */
export function characterHasClassId(
  data: CharacterData,
  classId: string,
  catalogs: FeatureCatalogs = {}
): boolean {
  const { classes } = resolveCatalogs(catalogs);
  const labels = data.basicInfo.classes.length
    ? data.basicInfo.classes
    : data.basicInfo.class
      ? [data.basicInfo.class]
      : [];

  for (const label of labels) {
    const raw = label.trim();
    const lower = raw.toLowerCase();
    const match = classes.find((c) => c.id === raw || c.name.toLowerCase() === lower);
    if (match?.id === classId) return true;
  }

  return false;
}

function buildContext(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): MechanicalFeatureContext {
  const { classes } = resolveCatalogs(catalogs);
  const cls = resolveCharacterClass(data, classes);
  const className =
    data.basicInfo.classes[0] ?? data.basicInfo.class ?? cls?.name ?? "";
  const subclassMatch = findSubclassByName(
    className,
    data.basicInfo.subclass,
    classes
  );
  return {
    data,
    classes,
    speciesList: catalogs.species,
    level: levelFromXp(data.basicInfo.xp ?? 0),
    cls,
    subclassId: subclassMatch?.subclass.id,
  };
}

export function getSpellRecoveryBudget(level: number): number {
  return Math.ceil(level / 2);
}

const MECHANICAL_FEATURES: Record<string, MechanicalFeatureDef> = {
  [ARCANE_RECOVERY_ID]: {
    id: ARCANE_RECOVERY_ID,
    kind: "short-rest-slots",
    restReset: "long",
    qualifies: (ctx) => ctx.cls?.id === "wizard" && ctx.level >= 2,
    maxValue: () => 1,
    maxRecoverableSlotLevel: 5,
  },
  [NATURAL_RECOVERY_ID]: {
    id: NATURAL_RECOVERY_ID,
    kind: "short-rest-slots",
    restReset: "long",
    qualifies: (ctx) =>
      ctx.cls?.id === "druid" && ctx.subclassId === "land",
    maxValue: () => 1,
    maxRecoverableSlotLevel: 5,
  },
  [SECOND_WIND_ID]: {
    id: SECOND_WIND_ID,
    kind: "short-rest-heal",
    restReset: "short",
    qualifies: (ctx) => ctx.cls?.id === "fighter",
    maxValue: () => 1,
  },
  [RAGE_ID]: {
    id: RAGE_ID,
    kind: "uses",
    restReset: "long",
    qualifies: (ctx) => ctx.cls?.id === "barbarian",
    maxValue: () => 2,
  },
  [BARDIC_INSPIRATION_ID]: {
    id: BARDIC_INSPIRATION_ID,
    kind: "uses",
    restReset: "long",
    qualifies: (ctx) => ctx.cls?.id === "bard",
    maxValue: (ctx) =>
      Math.max(1, abilityModifier(ctx.data.abilityScores.cha)),
  },
  [LAY_ON_HANDS_ID]: {
    id: LAY_ON_HANDS_ID,
    kind: "hp-pool",
    restReset: "long",
    qualifies: (ctx) => characterHasClassId(ctx.data, "paladin", { classes: ctx.classes }),
    maxValue: (ctx) => 5 * ctx.level,
    usesAction: true,
    actionCost: "action",
    actionName: "Lay on Hands",
    actionDescription: LAY_ON_HANDS_ACTION_DESCRIPTION,
  },
  [TIDES_OF_CHAOS_ID]: {
    id: TIDES_OF_CHAOS_ID,
    kind: "uses",
    restReset: "long",
    qualifies: (ctx) =>
      ctx.cls?.id === "sorcerer" && ctx.subclassId === "wild-magic",
    maxValue: () => 1,
  },
};

export function getMechanicalFeatureDef(
  featureId: string
): MechanicalFeatureDef | undefined {
  return MECHANICAL_FEATURES[featureId];
}

export function buildMechanicalFeatureContext(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): MechanicalFeatureContext {
  return buildContext(data, catalogs);
}

export function codeDefToResolved(def: MechanicalFeatureDef): ResolvedMechanicalFeature {
  return {
    id: def.id,
    kind: def.kind,
    restReset: def.restReset,
    maxValue: (ctx) => def.maxValue(ctx as MechanicalFeatureContext),
    usesAction: def.usesAction ?? false,
    actionCost: def.actionCost ?? "action",
    actionName: def.actionName ?? "Feature",
    actionDescription: def.actionDescription ?? "",
    hpPool:
      def.kind === "hp-pool"
        ? {
            cureCost: LAY_ON_HANDS_CURE_COST,
            cureConditions: ["poisoned"],
            touchRangeFt: 5,
          }
        : undefined,
    source: "code",
  };
}

export function resolveFeatureMechanics(
  granted: GrantedFeature,
  ctx: MechanicalFeatureContext
): ResolvedMechanicalFeature | null {
  if (granted.catalogMechanics) {
    return resolveMechanicsFromCatalog(
      granted.id,
      {
        name: granted.name,
        description: granted.description,
        mechanics: granted.catalogMechanics,
      },
      granted.catalogMechanics
    );
  }

  const codeDef = MECHANICAL_FEATURES[granted.id];
  if (codeDef && codeDef.qualifies(ctx)) {
    return codeDefToResolved(codeDef);
  }

  return null;
}

export function listResolvedMechanicalFeatures(
  data: CharacterData,
  catalogs?: FeatureCatalogs
): ResolvedMechanicalFeature[] {
  const ctx = buildContext(data, catalogs);
  const granted = deriveGrantedFeatures(data, catalogs);
  const seen = new Set<string>();
  const result: ResolvedMechanicalFeature[] = [];

  for (const feature of granted) {
    if (!feature.locked) continue;
    const resolved = resolveFeatureMechanics(feature, ctx);
    if (!resolved) continue;
    if (seen.has(resolved.id)) continue;
    seen.add(resolved.id);
    result.push(resolved);
  }

  for (const def of Object.values(MECHANICAL_FEATURES)) {
    if (seen.has(def.id)) continue;
    if (!def.qualifies(ctx)) continue;
    seen.add(def.id);
    result.push(codeDefToResolved(def));
  }

  return result;
}

export function getResolvedMechanicalFeature(
  data: CharacterData,
  featureId: string,
  catalogs?: FeatureCatalogs
): ResolvedMechanicalFeature | null {
  return (
    listResolvedMechanicalFeatures(data, catalogs).find((entry) => entry.id === featureId) ??
    null
  );
}

export function listQualifiedMechanicalFeatures(
  data: CharacterData,
  catalogs?: FeatureCatalogs
): MechanicalFeatureDef[] {
  const ctx = buildContext(data, catalogs);
  return Object.values(MECHANICAL_FEATURES).filter((def) => def.qualifies(ctx));
}

export function mechanicalFeatureQualifies(
  data: CharacterData,
  featureId: string,
  catalogs?: FeatureCatalogs
): boolean {
  return getResolvedMechanicalFeature(data, featureId, catalogs) != null;
}

export function getEffectiveMaxHp(
  data: CharacterData,
  catalogs?: FeatureCatalogs
): number {
  const ctx = buildContext(data, catalogs);
  const { total: derivedMaxHp } = calculateEffectiveMaxHpBreakdown(
    data,
    ctx.classes,
    catalogs?.species
  );
  return Math.max(data.combat.maxHp, derivedMaxHp);
}

export function canUseSecondWind(
  data: CharacterData,
  catalogs?: FeatureCatalogs
): boolean {
  if (!mechanicalFeatureQualifies(data, SECOND_WIND_ID, catalogs)) return false;
  if (getMechanicalFeatureCurrent(data, SECOND_WIND_ID, catalogs) <= 0) {
    return false;
  }
  return data.combat.currentHp < getEffectiveMaxHp(data, catalogs);
}

export function getMechanicalFeatureMaxForResolved(
  resolved: ResolvedMechanicalFeature,
  data: CharacterData,
  catalogs?: FeatureCatalogs
): number {
  const ctx = buildContext(data, catalogs);
  return resolved.maxValue(ctx);
}

export function getMechanicalFeatureMax(
  def: MechanicalFeatureDef,
  data: CharacterData,
  catalogs?: FeatureCatalogs
): number {
  const ctx = buildContext(data, catalogs);
  if (!def.qualifies(ctx)) return 0;
  return def.maxValue(ctx);
}

export function getMechanicalFeatureCurrent(
  data: CharacterData,
  featureId: string,
  catalogs?: FeatureCatalogs
): number {
  const resolved = getResolvedMechanicalFeature(data, featureId, catalogs);
  if (!resolved) return 0;
  const ctx = buildContext(data, catalogs);
  const max = resolved.maxValue(ctx);
  if (max <= 0 && resolved.kind !== "hp-pool" && resolved.kind !== "uses") {
    return 0;
  }
  const stored = data.featureUseState?.[featureId]?.current;
  return stored !== undefined ? Math.min(stored, max) : max;
}

function setMechanicalFeatureCurrent(
  data: CharacterData,
  featureId: string,
  current: number,
  catalogs?: FeatureCatalogs
): CharacterData {
  const resolved = getResolvedMechanicalFeature(data, featureId, catalogs);
  if (!resolved) return data;
  const max = getMechanicalFeatureMaxForResolved(resolved, data, catalogs);
  const clamped = Math.max(0, Math.min(max, current));
  return {
    ...data,
    featureUseState: {
      ...data.featureUseState,
      [featureId]: { current: clamped },
    },
  };
}

export function enrichMechanicalFeature(
  feature: GrantedFeature,
  data: CharacterData,
  catalogs?: FeatureCatalogs
): GrantedFeature {
  const ctx = buildContext(data, catalogs);
  const resolved = resolveFeatureMechanics(feature, ctx);
  if (!resolved) return feature;
  if (resolved.kind !== "uses" && resolved.kind !== "hp-pool") {
    if (resolved.kind === "short-rest-slots" || resolved.kind === "short-rest-heal") {
      const max = resolved.maxValue(ctx);
      const current = getMechanicalFeatureCurrent(data, feature.id, catalogs);
      return {
        ...feature,
        restReset: resolved.restReset,
        uses: { max, current },
      };
    }
    return feature;
  }

  const max = resolved.maxValue(ctx);
  const current = getMechanicalFeatureCurrent(data, feature.id, catalogs);
  return {
    ...feature,
    restReset: resolved.restReset,
    uses: { max, current },
  };
}

export function adjustMechanicalFeatureUse(
  data: CharacterData,
  featureId: string,
  delta: number,
  catalogs?: FeatureCatalogs
): CharacterData {
  if (delta === 0) return data;
  if (!getResolvedMechanicalFeature(data, featureId, catalogs)) return data;

  const current = getMechanicalFeatureCurrent(data, featureId, catalogs);
  return setMechanicalFeatureCurrent(
    data,
    featureId,
    current + delta,
    catalogs
  );
}

export function resetMechanicalFeatureUses(
  data: CharacterData,
  restKind: MechanicalRestKind,
  catalogs?: FeatureCatalogs
): CharacterData {
  const ctx = buildContext(data, catalogs);
  let next = data;

  for (const resolved of listResolvedMechanicalFeatures(data, catalogs)) {
    if (restKind === "short" && resolved.restReset !== "short") continue;
    if (
      restKind === "long" &&
      resolved.restReset !== "short" &&
      resolved.restReset !== "long"
    ) {
      continue;
    }
    const max = resolved.maxValue(ctx);
    next = setMechanicalFeatureCurrent(next, resolved.id, max, catalogs);
  }

  return next;
}

export function getSpellRecoveryOptions(
  data: CharacterData,
  featureId: string,
  catalogs?: FeatureCatalogs
): SpellRecoveryOptions | null {
  const def = getMechanicalFeatureDef(featureId);
  if (!def || def.kind !== "short-rest-slots") return null;

  const ctx = buildContext(data, catalogs);
  if (!def.qualifies(ctx)) return null;

  const current = getMechanicalFeatureCurrent(data, featureId, catalogs);
  const budget = getSpellRecoveryBudget(ctx.level);
  const maxSlotLevel = def.maxRecoverableSlotLevel ?? 9;
  const levels: SpellRecoveryLevelOption[] = [];

  for (const [key, slot] of Object.entries(data.spells.slots)) {
    const level = parseInt(key, 10);
    if (!Number.isFinite(level) || level < 1) continue;
    if (level > maxSlotLevel) continue;
    if (slot.used <= 0) continue;
    levels.push({
      level,
      used: slot.used,
      maxRecoverable: slot.used,
    });
  }

  levels.sort((a, b) => a.level - b.level);

  const featureName =
    featureId === ARCANE_RECOVERY_ID
      ? "Arcane Recovery"
      : featureId === NATURAL_RECOVERY_ID
        ? "Natural Recovery"
        : "Spell Recovery";

  return {
    featureId,
    featureName,
    budget,
    maxSlotLevel,
    levels,
    available: current > 0 && levels.length > 0,
  };
}

export function validateSpellRecoverySelections(
  data: CharacterData,
  featureId: string,
  selections: SpellRecoverySelection[],
  catalogs?: FeatureCatalogs
): { ok: true } | { ok: false; reason: string } {
  const options = getSpellRecoveryOptions(data, featureId, catalogs);
  if (!options) {
    return { ok: false, reason: "Spell recovery is not available." };
  }
  if (!options.available) {
    return { ok: false, reason: "Spell recovery has already been used." };
  }

  let totalLevels = 0;
  for (const selection of selections) {
    if (selection.count <= 0) continue;
    const levelOption = options.levels.find((l) => l.level === selection.level);
    if (!levelOption) {
      return {
        ok: false,
        reason: `Cannot recover ${selection.level}${ordinalSuffix(selection.level)}-level slots.`,
      };
    }
    if (selection.count > levelOption.used) {
      return {
        ok: false,
        reason: `Only ${levelOption.used} ${levelOption.used === 1 ? "slot" : "slots"} available at ${selection.level}${ordinalSuffix(selection.level)} level.`,
      };
    }
    totalLevels += selection.level * selection.count;
  }

  if (totalLevels <= 0) {
    return { ok: false, reason: "Select at least one slot to recover." };
  }
  if (totalLevels > options.budget) {
    return {
      ok: false,
      reason: `Total spell levels (${totalLevels}) exceed recovery budget (${options.budget}).`,
    };
  }

  return { ok: true };
}

export function applySpellSlotRecovery(
  data: CharacterData,
  featureId: string,
  selections: SpellRecoverySelection[],
  catalogs?: FeatureCatalogs
): CharacterData {
  const validation = validateSpellRecoverySelections(
    data,
    featureId,
    selections,
    catalogs
  );
  if (!validation.ok) return data;

  const slots = { ...data.spells.slots };
  for (const selection of selections) {
    if (selection.count <= 0) continue;
    const key = String(selection.level);
    const slot = slots[key];
    if (!slot) continue;
    slots[key] = {
      ...slot,
      used: Math.max(0, slot.used - selection.count),
    };
  }

  const withSlots: CharacterData = {
    ...data,
    spells: { ...data.spells, slots },
  };
  const withUse = setMechanicalFeatureCurrent(
    withSlots,
    featureId,
    getMechanicalFeatureCurrent(withSlots, featureId, catalogs) - 1,
    catalogs
  );
  return syncCombatDerivedStats(
    withUse,
    buildContext(withUse, catalogs).classes,
    catalogs?.species
  );
}

export function applySecondWind(
  data: CharacterData,
  roll: number,
  catalogs?: FeatureCatalogs
): CharacterData {
  const def = getMechanicalFeatureDef(SECOND_WIND_ID);
  if (!def) return data;

  const ctx = buildContext(data, catalogs);
  if (!def.qualifies(ctx)) return data;

  const current = getMechanicalFeatureCurrent(data, SECOND_WIND_ID, catalogs);
  if (current <= 0) return data;

  const maxHp = getEffectiveMaxHp(data, catalogs);
  if (data.combat.currentHp >= maxHp) return data;

  const healed = Math.max(0, roll + ctx.level);
  const nextHp = Math.min(maxHp, data.combat.currentHp + healed);

  const withHp: CharacterData = {
    ...data,
    combat: { ...data.combat, currentHp: nextHp },
  };
  const withUse = setMechanicalFeatureCurrent(
    withHp,
    SECOND_WIND_ID,
    current - 1,
    catalogs
  );
  return withUse;
}

export function getHpPoolRemaining(
  data: CharacterData,
  featureId: string,
  catalogs?: FeatureCatalogs
): number {
  const resolved = getResolvedMechanicalFeature(data, featureId, catalogs);
  if (!resolved || resolved.kind !== "hp-pool") return 0;
  return getMechanicalFeatureCurrent(data, featureId, catalogs);
}

export function getLayOnHandsPoolRemaining(
  data: CharacterData,
  catalogs?: FeatureCatalogs
): number {
  return getHpPoolRemaining(data, LAY_ON_HANDS_ID, catalogs);
}

export function spendHpPool(
  actorData: CharacterData,
  featureId: string,
  amount: number,
  catalogs?: FeatureCatalogs
): CharacterData {
  if (amount <= 0) return actorData;
  const resolved = getResolvedMechanicalFeature(actorData, featureId, catalogs);
  if (!resolved || resolved.kind !== "hp-pool") return actorData;

  const current = getMechanicalFeatureCurrent(actorData, featureId, catalogs);
  const spend = Math.min(current, Math.trunc(amount));
  if (spend <= 0) return actorData;

  return setMechanicalFeatureCurrent(
    actorData,
    featureId,
    current - spend,
    catalogs
  );
}

export function spendLayOnHandsPool(
  paladinData: CharacterData,
  amount: number,
  catalogs?: FeatureCatalogs
): CharacterData {
  return spendHpPool(paladinData, LAY_ON_HANDS_ID, amount, catalogs);
}

export function applyHealingToCharacter(
  targetData: CharacterData,
  amount: number,
  catalogs?: FeatureCatalogs
): CharacterData {
  if (amount <= 0) return targetData;

  const maxHp = getEffectiveMaxHp(targetData, catalogs);
  const nextHp = Math.min(maxHp, targetData.combat.currentHp + amount);

  return {
    ...targetData,
    combat: { ...targetData.combat, currentHp: nextHp },
  };
}

function targetHasCondition(data: CharacterData, slug: string): boolean {
  return (data.combat.conditions ?? []).includes(slug);
}

export function canHpPoolHealTarget(
  targetData: CharacterData,
  amount: number,
  catalogs?: FeatureCatalogs
): boolean {
  if (amount <= 0) return false;
  const maxHp = getEffectiveMaxHp(targetData, catalogs);
  return targetData.combat.currentHp < maxHp;
}

export function canLayOnHandsHealTarget(
  targetData: CharacterData,
  amount: number,
  catalogs?: FeatureCatalogs
): boolean {
  return canHpPoolHealTarget(targetData, amount, catalogs);
}

export function canHpPoolCureTarget(
  targetData: CharacterData,
  poolRemaining: number,
  resolved: ResolvedMechanicalFeature
): boolean {
  const cureCost = resolved.hpPool?.cureCost ?? 0;
  const conditions = resolved.hpPool?.cureConditions ?? [];
  if (cureCost <= 0 || conditions.length === 0) return false;
  if (poolRemaining < cureCost) return false;
  return conditions.some((slug) => targetHasCondition(targetData, slug));
}

export function canLayOnHandsCureTarget(
  targetData: CharacterData,
  poolRemaining: number
): boolean {
  return (
    poolRemaining >= LAY_ON_HANDS_CURE_COST && targetHasCondition(targetData, "poisoned")
  );
}

export function applyHpPoolCure(
  actorData: CharacterData,
  targetData: CharacterData,
  featureId: string,
  catalogs?: FeatureCatalogs
): { actorData: CharacterData; targetData: CharacterData } | null {
  const resolved = getResolvedMechanicalFeature(actorData, featureId, catalogs);
  if (!resolved || resolved.kind !== "hp-pool") return null;

  const pool = getHpPoolRemaining(actorData, featureId, catalogs);
  if (!canHpPoolCureTarget(targetData, pool, resolved)) return null;

  const cureCost = resolved.hpPool?.cureCost ?? 0;
  const conditions = resolved.hpPool?.cureConditions ?? [];
  const withPool = spendHpPool(actorData, featureId, cureCost, catalogs);
  const cured: CharacterData = {
    ...targetData,
    combat: {
      ...targetData.combat,
      conditions: removeConditionSlugs(targetData.combat.conditions ?? [], conditions),
    },
  };
  return { actorData: withPool, targetData: cured };
}

export function applyLayOnHandsCure(
  paladinData: CharacterData,
  targetData: CharacterData,
  catalogs?: FeatureCatalogs
): { paladinData: CharacterData; targetData: CharacterData } | null {
  const result = applyHpPoolCure(paladinData, targetData, LAY_ON_HANDS_ID, catalogs);
  if (!result) return null;
  return { paladinData: result.actorData, targetData: result.targetData };
}

export type HpPoolMode = "heal" | "cure";

export function applyHpPoolHeal(
  actorData: CharacterData,
  targetData: CharacterData,
  featureId: string,
  amount: number,
  catalogs?: FeatureCatalogs
): { actorData: CharacterData; targetData: CharacterData; healed: number } | null {
  const resolved = getResolvedMechanicalFeature(actorData, featureId, catalogs);
  if (!resolved || resolved.kind !== "hp-pool") return null;

  const pool = getHpPoolRemaining(actorData, featureId, catalogs);
  if (!canHpPoolHealTarget(targetData, amount, catalogs)) return null;

  const spend = Math.min(pool, Math.trunc(amount));
  if (spend <= 0) return null;

  const maxHp = getEffectiveMaxHp(targetData, catalogs);
  const needed = maxHp - targetData.combat.currentHp;
  const effectiveHeal = Math.min(spend, needed);
  if (effectiveHeal <= 0) return null;

  const withPool = spendHpPool(actorData, featureId, effectiveHeal, catalogs);
  const healedTarget = applyHealingToCharacter(targetData, effectiveHeal, catalogs);
  return { actorData: withPool, targetData: healedTarget, healed: effectiveHeal };
}

export function applyLayOnHandsHeal(
  paladinData: CharacterData,
  targetData: CharacterData,
  amount: number,
  catalogs?: FeatureCatalogs
): { paladinData: CharacterData; targetData: CharacterData; healed: number } | null {
  const result = applyHpPoolHeal(paladinData, targetData, LAY_ON_HANDS_ID, amount, catalogs);
  if (!result) return null;
  return {
    paladinData: result.actorData,
    targetData: result.targetData,
    healed: result.healed,
  };
}

export type LayOnHandsMode = HpPoolMode;

export function applyHpPoolFeature(
  actorData: CharacterData,
  targetData: CharacterData,
  featureId: string,
  mode: HpPoolMode,
  healAmount: number,
  catalogs?: FeatureCatalogs,
  options?: { selfTarget?: boolean }
):
  | { actorData: CharacterData; targetData: CharacterData; poolSpent: number; healed: number }
  | null {
  if (mode === "cure") {
    const result = applyHpPoolCure(actorData, targetData, featureId, catalogs);
    if (!result) return null;
    const resolved = getResolvedMechanicalFeature(actorData, featureId, catalogs);
    const cureCost = resolved?.hpPool?.cureCost ?? 0;
    const finalized = finalizeHpPoolSelfTarget(
      result.actorData,
      result.targetData,
      options?.selfTarget ?? false
    );
    return {
      actorData: finalized.actorData,
      targetData: finalized.targetData,
      poolSpent: cureCost,
      healed: 0,
    };
  }

  const result = applyHpPoolHeal(actorData, targetData, featureId, healAmount, catalogs);
  if (!result) return null;
  const finalized = finalizeHpPoolSelfTarget(
    result.actorData,
    result.targetData,
    options?.selfTarget ?? false
  );
  return {
    actorData: finalized.actorData,
    targetData: finalized.targetData,
    poolSpent: result.healed,
    healed: result.healed,
  };
}

export function applyLayOnHands(
  paladinData: CharacterData,
  targetData: CharacterData,
  mode: LayOnHandsMode,
  healAmount: number,
  catalogs?: FeatureCatalogs,
  options?: { selfTarget?: boolean }
):
  | { paladinData: CharacterData; targetData: CharacterData; poolSpent: number; healed: number }
  | null {
  const result = applyHpPoolFeature(
    paladinData,
    targetData,
    LAY_ON_HANDS_ID,
    mode,
    healAmount,
    catalogs,
    options
  );
  if (!result) return null;
  return {
    paladinData: result.actorData,
    targetData: result.targetData,
    poolSpent: result.poolSpent,
    healed: result.healed,
  };
}

function finalizeHpPoolSelfTarget(
  actorData: CharacterData,
  targetData: CharacterData,
  selfTarget: boolean
): { actorData: CharacterData; targetData: CharacterData } {
  if (!selfTarget) {
    return { actorData, targetData };
  }

  const merged: CharacterData = {
    ...actorData,
    combat: {
      ...actorData.combat,
      currentHp: targetData.combat.currentHp,
      conditions: targetData.combat.conditions ?? actorData.combat.conditions,
    },
  };

  return { actorData: merged, targetData: merged };
}

function mechanicalFeatureActionSourceLabel(featureId: string): string {
  if (featureId.startsWith("granted:species:")) return "Species";
  if (featureId.startsWith("granted:subclass:")) return "Subclass";
  if (featureId.startsWith("granted:class:")) return "Class";
  if (featureId.startsWith("granted:background:")) return "Background";
  return "Feature";
}

/** Rules-backed actions for mechanical features with usesAction set. */
export function deriveMechanicalFeatureActions(
  data: CharacterData,
  catalogs?: FeatureCatalogs
): CharacterActionEntry[] {
  const ctx = buildContext(data, catalogs);
  const actions: CharacterActionEntry[] = [];

  for (const resolved of listResolvedMechanicalFeatures(data, catalogs)) {
    if (!resolved.usesAction) continue;

    const max = resolved.maxValue(ctx);
    const current = getMechanicalFeatureCurrent(data, resolved.id, catalogs);

    actions.push({
      id: featureActionId(resolved.id),
      name: resolved.actionName,
      cost: resolved.actionCost,
      description: resolved.actionDescription,
      source: "feature",
      sourceLabel: mechanicalFeatureActionSourceLabel(resolved.id),
      uses:
        resolved.kind === "uses" || resolved.kind === "hp-pool"
          ? { current, max }
          : undefined,
      restReset: resolved.restReset,
    });
  }

  return actions;
}

/** Labels for mechanical features available on a short rest. */
export function getShortRestMechanicalPreview(
  data: CharacterData,
  catalogs?: FeatureCatalogs
): string[] {
  const items: string[] = [];
  const ctx = buildContext(data, catalogs);

  for (const def of Object.values(MECHANICAL_FEATURES)) {
    if (!def.qualifies(ctx)) continue;

    if (def.kind === "short-rest-slots") {
      const options = getSpellRecoveryOptions(data, def.id, catalogs);
      if (options?.available) {
        items.push(`${options.featureName} (up to ${options.budget} spell levels)`);
      }
      continue;
    }

    if (def.kind === "short-rest-heal") {
      const max = def.maxValue(ctx);
      const current = getMechanicalFeatureCurrent(data, def.id, catalogs);
      if (current < max) {
        const name =
          def.id === SECOND_WIND_ID ? "Second Wind" : "Short-rest healing";
        items.push(`${name} (${current}/${max})`);
      }
    }
  }

  return items;
}

/** Labels for depleted mechanical features that recharge on a long rest. */
export function getLongRestMechanicalPreview(
  data: CharacterData,
  catalogs?: FeatureCatalogs
): string[] {
  const items: string[] = [];
  const ctx = buildContext(data, catalogs);

  for (const def of Object.values(MECHANICAL_FEATURES)) {
    if (!def.qualifies(ctx)) continue;
    if (def.restReset !== "short" && def.restReset !== "long") continue;

    const max = def.maxValue(ctx);
    const current = getMechanicalFeatureCurrent(data, def.id, catalogs);
    if (current >= max) continue;

    if (def.kind === "short-rest-slots") {
      const label =
        def.id === ARCANE_RECOVERY_ID
          ? "Arcane Recovery"
          : def.id === NATURAL_RECOVERY_ID
            ? "Natural Recovery"
            : "Spell recovery";
      items.push(`${label} (${current}/${max})`);
      continue;
    }

    if (def.kind === "short-rest-heal") {
      const label =
        def.id === SECOND_WIND_ID ? "Second Wind" : "Short-rest healing";
      items.push(`${label} (${current}/${max})`);
      continue;
    }

    if (def.kind === "uses" || def.kind === "hp-pool") {
      const label =
        def.id === RAGE_ID
          ? "Rage"
          : def.id === BARDIC_INSPIRATION_ID
            ? "Bardic Inspiration"
            : def.id === LAY_ON_HANDS_ID
              ? "Lay on Hands"
              : def.id === TIDES_OF_CHAOS_ID
                ? "Tides of Chaos"
                : "Feature";
      items.push(`${label} (${current}/${max})`);
    }
  }

  return items;
}

function ordinalSuffix(level: number): string {
  const mod100 = level % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (level % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
