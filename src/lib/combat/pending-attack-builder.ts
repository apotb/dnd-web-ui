import {
  allSavesSubmitted,
  buildPendingTargetFromToken,
  computeDamageApplied,
  computeHitFromRoll,
  transitionToDmReview,
} from "@/lib/combat/attack-resolution";
import {
  findHostileTargetAtCell,
  getAoePreviewTargets,
  getValidHostileTargets,
  isTokenOnGrid,
  parseAttackRangeSpec,
} from "@/lib/combat/targeting";
import type { CombatOption } from "@/lib/combat/combat-options";
import { isMainHandWeaponAttackOption } from "@/lib/combat/combat-options";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { DerivedAttack } from "@/lib/dnd/attacks";
import type { EnemyData } from "@/lib/schemas/enemy";
import type {
  CombatState,
  CombatToken,
  PendingAttack,
  PendingAttackTarget,
} from "@/lib/schemas/combat-state";
import { isHostileToken } from "@/lib/combat/engagement";

export interface AttackSubmissionInput {
  attackRoll?: number | null;
  damageText?: string;
  damageRolls?: number[];
  damageAmount?: number | null;
  perTarget?: Array<{
    tokenId: string;
    attackRoll?: number | null;
    damageText?: string;
    damageRolls?: number[];
    damageAmount?: number | null;
  }>;
}

export function getOptionActionCost(
  option: CombatOption,
  options?: { isOpportunityAttack?: boolean }
): "action" | "bonus-action" | "reaction" {
  if (options?.isOpportunityAttack) return "reaction";
  if (option.kind === "bonus-action") return "bonus-action";
  return "action";
}

export function optionToAttack(option: CombatOption): DerivedAttack | null {
  if (option.attack) return option.attack;
  if (option.enemyAction) {
    return {
      id: option.id,
      name: option.name,
      attackBonus: 0,
      damageDice: "",
      damageType: "",
      range: "5 ft",
      notes: option.enemyAction.description,
      source: "manual",
      rollType: "attack",
    };
  }
  return null;
}

function resolveTokenContext(
  token: CombatToken,
  charactersById: Record<string, ParsedCharacter>,
  enemiesBySlug: Record<string, { data: EnemyData }>
) {
  const character = token.characterId ? charactersById[token.characterId] ?? null : null;
  const enemyData = token.enemySlug ? enemiesBySlug[token.enemySlug]?.data ?? null : null;
  return { character, enemyData };
}

export function buildTargetList(
  attacker: CombatToken,
  state: CombatState,
  attack: DerivedAttack,
  targetToken: CombatToken | null,
  aoeCenter: { x: number; y: number } | null,
  _charactersById: Record<string, ParsedCharacter>,
  _enemiesBySlug: Record<string, { data: EnemyData }>
): CombatToken[] {
  const spec = parseAttackRangeSpec(attack);
  const requiresSave = attack.rollType === "save";

  if (spec.isAoe && aoeCenter) {
    const includeAllies = requiresSave;
    return getAoePreviewTargets(attacker, aoeCenter, state, attack, includeAllies).filter(
      (token) => token.id !== attacker.id
    );
  }

  if (targetToken) {
    return isTokenValidSingleTarget(attacker, targetToken, attack, state)
      ? [targetToken]
      : [];
  }

  if (aoeCenter && !spec.isAoe) {
    const cellTarget = findHostileTargetAtCell(attacker, aoeCenter, state, attack);
    if (cellTarget) return [cellTarget];
  }

  return [];
}

