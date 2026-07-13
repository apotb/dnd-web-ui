import type { ParsedCharacter } from "@/lib/character/utils";
import type { PartyAlly } from "@/lib/schemas/party";
import type { CharacterActionEntry } from "@/lib/dnd/character-actions";
import { ACTION_COST_LABELS } from "@/lib/dnd/character-actions";
import { formatBattleActionTooltip } from "@/lib/combat/battle-tooltip";
import type { AbilityKey } from "@/lib/schemas/character";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import { getConditionBySlug, getConditionDisplayName, conditionSlugsIncapacitate } from "@/lib/dnd/conditions";
import { applyActionUsed, applyBonusActionUsed } from "@/lib/combat/turn";

export const SHELL_DEFENSE_EFFECT_ID = "shell-defense";
export const SHELL_DEFENSE_ENTER_ACTION_ID = "feature:granted:species:shell-defense";
export const EMERGE_FROM_SHELL_ACTION_ID = "combat:emerge-shell";

export type SaveRollMode = "advantage" | "disadvantage" | null;

export interface CombatFeatureEffectDef {
  id: string;
  enterActionId?: string;
  exitActionId?: string;
  acBonus?: number;
  speedOverride?: number;
  saveAdvantageAbilities?: AbilityKey[];
  saveDisadvantageAbilities?: AbilityKey[];
  blocksReactions?: boolean;
  restrictsActions?: boolean;
  /** Sheet conditions applied while this effect is active (catalog slugs). */
  appliedConditionSlugs?: string[];
}

const SHELL_DEFENSE: CombatFeatureEffectDef = {
  id: SHELL_DEFENSE_EFFECT_ID,
  enterActionId: SHELL_DEFENSE_ENTER_ACTION_ID,
  exitActionId: EMERGE_FROM_SHELL_ACTION_ID,
  acBonus: 4,
  speedOverride: 0,
  saveAdvantageAbilities: ["str", "con"],
  saveDisadvantageAbilities: ["dex"],
  blocksReactions: true,
  restrictsActions: true,
  appliedConditionSlugs: ["in-shell", "prone"],
};

const COMBAT_FEATURE_EFFECTS: Record<string, CombatFeatureEffectDef> = {
  [SHELL_DEFENSE_EFFECT_ID]: SHELL_DEFENSE,
};

const EMERGE_FROM_SHELL_ACTION: CharacterActionEntry = {
  id: EMERGE_FROM_SHELL_ACTION_ID,
  name: "Emerge from Shell",
  cost: "bonus-action",
  description:
    "End Shell Defense. You are no longer in your shell or prone, and regain your normal speed, AC, and saving throw modifiers.",
  source: "feature",
  sourceLabel: "Shell Defense",
};

export function getCombatFeatureEffectDef(effectId: string): CombatFeatureEffectDef | null {
  return COMBAT_FEATURE_EFFECTS[effectId] ?? null;
}

export function getRegisteredFeatureEnterActionIds(): string[] {
  return Object.values(COMBAT_FEATURE_EFFECTS)
    .map((def) => def.enterActionId)
    .filter((id): id is string => Boolean(id));
}

export function getRegisteredFeatureExitActionIds(): string[] {
  return Object.values(COMBAT_FEATURE_EFFECTS)
    .map((def) => def.exitActionId)
    .filter((id): id is string => Boolean(id));
}

export function isRegisteredFeatureEnterAction(actionId: string): boolean {
  return getRegisteredFeatureEnterActionIds().includes(actionId);
}

export function isRegisteredFeatureExitAction(actionId: string): boolean {
  return getRegisteredFeatureExitActionIds().includes(actionId);
}

export function isRegisteredCombatFeatureAction(actionId: string): boolean {
  return isRegisteredFeatureEnterAction(actionId) || isRegisteredFeatureExitAction(actionId);
}

export function getEffectIdForEnterAction(actionId: string): string | null {
  for (const def of Object.values(COMBAT_FEATURE_EFFECTS)) {
    if (def.enterActionId === actionId) return def.id;
  }
  return null;
}

export function getEffectIdForExitAction(actionId: string): string | null {
  for (const def of Object.values(COMBAT_FEATURE_EFFECTS)) {
    if (def.exitActionId === actionId) return def.id;
  }
  return null;
}

