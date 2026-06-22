import type { ParsedCharacter } from "@/lib/character/utils";
import { applyHpDamage } from "@/lib/character/combat-derivation";
import { parseDamageNotation } from "@/lib/dnd/dice";
import { canSkipOpportunityAttackAction, completeOpportunityAttackForAttacker } from "@/lib/combat/opportunity-attacks";
import {
  hasPendingAttackForAttacker,
  removePendingAttack,
} from "@/lib/combat/pending-attacks";
import { isBattleActive, isDmControlledToken } from "@/lib/combat/turn";
import type { EnemyData } from "@/lib/schemas/enemy";
import type {
  CombatState,
  CombatToken,
  PendingAttack,
  PendingAttackTarget,
} from "@/lib/schemas/combat-state";

export function getTokenAc(
  token: CombatToken,
  character: ParsedCharacter | null,
  enemyData: EnemyData | null
): number {
  if (token.kind === "party" && character) {
    return character.data.combat.ac;
  }
  if (token.kind === "enemy" && enemyData) {
    return enemyData.armorClass.value;
  }
  return 10;
}

export function getTokenCurrentHp(
  token: CombatToken,
  character: ParsedCharacter | null,
  enemyData: EnemyData | null
): number {
  if (token.currentHp != null) return token.currentHp;
  if (token.kind === "party" && character) return character.data.combat.currentHp;
  if (token.kind === "enemy" && enemyData) return enemyData.hitPoints.average;
  return 0;
}

export function getTokenMaxHp(
  token: CombatToken,
  character: ParsedCharacter | null,
  enemyData: EnemyData | null
): number {
  if (token.maxHp != null) return token.maxHp;
  if (token.kind === "party" && character) return character.data.combat.maxHp;
  if (token.kind === "enemy" && enemyData) return enemyData.hitPoints.average;
  return 0;
}

export function computeHitFromRoll(
  attackRoll: number,
  attackBonus: number,
  ac: number
): { total: number; hit: boolean; critical: boolean } {
  const total = attackRoll + attackBonus;
  const critical = attackRoll === 20;
  const fumble = attackRoll === 1;
  const hit = critical || (!fumble && total >= ac);
  return { total, hit, critical };
}

export function computeSaveSuccess(saveTotal: number, saveDc: number): boolean {
  return saveTotal >= saveDc;
}

export interface CharacterHpUpdate {
  characterId: string;
  currentHp: number;
  tempHp: number;
}

export function applyResolvedAttack(
  state: CombatState,
  pending: PendingAttack,
  charactersById: Record<string, ParsedCharacter> = {}
): {
  next: CombatState;
  characterUpdates: CharacterHpUpdate[];
} {
  const characterUpdates: CharacterHpUpdate[] = [];

  const tokens = state.tokens.map((token) => {
    const target = pending.targets.find((entry) => entry.tokenId === token.id);
    const damage = target?.finalDamage ?? 0;
    if (damage <= 0) return token;

    const damageTaken = (token.damageTaken ?? 0) + damage;

    if (token.kind === "party" && token.characterId) {
      const character = charactersById[token.characterId];
      const combat = character?.data.combat;
      if (!combat) {
        const currentHp = token.currentHp ?? 0;
        const nextHp = Math.max(0, currentHp - damage);
        characterUpdates.push({
          characterId: token.characterId,
          currentHp: nextHp,
          tempHp: 0,
        });
        return { ...token, currentHp: nextHp, damageTaken };
      }
      const currentHp = token.currentHp ?? combat.currentHp;
      const tempHp = combat.tempHp;
      const maxHp = token.maxHp ?? combat.maxHp;
      const result = applyHpDamage({ ...combat, currentHp, tempHp, maxHp }, damage);
      characterUpdates.push({
        characterId: token.characterId,
        currentHp: result.currentHp,
        tempHp: result.tempHp,
      });
      return {
        ...token,
        currentHp: result.currentHp,
        maxHp,
        damageTaken,
      };
    }

    const currentHp = token.currentHp ?? token.maxHp ?? 0;
    const nextHp = Math.max(0, currentHp - damage);
    return {
      ...token,
      currentHp: nextHp,
      damageTaken,
    };
  });

  let turn = { ...state.turn };
  if (!pending.isOpportunityAttack) {
    if (pending.actionCost === "action") {
      turn = {
        ...turn,
        actionUsed: true,
        actionUsedForTwoWeapon:
          pending.isMainHandWeapon || turn.actionUsedForTwoWeapon,
      };
    } else if (pending.actionCost === "bonus-action") {
      turn = { ...turn, bonusActionUsed: true };
    }
  }

  let nextState: CombatState = removePendingAttack(
    {
      ...state,
      tokens,
      turn,
    },
    pending.id
  );

  if (pending.isOpportunityAttack) {
    nextState = completeOpportunityAttackForAttacker(nextState, pending.attackerTokenId);
  }

  return {
    next: nextState,
    characterUpdates,
  };
}

