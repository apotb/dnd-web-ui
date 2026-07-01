"use client";

import { useMemo, useState } from "react";
import type { ParsedCharacter } from "@/lib/character/utils";
import {
  LayOnHandsForm,
  type LayOnHandsTarget,
} from "@/components/character/lay-on-hands-form";
import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import {
  applyLayOnHands,
  canLayOnHandsCureTarget,
  canLayOnHandsHealTarget,
  getEffectiveMaxHp,
  getLayOnHandsPoolRemaining,
  type LayOnHandsMode,
} from "@/lib/dnd/mechanical-features";
import type { CharacterData } from "@/lib/schemas/character";

export interface LayOnHandsModalProps {
  paladin: ParsedCharacter;
  partyCharacters: ParsedCharacter[];
  featureCatalogs: FeatureCatalogs;
  onApply: (result: {
    paladinData: CharacterData;
    targetId: string;
    targetData: CharacterData;
  }) => Promise<void>;
  onClose: () => void;
}

function buildTargets(
  paladin: ParsedCharacter,
  partyCharacters: ParsedCharacter[],
  featureCatalogs: FeatureCatalogs
): LayOnHandsTarget[] {
  const all = [paladin, ...partyCharacters.filter((entry) => entry.id !== paladin.id)];
  return all.map((entry) => ({
    id: entry.id,
    name: entry.data.basicInfo.name || entry.name,
    currentHp: entry.data.combat.currentHp,
    maxHp: getEffectiveMaxHp(entry.data, featureCatalogs),
    poisoned: (entry.data.combat.conditions ?? []).includes("poisoned"),
  }));
}

export function LayOnHandsModal({
  paladin,
  partyCharacters,
  featureCatalogs,
  onApply,
  onClose,
}: LayOnHandsModalProps) {
  const targets = useMemo(
    () => buildTargets(paladin, partyCharacters, featureCatalogs),
    [paladin, partyCharacters, featureCatalogs]
  );
  const poolRemaining = getLayOnHandsPoolRemaining(paladin.data, featureCatalogs);
  const [selectedTargetId, setSelectedTargetId] = useState(targets[0]?.id ?? "");
  const [mode, setMode] = useState<LayOnHandsMode>("heal");
  const [healAmount, setHealAmount] = useState(1);
  const [busy, setBusy] = useState(false);

  const characterById = useMemo(() => {
    const map = new Map<string, ParsedCharacter>();
    map.set(paladin.id, paladin);
    for (const entry of partyCharacters) {
      map.set(entry.id, entry);
    }
    return map;
  }, [paladin, partyCharacters]);

  async function handleConfirm() {
    const target = characterById.get(selectedTargetId);
    if (!target) return;

    const pool = getLayOnHandsPoolRemaining(paladin.data, featureCatalogs);
    if (
      mode === "heal" &&
      !canLayOnHandsHealTarget(target.data, healAmount, featureCatalogs)
    ) {
      return;
    }
    if (mode === "cure" && !canLayOnHandsCureTarget(target.data, pool)) {
      return;
    }

    const result = applyLayOnHands(
      paladin.data,
      target.data,
      mode,
      healAmount,
      featureCatalogs,
      { selfTarget: target.id === paladin.id }
    );
    if (!result) return;

    setBusy(true);
    try {
      await onApply({
        paladinData: result.paladinData,
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
    />
  );
}
