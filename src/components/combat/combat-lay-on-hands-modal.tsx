"use client";

import { useMemo, useState } from "react";
import type { ParsedCharacter } from "@/lib/character/utils";
import {
  LayOnHandsForm,
  type LayOnHandsTarget,
} from "@/components/character/lay-on-hands-form";
import {
  getLayOnHandsTouchTargets,
  type LayOnHandsCombatTarget,
} from "@/lib/combat/combat-mechanical-actions";
import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import {
  canLayOnHandsCureTarget,
  canLayOnHandsHealTarget,
  getEffectiveMaxHp,
  getLayOnHandsPoolRemaining,
  type LayOnHandsMode,
} from "@/lib/dnd/mechanical-features";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";

export interface CombatLayOnHandsModalProps {
  actorToken: CombatToken;
  actorCharacter: ParsedCharacter;
  combatState: CombatState;
  partyCharacters: ParsedCharacter[];
  featureCatalogs: FeatureCatalogs;
  onConfirm: (input: {
    target: LayOnHandsCombatTarget;
    mode: LayOnHandsMode;
    healAmount: number;
  }) => Promise<void>;
  onClose: () => void;
}

function buildTargets(
  touchTargets: LayOnHandsCombatTarget[],
  featureCatalogs: FeatureCatalogs
): LayOnHandsTarget[] {
  return touchTargets.map(({ token, character }) => ({
    id: token.id,
    name: character.data.basicInfo.name || character.name,
    currentHp: token.currentHp ?? character.data.combat.currentHp,
    maxHp: token.maxHp ?? getEffectiveMaxHp(character.data, featureCatalogs),
    poisoned: (character.data.combat.conditions ?? []).includes("poisoned"),
  }));
}

export function CombatLayOnHandsModal({
  actorToken,
  actorCharacter,
  combatState,
  partyCharacters,
  featureCatalogs,
  onConfirm,
  onClose,
}: CombatLayOnHandsModalProps) {
  const touchTargets = useMemo(
    () =>
      getLayOnHandsTouchTargets(
        actorToken,
        actorCharacter,
        combatState,
        partyCharacters
      ),
    [actorToken, actorCharacter, combatState, partyCharacters]
  );
  const targets = useMemo(
    () => buildTargets(touchTargets, featureCatalogs),
    [touchTargets, featureCatalogs]
  );
  const targetByTokenId = useMemo(
    () => new Map(touchTargets.map((entry) => [entry.token.id, entry])),
    [touchTargets]
  );
  const poolRemaining = getLayOnHandsPoolRemaining(
    actorCharacter.data,
    featureCatalogs
  );
  const [selectedTargetId, setSelectedTargetId] = useState(targets[0]?.id ?? "");
  const [mode, setMode] = useState<LayOnHandsMode>("heal");
  const [healAmount, setHealAmount] = useState(1);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    const touchTarget = targetByTokenId.get(selectedTargetId);
    if (!touchTarget) return;

    const pool = getLayOnHandsPoolRemaining(actorCharacter.data, featureCatalogs);
    if (
      mode === "heal" &&
      !canLayOnHandsHealTarget(touchTarget.character.data, healAmount, featureCatalogs)
    ) {
      return;
    }
    if (mode === "cure" && !canLayOnHandsCureTarget(touchTarget.character.data, pool)) {
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
      title="Lay on Hands (Action)"
    />
  );
}
