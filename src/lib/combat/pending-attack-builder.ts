import {
  allSavesSubmitted,
  buildPendingTargetFromToken,
  computeDamageApplied,
  computeHitFromRoll,
  getTokenSaveRollMode,
  transitionToDmReview,
} from "@/lib/combat/attack-resolution";
import {
  findHostileTargetAtCell,
  getAoePreviewTargets,
  getAttackRollDisadvantage,
  getValidHostileTargetsForAttack,
  isTokenOnGrid,
  parseAttackRangeSpec,
} from "@/lib/combat/targeting";
import type { CombatOption } from "@/lib/combat/combat-options";
import { isWieldedMainHandWeaponAttack } from "@/lib/combat/combat-options";
import { enemyActionToDerivedAttack } from "@/lib/combat/enemy-action-parser";
import { canTwoWeaponFightSameTurn } from "@/lib/dnd/two-weapon-fighting";
import { qualifiesForGreatWeaponFighting } from "@/lib/dnd/fighting-styles";
import type { WeaponGrip } from "@/lib/dnd/attacks";
import type { PhbClass } from "@/lib/dnd/phb/types";
import type { Item } from "@/lib/schemas/item";
import type { ParsedCharacter } from "@/lib/character/utils";
import { findAmmunitionStack, findInventoryStack } from "@/lib/dnd/ammunition";
import type { DerivedAttack } from "@/lib/dnd/attacks";
import type { EnemyData } from "@/lib/schemas/enemy";
import type {
  CombatState,
  CombatToken,
  PendingAttack,
  PendingAttackTarget,
} from "@/lib/schemas/combat-state";
import { isHostileToken } from "@/lib/combat/engagement";
import {
  attachSpellDetailsToPending,
  resolvePendingSpellDetailsForDeclareCast,
} from "@/lib/combat/pending-spell-details";

export interface AttackSubmissionInput {
  attackRoll?: number | null;
  attackRoll2?: number | null;
  damageText?: string;
  damageRolls?: number[];
  damageAmount?: number | null;
  /** Resolved damage dice (e.g. after versatile grip selection). */
  damageDice?: string;
  weaponGrip?: WeaponGrip;
  /** Protector token id per target token id (Fighting Style: Protection). */
  protectionByTargetId?: Record<string, string>;
  perTarget?: Array<{
    tokenId: string;
    attackRoll?: number | null;
    attackRoll2?: number | null;
    damageText?: string;
    damageRolls?: number[];
    damageAmount?: number | null;
  }>;
}

export function getOptionActionCost(
  option: CombatOption,
  options?: { isOpportunityAttack?: boolean }
): "action" | "bonus-action" | "reaction" | "multiattack" {
  if (options?.isOpportunityAttack) return "reaction";
  if (option.actionCostOverride === "multiattack") return "multiattack";
  if (option.kind === "bonus-action") return "bonus-action";
  return "action";
}