export function createPendingAttack(
  state: CombatState,
  attacker: CombatToken,
  option: CombatOption,
  attack: DerivedAttack,
  targets: CombatToken[],
  aoeCenter: { x: number; y: number } | null,
  submission: AttackSubmissionInput,
  charactersById: Record<string, ParsedCharacter>,
  enemiesBySlug: Record<string, { data: EnemyData }>,
  options?: { isOpportunityAttack?: boolean; skipDmReview?: boolean }
): PendingAttack {
  const spec = parseAttackRangeSpec(attack);
  const requiresSave = attack.rollType === "save";
  const rollType = attack.rollType ?? "attack";

  const pendingTargets: PendingAttackTarget[] = targets.map((token) => {
    const ctx = resolveTokenContext(token, charactersById, enemiesBySlug);
    const base = buildPendingTargetFromToken(token, {
      character: ctx.character,
      enemyData: ctx.enemyData,
      requiresSave,
    });

    const perTarget = submission.perTarget?.find((entry) => entry.tokenId === token.id);
    const attackRoll = perTarget?.attackRoll ?? submission.attackRoll ?? null;
    const damageText = perTarget?.damageText ?? submission.damageText ?? "";
    const damageRolls = perTarget?.damageRolls ?? submission.damageRolls;
    const damageAmount = perTarget?.damageAmount ?? submission.damageAmount ?? null;

    if (rollType === "attack" && attackRoll != null && base.ac != null) {
      const hitResult = computeHitFromRoll(attackRoll, attack.attackBonus, base.ac);
      const resolvedTarget: PendingAttackTarget = {
        ...base,
        attackRoll,
        attackTotal: hitResult.total,
        hit: hitResult.hit,
        critical: hitResult.critical,
        damageText,
        damageRolls,
        damageAmount,
      };
      return {
        ...resolvedTarget,
        finalDamage: hitResult.hit
          ? computeDamageApplied(resolvedTarget, "attack", { damageDice: attack.damageDice })
          : 0,
      };
    }

    if (rollType === "auto") {
      return {
        ...base,
        hit: true,
        damageText,
        damageRolls,
        damageAmount,
        finalDamage: damageAmount ?? 0,
      };
    }

    return {
      ...base,
      damageText,
      damageRolls,
      damageAmount,
      saveSubmitted: false,
    };
  });

  const status =
    requiresSave && pendingTargets.some((t) => t.requiresSave && !t.saveSubmitted)
      ? "awaiting-saves"
      : "awaiting-dm-review";

  let pending: PendingAttack = {
    id: crypto.randomUUID(),
    attackerTokenId: attacker.id,
    optionId: option.id,
    optionName: option.name,
    actionCost: getOptionActionCost(option, options),
    isOpportunityAttack: options?.isOpportunityAttack ?? false,
    skipDmReview: options?.skipDmReview ?? false,
    rollType,
    attackBonus: attack.attackBonus,
    saveDc: attack.saveDc,
    saveAbility: attack.saveAbility,
    damageType: attack.damageType,
    damageDice: attack.damageDice,
    isMainHandWeapon: isMainHandWeaponAttackOption(option),
    isAoe: spec.isAoe,
    aoeCenter: aoeCenter ?? undefined,
    aoeShape: spec.aoeShape,
    status,
    targets: pendingTargets,
    narration: "",
  };

  if (status === "awaiting-dm-review") {
    pending = transitionToDmReview(pending);
  }

  return pending;
}

export function applySaveRoll(
  pending: PendingAttack,
  tokenId: string,
  saveRoll: number,
  saveTotal: number
): PendingAttack {
  const targets = pending.targets.map((target) => {
    if (target.tokenId !== tokenId) return target;
    const saveSucceeded = pending.saveDc != null ? saveTotal >= pending.saveDc : false;
    return {
      ...target,
      saveRoll,
      saveTotal,
      saveSucceeded,
      saveSubmitted: true,
    };
  });

  const next: PendingAttack = { ...pending, targets };
  if (allSavesSubmitted(next)) {
    return transitionToDmReview(next);
  }
  return next;
}

export function applyDmSaveRolls(
  pending: PendingAttack,
  saves: Array<{ tokenId: string; saveRoll: number; saveTotal: number }>
): PendingAttack {
  let next = pending;
  for (const save of saves) {
    next = applySaveRoll(next, save.tokenId, save.saveRoll, save.saveTotal);
  }
  return next;
}

export function getDmSaveTargets(pending: PendingAttack): PendingAttackTarget[] {
  if (pending.status !== "awaiting-saves") return [];
  return pending.targets.filter(
    (target) => target.requiresSave && !target.saveSubmitted && target.needsDmSave
  );
}

export function findPlayerSaveTarget(
  pending: PendingAttack,
  tokens: CombatToken[],
  charactersById: Record<string, ParsedCharacter>,
  userId: string
): PendingAttackTarget | null {
  for (const target of pending.targets) {
    if (!target.requiresSave || target.saveSubmitted || target.needsDmSave) continue;
    const token = tokens.find((t) => t.id === target.tokenId);
    if (!token?.characterId) continue;
    const character = charactersById[token.characterId];
    if (character?.owner_user_id === userId) {
      return target;
    }
  }
  return null;
}

export function findPlayerSaveContext(
  pendingAttacks: PendingAttack[],
  tokens: CombatToken[],
  charactersById: Record<string, ParsedCharacter>,
  userId: string
): { pending: PendingAttack; target: PendingAttackTarget } | null {
  for (const pending of pendingAttacks) {
    if (pending.status !== "awaiting-saves") continue;
    const target = findPlayerSaveTarget(pending, tokens, charactersById, userId);
    if (target) {
      return { pending, target };
    }
  }
  return null;
}

export function isTokenValidSingleTarget(
  attacker: CombatToken,
  target: CombatToken,
  attack: DerivedAttack,
  state: CombatState
): boolean {
  if (!isTokenOnGrid(target, state)) return false;
  if (target.id === attacker.id) return false;
  if (!isHostileToken(attacker, target) && attack.rollType !== "save") return false;
  const spec = parseAttackRangeSpec(attack);
  if (spec.isAoe) return false;
  return getValidHostileTargets(attacker, state, spec.maxFt).some((t) => t.id === target.id);
}
