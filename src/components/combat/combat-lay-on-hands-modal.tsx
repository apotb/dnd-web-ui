"use client";

import type { ParsedCharacter } from "@/lib/character/utils";
import { CombatHpPoolModal } from "@/components/combat/combat-hp-pool-modal";
import type { HpPoolCombatTarget } from "@/lib/combat/combat-mechanical-actions";
import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import { LAY_ON_HANDS_ID, type HpPoolMode } from "@/lib/dnd/mechanical-features";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";

export type LayOnHandsCombatTarget = HpPoolCombatTarget;
export type LayOnHandsMode = HpPoolMode;

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

export function CombatLayOnHandsModal(props: CombatLayOnHandsModalProps) {
  return <CombatHpPoolModal featureId={LAY_ON_HANDS_ID} {...props} />;
}