export function optionToAttack(option: CombatOption): DerivedAttack | null {
  if (option.attack) return option.attack;
  if (option.enemyAction) {
    const match = option.id.match(/^enemy-action:(\d+):/);
    const index = match ? parseInt(match[1], 10) : 0;
    return enemyActionToDerivedAttack(option.enemyAction, index);
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

function resolvePendingAmmunition(
  attack: DerivedAttack,
  attacker: CombatToken,
  charactersById: Record<string, ParsedCharacter>
): Pick<
  PendingAttack,
  "ammunitionInventoryItemId" | "ammunitionItemId" | "ammunitionItemName" | "ammunitionQuantity"
> {
  if (!attack.ammunitionItemId || !attacker.characterId) return {};

  const character = charactersById[attacker.characterId];
  if (!character) return {};

  const stack = findAmmunitionStack(
    character.data.inventory.items,
    attack.ammunitionItemId
  );

  return {
    ammunitionInventoryItemId: stack?.id,
    ammunitionItemId: attack.ammunitionItemId,
    ammunitionItemName: attack.ammunitionName,
    ammunitionQuantity: 1,
  };
}

function resolvePendingThrownWeapon(
  attack: DerivedAttack,
  attacker: CombatToken,
  charactersById: Record<string, ParsedCharacter>
): Pick<
  PendingAttack,
  "thrownInventoryItemId" | "thrownItemName" | "thrownItemId" | "thrownRemaining"
> {
  if (!attack.throwsWeapon || !attack.inventoryStackId || !attacker.characterId) return {};

  const character = charactersById[attacker.characterId];
  if (!character) return {};

  const stack = findInventoryStack(
    character.data.inventory.items,
    attack.inventoryStackId
  );
  if (!stack) return {};

  return {
    thrownInventoryItemId: stack.id,
    thrownItemName: attack.thrownItemName ?? attack.name,
    thrownItemId: attack.itemId,
    thrownRemaining: stack.quantity,
  };
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

  if (spec.isSelfSpace) {
    return getValidHostileTargetsForAttack(attacker, state, spec, attack);
  }

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
  options?: {
    isOpportunityAttack?: boolean;
    skipDmReview?: boolean;
    catalogItems?: Record<string, Item>;
    classCatalog?: PhbClass[];
  }
): PendingAttack {
  const spec = parseAttackRangeSpec(attack);
  const requiresSave = attack.rollType === "save";
  const rollType = attack.rollType ?? "attack";
  const resolvedDamageDice = submission.damageDice ?? attack.damageDice;
  const weaponGrip = submission.weaponGrip ?? "one-handed";

  const attackerCharacter = attacker.characterId
    ? charactersById[attacker.characterId] ?? null
    : null;

  const greatWeaponFighting =
    attackerCharacter != null &&
    options?.catalogItems != null &&
    qualifiesForGreatWeaponFighting(
      attackerCharacter.data,
      options.catalogItems,
      attack,
      weaponGrip,
      options.classCatalog
    );

  const protectionByTargetId = submission.protectionByTargetId ?? {};
  const protectionTokenIds = [
    ...new Set(Object.values(protectionByTargetId).filter(Boolean)),
  ];

  const pendingTargets: PendingAttackTarget[] = targets.map((token) => {
    const ctx = resolveTokenContext(token, charactersById, enemiesBySlug);
    const base = buildPendingTargetFromToken(token, {
      character: ctx.character,
      enemyData: ctx.enemyData,
      requiresSave,
    });
    const protectionDisadvantage = Boolean(protectionByTargetId[token.id]);
    const attackDisadvantage =
      getAttackRollDisadvantage(attacker, token, state, attack) || protectionDisadvantage;

    const perTarget = submission.perTarget?.find((entry) => entry.tokenId === token.id);
    const attackRoll = perTarget?.attackRoll ?? submission.attackRoll ?? null;
    const attackRoll2 = perTarget?.attackRoll2 ?? submission.attackRoll2 ?? null;
    const damageText = perTarget?.damageText ?? submission.damageText ?? "";
    const damageRolls = perTarget?.damageRolls ?? submission.damageRolls;
    const damageAmount = perTarget?.damageAmount ?? submission.damageAmount ?? null;

    if (rollType === "attack" && attackRoll != null && base.ac != null) {
      const hitResult = computeHitFromRoll(attackRoll, attack.attackBonus, base.ac, {
        attackRoll2,
        disadvantage: attackDisadvantage,
      });
      const resolvedTarget: PendingAttackTarget = {
        ...base,
        attackRoll,
        attackRoll2: attackDisadvantage ? attackRoll2 : null,
        attackDisadvantage,
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
          ? computeDamageApplied(resolvedTarget, "attack", { damageDice: resolvedDamageDice })
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
      attackDisadvantage,
      saveAdvantage: getTokenSaveRollMode(token, attack.saveAbility) === "advantage",
      saveDisadvantage: getTokenSaveRollMode(token, attack.saveAbility) === "disadvantage",
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

  const isWeaponAction =
    getOptionActionCost(option, options) === "action" &&
    option.attack?.source === "weapon";
  const unlocksTwoWeaponFighting =
    isWeaponAction &&
    attackerCharacter != null &&
    options?.catalogItems != null &&
    canTwoWeaponFightSameTurn(
      attackerCharacter.data,
      options.catalogItems,
      options.classCatalog
    );
  const weaponWieldOffHand =
    isWeaponAction && option.attack ? !!option.attack.isOffHand : undefined;

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
    saveHalfDamageOnSuccess: attack.saveHalfDamageOnSuccess ?? true,
    damageType: attack.damageType,
    damageDice: resolvedDamageDice,
    isMainHandWeapon: option.attack
      ? isWieldedMainHandWeaponAttack(option.attack)
      : false,
    unlocksTwoWeaponFighting: unlocksTwoWeaponFighting || undefined,
    weaponWieldOffHand,
    greatWeaponFighting: greatWeaponFighting || undefined,
    protectionTokenIds,
    isAoe: spec.isAoe,
    ...resolvePendingAmmunition(attack, attacker, charactersById),
    ...resolvePendingThrownWeapon(attack, attacker, charactersById),
    aoeCenter: aoeCenter ?? undefined,
    aoeShape: spec.aoeShape,
    status,
    targets: pendingTargets,
    narration: "",
  };

  if (status === "awaiting-dm-review") {
    pending = transitionToDmReview(pending);
  }

  return attachSpellDetailsToPending(pending, option, attack);
}

export function createPendingSpellCast(
  attacker: CombatToken,
  option: CombatOption,
  options?: { skipDmReview?: boolean }
): PendingAttack | null {
  const spellDetails = resolvePendingSpellDetailsForDeclareCast(option);
  if (!spellDetails) return null;

  const actionCost = spellDetails.castingCost;
  let pending: PendingAttack = {
    id: crypto.randomUUID(),
    attackerTokenId: attacker.id,
    optionId: option.id,
    optionName: option.name,
    actionCost,
    isOpportunityAttack: false,
    skipDmReview: options?.skipDmReview ?? false,
    rollType: "auto",
    saveHalfDamageOnSuccess: true,
    isMainHandWeapon: false,
    isAoe: false,
    status: "awaiting-dm-review",
    targets: [],
    narration: "",
    spellDetails,
  };

  if (!options?.skipDmReview) {
    pending = transitionToDmReview(pending);
  }

  return pending;
}

export function applySaveRoll(
  pending: PendingAttack,
  tokenId: string,
  saveRoll: number,
  saveTotal: number,
  saveRoll2?: number | null
): PendingAttack {
  const targets = pending.targets.map((target) => {
    if (target.tokenId !== tokenId) return target;
    const saveSucceeded = pending.saveDc != null ? saveTotal >= pending.saveDc : false;
    return {
      ...target,
      saveRoll,
      saveRoll2: saveRoll2 ?? null,
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
  saves: Array<{ tokenId: string; saveRoll: number; saveTotal: number; saveRoll2?: number | null }>
): PendingAttack {
  let next = pending;
  for (const save of saves) {
    next = applySaveRoll(next, save.tokenId, save.saveRoll, save.saveTotal, save.saveRoll2);
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
  return getValidHostileTargetsForAttack(attacker, state, spec, attack).some((t) => t.id === target.id);
}
