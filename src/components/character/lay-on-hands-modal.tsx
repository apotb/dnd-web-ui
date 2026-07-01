"use client";

import type { ParsedCharacter } from "@/lib/character/utils";
import { HpPoolModal } from "@/components/character/hp-pool-modal";
import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import { LAY_ON_HANDS_ID } from "@/lib/dnd/mechanical-features";
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

export function LayOnHandsModal({
  paladin,
  partyCharacters,
  featureCatalogs,
  onApply,
  onClose,
}: LayOnHandsModalProps) {
  return (
    <HpPoolModal
      featureId={LAY_ON_HANDS_ID}
      actor={paladin}
      partyCharacters={partyCharacters}
      featureCatalogs={featureCatalogs}
      onApply={({ actorData, targetId, targetData }) =>
        onApply({ paladinData: actorData, targetId, targetData })
      }
      onClose={onClose}
    />
  );
}