export function hasCombatEffect(token: CombatToken, effectId: string): boolean {
  return (token.activeEffects ?? []).includes(effectId);
}

export function isTokenInShellDefense(token: CombatToken): boolean {
  return hasCombatEffect(token, SHELL_DEFENSE_EFFECT_ID);
}

function getActiveEffectDefs(token: CombatToken): CombatFeatureEffectDef[] {
  return (token.activeEffects ?? [])
    .map((id) => COMBAT_FEATURE_EFFECTS[id])
    .filter((def): def is CombatFeatureEffectDef => def != null);
}

export function isTokenRestrictedByEffects(token: CombatToken): boolean {
  return getActiveEffectDefs(token).some((def) => def.restrictsActions);
}

export function getCombatEffectAcBonus(token: CombatToken): number {
  return getActiveEffectDefs(token).reduce((sum, def) => sum + (def.acBonus ?? 0), 0);
}

export function getCombatEffectSpeedOverride(
  token: CombatToken,
  baseSpeed: number
): number {
  for (const def of getActiveEffectDefs(token)) {
    if (def.speedOverride != null) return def.speedOverride;
  }
  return baseSpeed;
}

export function getCombatEffectSaveRollMode(
  token: CombatToken,
  ability: AbilityKey | null
): SaveRollMode {
  if (!ability) return null;

  const defs = getActiveEffectDefs(token);
  const hasAdvantage = defs.some((def) => def.saveAdvantageAbilities?.includes(ability));
  const hasDisadvantage = defs.some((def) => def.saveDisadvantageAbilities?.includes(ability));

  if (hasAdvantage && !hasDisadvantage) return "advantage";
  if (hasDisadvantage && !hasAdvantage) return "disadvantage";
  return null;
}

export function canTakeReactions(token: CombatToken, context?: TokenStatusContext): boolean {
  if (isTokenIncapacitated(token, context)) return false;
  return !getActiveEffectDefs(token).some((def) => def.blocksReactions);
}

export interface TokenStatusContext {
  conditionsByCharacterId?: Record<string, string[]>;
  conditionsByAllyId?: Record<string, string[]>;
  hpByCharacterId?: Record<string, number>;
}

export function buildTokenStatusContext(
  characters: ParsedCharacter[],
  allies: PartyAlly[] = []
): TokenStatusContext {
  return {
    conditionsByCharacterId: Object.fromEntries(
      characters.map((character) => [character.id, character.data.combat.conditions ?? []])
    ),
    conditionsByAllyId: Object.fromEntries(
      allies.map((ally) => [ally.id, ally.conditions ?? []])
    ),
    hpByCharacterId: Object.fromEntries(
      characters.map((character) => [character.id, character.data.combat.currentHp])
    ),
  };
}

function getTokenConditionSlugs(
  token: CombatToken,
  context?: TokenStatusContext
): string[] {
  const fromCharacter =
    token.characterId && context?.conditionsByCharacterId
      ? context.conditionsByCharacterId[token.characterId] ?? []
      : [];
  const fromAlly =
    token.kind === "ally" && token.allyId && context?.conditionsByAllyId
      ? context.conditionsByAllyId[token.allyId] ?? []
      : [];
  const fromEffects = getTokenStatusEntries(token).map((entry) => entry.slug);
  return [...fromCharacter, ...fromAlly, ...fromEffects];
}

function getEffectiveTokenHp(
  token: CombatToken,
  context?: TokenStatusContext
): number | null {
  if (token.currentHp != null) return token.currentHp;
  if (
    (token.kind === "party" || token.kind === "ally") &&
    token.characterId &&
    context?.hpByCharacterId
  ) {
    const fromCharacter = context.hpByCharacterId[token.characterId];
    if (fromCharacter != null) return fromCharacter;
  }
  if (token.kind === "enemy" && token.maxHp != null) {
    return Math.max(0, token.maxHp - (token.damageTaken ?? 0));
  }
  return null;
}

/** Whether the token cannot take actions or reactions (0 HP, incapacitating condition, etc.). */
export function isTokenIncapacitated(
  token: CombatToken,
  context?: TokenStatusContext
): boolean {
  if (token.kind === "marker") return false;
  const effectiveHp = getEffectiveTokenHp(token, context);
  if (effectiveHp != null && effectiveHp <= 0) return true;
  if (isTokenRestrictedByEffects(token)) return true;
  return conditionSlugsIncapacitate(getTokenConditionSlugs(token, context));
}

