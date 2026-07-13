"use client";

import { CombatAttackReviewCard } from "@/components/combat/combat-attack-review-card";
import { getTokenSaveModifier } from "@/lib/combat/attack-resolution";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { PhbClass } from "@/lib/dnd/phb/types";
import type { EnemyData } from "@/lib/schemas/enemy";
import type { CombatToken, PendingAttack } from "@/lib/schemas/combat-state";

interface CombatDmApprovalTrayProps {
  pendingAttacks: PendingAttack[];
  tokens: CombatToken[];
  charactersById: Record<string, ParsedCharacter>;
  enemiesBySlug: Record<string, { data: EnemyData }>;
  classCatalog?: PhbClass[];
  resolveDisadvantageLabel?: (
    pending: PendingAttack,
    targetTokenId: string
  ) => string | null;
  resolveAdvantageLabel?: (
    pending: PendingAttack,
    targetTokenId: string
  ) => string | null;
  resolvingAttackId: string | null;
  submittingSaveId: string | null;
  onReject: (pendingAttackId: string) => void;
  onConfirm: (pending: PendingAttack) => void;
  onSubmitDmSaves: (
    pendingAttackId: string,
    saves: Array<{ tokenId: string; saveRoll: number; saveTotal: number }>
  ) => void;
}

function getAttackerLabel(pending: PendingAttack, tokens: CombatToken[]): string {
  const token = tokens.find((entry) => entry.id === pending.attackerTokenId);
  return token?.label ?? "Unknown attacker";
}

export function CombatDmApprovalTray({
  pendingAttacks,
  tokens,
  charactersById,
  enemiesBySlug,
  classCatalog,
  resolveDisadvantageLabel,
  resolveAdvantageLabel,
  resolvingAttackId,
  submittingSaveId,
  onReject,
  onConfirm,
  onSubmitDmSaves,
}: CombatDmApprovalTrayProps) {
  if (pendingAttacks.length === 0) return null;

  function resolveSaveModifier(
    pending: PendingAttack,
    targetTokenId: string
  ): number | null {
    const token = tokens.find((entry) => entry.id === targetTokenId);
    if (!token) return null;
    const character = token.characterId ? charactersById[token.characterId] ?? null : null;
    const enemyData = token.enemySlug ? enemiesBySlug[token.enemySlug]?.data ?? null : null;
    return getTokenSaveModifier(token, pending.saveAbility, {
      character,
      enemyData,
      classCatalog,
    });
  }

  return (
    <section className="combat-dm-approval-tray" aria-label="Pending action approvals">
      <div className="combat-dm-approval-tray-header">
        <h3 className="combat-dm-approval-tray-title">
          Pending actions
          <span className="combat-dm-approval-tray-count">{pendingAttacks.length}</span>
        </h3>
      </div>
      <div className="combat-dm-approval-tray-scroll">
        {pendingAttacks.map((pending) => (
          <CombatAttackReviewCard
            key={`${pending.id}-${pending.status}`}
            pending={pending}
            attackerLabel={getAttackerLabel(pending, tokens)}
            resolveDisadvantageLabel={
              resolveDisadvantageLabel
                ? (targetTokenId) => resolveDisadvantageLabel(pending, targetTokenId)
                : undefined
            }
            resolveAdvantageLabel={
              resolveAdvantageLabel
                ? (targetTokenId) => resolveAdvantageLabel(pending, targetTokenId)
                : undefined
            }
            resolveSaveModifier={(targetTokenId) => resolveSaveModifier(pending, targetTokenId)}
            submitting={resolvingAttackId === pending.id}
            submittingSaves={submittingSaveId === pending.id}
            onReject={() => onReject(pending.id)}
            onConfirm={onConfirm}
            onSubmitDmSaves={(saves) => onSubmitDmSaves(pending.id, saves)}
          />
        ))}
      </div>
    </section>
  );
}
