"use client";

import { useMemo, useState } from "react";
import type { ParsedCharacter } from "@/lib/character/utils";
import {
  LayOnHandsForm,
  type LayOnHandsTarget,
} from "@/components/character/lay-on-hands-form";
import {
  getHpPoolTouchTargets,
  type HpPoolCombatTarget,
} from "@/lib/combat/combat-mechanical-actions";
import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import {
  canHpPoolCureTarget,
  canHpPoolHealTarget,
  getEffectiveMaxHp,
  getHpPoolRemaining,
  getResolvedMechanicalFeature,
  type HpPoolMode,
} from "@/lib/dnd/mechanical-features";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";

export interface CombatHpPoolModalProps {
  featureId: string;
  actorToken: CombatToken;
  actorCharacter: ParsedCharacter;
  combatState: CombatState;
  partyCharacters: ParsedCharacter[];
  featureCatalogs: FeatureCatalogs;
  onConfirm: (input: {
    target: HpPoolCombatTarget;
    mode: HpPoolMode;
    healAmount: number;
  }) => Promise<void>;
  onClose: () => void;
}

function buildTargets(
  touchTargets: HpPoolCombatTarget[],
  featureCatalogs: FeatureCatalogs,
  cureConditions: string[]
): LayOnHandsTarget[] {
  return touchTargets.map(({ token, character }) => ({
    id: token.id,
    name: character.data.basicInfo.name || character.name,
    currentHp: token.currentHp ?? character.data.combat.currentHp,
    maxHp: token.maxHp ?? getEffectiveMaxHp(character.data, featureCatalogs),
    poisoned: (character.data.combat.conditions ?? []).some((slug) =>
      cureConditions.includes(slug)
    ),
  }));
}

export function CombatHpPoolModal({
  featureId,
  actorToken,
  actorCharacter,
  combatState,
  partyCharacters,
  featureCatalogs,
  onConfirm,
  onClose,
}: CombatHpPoolModalProps) {
  const resolved = getResolvedMechanicalFeature(
    actorCharacter.data,
    featureId,
    featureCatalogs
  );
  const cureCost = resolved?.hpPool?.cureCost ?? 0;
  const cureConditions = resolved?.hpPool?.cureConditions ?? [];
  const enableCure = cureCost > 0 && cureConditions.length > 0;
  const featureName = resolved?.actionName ?? "Healing Pool";

  const touchTargets = useMemo(
    () =>
      getHpPoolTouchTargets(actorToken, actorCharacter, combatState, partyCharacters),
    [actorToken, actorCharacter, combatState, partyCharacters]
  );
  const targets = useMemo(
    () => buildTargets(touchTargets, featureCatalogs, cureConditions),
    [touchTargets, featureCatalogs, cureConditions]
  );
  const targetByTokenId = useMemo(
    () => new Map(touchTargets.map((entry) => [entry.token.id, entry])),
    [touchTargets]
  );
  const poolRemaining = getHpPoolRemaining(
    actorCharacter.data,
    featureId,
    featureCatalogs
  );
  const [selectedTargetId, setSelectedTargetId] = useState(targets[0]?.id ?? "");
  const [mode, setMode] = useState<HpPoolMode>("heal");
  const [healAmount, setHealAmount] = useState(1);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    const touchTarget = targetByTokenId.get(selectedTargetId);
    if (!touchTarget || !resolved) return;

    const pool = getHpPoolRemaining(actorCharacter.data, featureId, featureCatalogs);
    if (
      mode === "heal" &&
      !canHpPoolHealTarget(touchTarget.character.data, healAmount, featureCatalogs)
    ) {
      return;
    }
    if (mode === "cure" && !canHpPoolCureTarget(touchTarget.character.data, pool, resolved)) {
      return;
    }

    setBusy(true);
    try {
      await onConfirm({
        target: touchTarget,
        mode,
        healAmount,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <LayOnHandsForm
      targets={targets}
      poolRemaining={poolRemaining}
      selectedTargetId={selectedTargetId}
      onSelectTarget={setSelectedTargetId}
      mode={mode}
      onModeChange={setMode}
      healAmount={healAmount}
      onHealAmountChange={setHealAmount}
      onConfirm={() => void handleConfirm()}
      onCancel={onClose}
      busy={busy}
      title={`${featureName} (Action)`}
      cureCost={cureCost}
      enableCure={enableCure}
    />
  );
}