export function getTokenStatusEntries(
  token: CombatToken,
  context?: TokenStatusContext
): { slug: string; label: string }[] {
  const entries: { slug: string; label: string }[] = [];
  const seen = new Set<string>();

  const fromCharacter =
    token.characterId && context?.conditionsByCharacterId
      ? context.conditionsByCharacterId[token.characterId] ?? []
      : [];
  const fromAlly =
    token.kind === "ally" && token.allyId && context?.conditionsByAllyId
      ? context.conditionsByAllyId[token.allyId] ?? []
      : [];
  for (const slug of [...fromCharacter, ...fromAlly]) {
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    entries.push({ slug, label: getConditionDisplayName(slug) });
  }

  for (const def of getActiveEffectDefs(token)) {
    for (const slug of def.appliedConditionSlugs ?? []) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      entries.push({ slug, label: getConditionDisplayName(slug) });
    }
  }

  return entries;
}

export function getTokenStatusTooltip(slug: string): string | null {
  const description = getConditionBySlug(slug)?.description.trim();
  return description || null;
}

export function getTokenStatusLabels(
  token: CombatToken,
  context?: TokenStatusContext
): string[] {
  return getTokenStatusEntries(token, context).map((entry) => entry.label);
}

export function buildEmergeFromShellCombatOption() {
  return {
    id: `bonus-action:${EMERGE_FROM_SHELL_ACTION_ID}`,
    name: EMERGE_FROM_SHELL_ACTION.name,
    subtitle: ACTION_COST_LABELS["bonus-action"],
    tooltip: formatBattleActionTooltip(EMERGE_FROM_SHELL_ACTION),
    kind: "bonus-action" as const,
    action: EMERGE_FROM_SHELL_ACTION,
  };
}

export function filterOptionGroupsForTokenEffects(
  token: CombatToken,
  groups: { actions: unknown[]; multiattackActions?: unknown[]; bonusActions: unknown[] },
  turn: { bonusActionUsed: boolean }
): { actions: unknown[]; multiattackActions: unknown[]; bonusActions: unknown[] } {
  if (!isTokenRestrictedByEffects(token)) {
    return {
      actions: groups.actions,
      multiattackActions: groups.multiattackActions ?? [],
      bonusActions: groups.bonusActions,
    };
  }

  const bonusActions =
    turn.bonusActionUsed || !isTokenInShellDefense(token)
      ? []
      : [buildEmergeFromShellCombatOption()];

  return { actions: [], multiattackActions: [], bonusActions };
}

export function applyCombatEffectEnter(
  state: CombatState,
  tokenId: string,
  effectId: string
): CombatState {
  const def = COMBAT_FEATURE_EFFECTS[effectId];
  if (!def) return state;

  const token = state.tokens.find((entry) => entry.id === tokenId);
  if (!token || hasCombatEffect(token, effectId)) return state;
  if (state.turn.actionUsed) return state;

  const next: CombatState = {
    ...state,
    tokens: state.tokens.map((entry) =>
      entry.id === tokenId
        ? {
            ...entry,
            activeEffects: [...(entry.activeEffects ?? []), effectId],
          }
        : entry
    ),
  };

  return applyActionUsed(next);
}

export function applyCombatEffectExit(
  state: CombatState,
  tokenId: string,
  effectId: string
): CombatState {
  const def = COMBAT_FEATURE_EFFECTS[effectId];
  if (!def) return state;

  const token = state.tokens.find((entry) => entry.id === tokenId);
  if (!token || !hasCombatEffect(token, effectId)) return state;
  if (state.turn.bonusActionUsed) return state;

  const next: CombatState = {
    ...state,
    tokens: state.tokens.map((entry) =>
      entry.id === tokenId
        ? {
            ...entry,
            activeEffects: (entry.activeEffects ?? []).filter((id) => id !== effectId),
          }
        : entry
    ),
  };

  return applyBonusActionUsed(next);
}

export function resolveEffectiveSaveRoll(
  roll: number,
  roll2: number | null | undefined,
  mode: SaveRollMode
): number {
  if (!mode || roll2 == null) return roll;
  if (mode === "advantage") return Math.max(roll, roll2);
  return Math.min(roll, roll2);
}