export function allSavesSubmitted(pending: PendingAttack): boolean {
  return pending.targets.every((target) => target.saveSubmitted || !target.requiresSave);
}

export function buildPendingTargetFromToken(
  token: CombatToken,
  context: {
    character: ParsedCharacter | null;
    enemyData: EnemyData | null;
    requiresSave: boolean;
  }
): PendingAttackTarget {
  const ac = getTokenAc(token, context.character, context.enemyData);
  const currentHp = getTokenCurrentHp(token, context.character, context.enemyData);
  const maxHp = getTokenMaxHp(token, context.character, context.enemyData);
  const needsDmSave =
    context.requiresSave && isDmControlledToken(token, context.character);

  return {
    tokenId: token.id,
    label: token.label,
    ac,
    currentHp,
    maxHp,
    damageTakenBefore: token.damageTaken ?? 0,
    requiresSave: context.requiresSave,
    saveSubmitted: !context.requiresSave,
    needsDmSave,
  };
}

export interface ComputeDamageAppliedOptions {
  damageDice?: string;
}

export interface DamageRollComponents {
  diceSum: number;
  modifier: number;
}

export function resolveDamageRollComponents(
  target: PendingAttackTarget,
  damageDice?: string
): DamageRollComponents | null {
  const notation = damageDice?.trim() || target.damageText?.trim() || "";
  const parsed = notation ? parseDamageNotation(notation) : null;
  const amount = target.damageAmount ?? 0;

  if (target.damageRolls?.length) {
    const diceSum = target.damageRolls.reduce((sum, roll) => sum + roll, 0);
    return { diceSum, modifier: parsed?.modifier ?? 0 };
  }

  if (parsed) {
    return { diceSum: amount - parsed.modifier, modifier: parsed.modifier };
  }

  return null;
}

/** Double total damage after flat modifiers: (dice + flat) × 2. */
export function applyCriticalToDamage(baseDamage: number, critical: boolean): number {
  if (!critical) return baseDamage;
  return baseDamage * 2;
}

export function formatCriticalDamageBreakdown(
  components: DamageRollComponents,
  total: number
): string {
  const base = components.diceSum + components.modifier;
  const inner =
    components.modifier !== 0
      ? `${components.diceSum}${components.modifier >= 0 ? " + " : " − "}${Math.abs(components.modifier)}`
      : String(components.diceSum);
  return `(${inner}) × 2 = ${total}`;
}

export function computeDamageApplied(
  target: PendingAttackTarget,
  rollType: PendingAttack["rollType"],
  options?: ComputeDamageAppliedOptions
): number {
  const amount = target.damageAmount ?? 0;

  if (rollType === "attack") {
    if (target.hit === false) return 0;
    if (target.hit !== true) return 0;
  }

  let damage = amount;

  if (rollType === "attack" && target.critical) {
    damage = applyCriticalToDamage(amount, true);
  }

  if (target.requiresSave && target.saveSucceeded === true) {
    return Math.floor(damage / 2);
  }

  return damage;
}

export function formatDamageAppliedBreakdown(
  target: PendingAttackTarget,
  rollType: PendingAttack["rollType"],
  damage: number,
  options?: ComputeDamageAppliedOptions
): string | null {
  if (rollType !== "attack" || !target.critical || target.hit !== true) return null;

  const components = resolveDamageRollComponents(target, options?.damageDice);
  if (components) {
    return formatCriticalDamageBreakdown(components, damage);
  }

  const base = target.damageAmount ?? 0;
  return `(${base}) × 2 = ${damage}`;
}

export function resolveFinalDamageApplied(
  target: PendingAttackTarget,
  rollType: PendingAttack["rollType"],
  overrideText: string,
  parseValue: (value: string) => number | null,
  options?: ComputeDamageAppliedOptions
): number {
  const trimmed = overrideText.trim();
  if (trimmed) {
    return parseValue(trimmed) ?? 0;
  }
  return computeDamageApplied(target, rollType, options);
}

export function canSubmitAttack(state: CombatState, attackerTokenId: string): boolean {
  return isBattleActive(state) && !hasPendingAttackForAttacker(state, attackerTokenId);
}

export function canSubmitOpportunityAttack(
  state: CombatState,
  attackerTokenId: string
): boolean {
  if (!isBattleActive(state)) return false;
  if (!canSkipOpportunityAttackAction(state, attackerTokenId)) return false;
  if (hasPendingAttackForAttacker(state, attackerTokenId)) return false;
  return true;
}

export function transitionToDmReview(pending: PendingAttack): PendingAttack {
  const targets = pending.targets.map((target) => {
    const finalDamage = computeDamageApplied(target, pending.rollType, {
      damageDice: pending.damageDice,
    });
    return { ...target, finalDamage };
  });

  return {
    ...pending,
    status: "awaiting-dm-review",
    targets,
  };
}
