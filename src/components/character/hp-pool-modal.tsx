"use client";

import { useMemo, useState } from "react";
import type { ParsedCharacter } from "@/lib/character/utils";
import {
  LayOnHandsForm,
  type LayOnHandsTarget,
} from "@/components/character/lay-on-hands-form";
import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import {
  applyHpPoolFeature,
  canHpPoolCureTarget,
  canHpPoolHealTarget,
  getEffectiveMaxHp,
  getHpPoolRemaining,
  getResolvedMechanicalFeature,
  type HpPoolMode,
} from "@/lib/dnd/mechanical-features";
import type { CharacterData } from "@/lib/schemas/character";

export interface HpPoolModalProps {
  featureId: string;
  actor: ParsedCharacter;
  partyCharacters: ParsedCharacter[];
  featureCatalogs: FeatureCatalogs;
  onApply: (result: {
    actorData: CharacterData;
    targetId: string;
    targetData: CharacterData;
  }) => Promise<void>;
  onClose: () => void;
}

function buildTargets(
  actor: ParsedCharacter,
  partyCharacters: ParsedCharacter[],
  featureCatalogs: FeatureCatalogs,
  cureConditions: string[]
): LayOnHandsTarget[] {
  const all = [actor, ...partyCharacters.filter((entry) => entry.id !== actor.id)];
  return all.map((entry) => ({
    id: entry.id,
    name: entry.data.basicInfo.name || entry.name,
    currentHp: entry.data.combat.currentHp,
    maxHp: getEffectiveMaxHp(entry.data, featureCatalogs),
    poisoned: (entry.data.combat.conditions ?? []).some((slug) =>
      cureConditions.includes(slug)
    ),
  }));
}

export function HpPoolModal({
  featureId,
  actor,
  partyCharacters,
  featureCatalogs,
  onApply,
  onClose,
}: HpPoolModalProps) {
  const resolved = getResolvedMechanicalFeature(actor.data, featureId, featureCatalogs);
  const cureCost = resolved?.hpPool?.cureCost ?? 0;
  const cureConditions = resolved?.hpPool?.cureConditions ?? [];
  const enableCure = cureCost > 0 && cureConditions.length > 0;
  const featureName = resolved?.actionName ?? "Healing Pool";

  const targets = useMemo(
    () => buildTargets(actor, partyCharacters, featureCatalogs, cureConditions),
    [actor, partyCharacters, featureCatalogs, cureConditions]
  );
  const poolRemaining = getHpPoolRemaining(actor.data, featureId, featureCatalogs);
  const [selectedTargetId, setSelectedTargetId] = useState(targets[0]?.id ?? "");
  const [mode, setMode] = useState<HpPoolMode>("heal");
  const [healAmount, setHealAmount] = useState(1);
  const [busy, setBusy] = useState(false);

  const characterById = useMemo(() => {
    const map = new Map<string, ParsedCharacter>();
    map.set(actor.id, actor);
    for (const entry of partyCharacters) {
      map.set(entry.id, entry);
    }
    return map;
  }, [actor, partyCharacters]);

  async function handleConfirm() {
    const target = characterById.get(selectedTargetId);
    if (!target || !resolved) return;

    const pool = getHpPoolRemaining(actor.data, featureId, featureCatalogs);
    if (
      mode === "heal" &&
      !canHpPoolHealTarget(target.data, healAmount, featureCatalogs)
    ) {
      return;
    }
    if (mode === "cure" && !canHpPoolCureTarget(target.data, pool, resolved)) {
      return;
    }

    const result = applyHpPoolFeature(
      actor.data,
      target.data,
      featureId,
      mode,
      healAmount,
      featureCatalogs,
      { selfTarget: target.id === actor.id }
    );
    if (!result) return;

    setBusy(true);
    try {
      await onApply({
        actorData: result.actorData,
        targetId: target.id,
        targetData: result.targetData,
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
      title={featureName}
      cureCost={cureCost}
      enableCure={enableCure}
    />
  );
}
