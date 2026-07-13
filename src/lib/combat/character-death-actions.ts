import { saveCharacterData, type SaveCharacterOptions } from "@/lib/character/save-character-data";
import { DEAD_CONDITION_SLUG, hasDeadCondition } from "@/lib/dnd/dying-state";
import { removeTokenFromState } from "@/lib/combat/state-utils";
import { persistCombatState } from "@/lib/hooks/use-realtime-combat-state";
import type { CharacterData } from "@/lib/schemas/character";
import type { CombatState } from "@/lib/schemas/combat-state";
import type { PhbClass } from "@/lib/dnd/phb/types";

export interface PersistCharacterDeathOptions extends SaveCharacterOptions {
  campaignId: string;
  characterId: string;
  nextData: CharacterData;
  combatState: CombatState;
  classes?: PhbClass[];
  /** When provided, used instead of direct persistCombatState (e.g. combat-board DM draft sync). */
  persistCombat?: (nextCombatState: CombatState) => Promise<string | null>;
}

export interface PersistCharacterDeathResult {
  nextCombatState: CombatState;
  error?: string;
}

/** Save dead character data and remove their party token from combat if present. */
export async function persistCharacterDeath(
  options: PersistCharacterDeathOptions
): Promise<PersistCharacterDeathResult> {
  const {
    campaignId,
    characterId,
    nextData,
    combatState,
    classes,
    isDm,
    originalData,
    persistCombat,
  } = options;

  if (!hasDeadCondition(nextData.combat)) {
    return { nextCombatState: combatState, error: "Character is not dead." };
  }

  const saveResult = await saveCharacterData(characterId, nextData, classes, {
    isDm,
    originalData,
  });
  if (saveResult.error) {
    return { nextCombatState: combatState, error: saveResult.error };
  }

  const token = combatState.tokens.find(
    (entry) => entry.kind === "party" && entry.characterId === characterId
  );
  if (!token) {
    return { nextCombatState: combatState };
  }

  const nextCombatState = removeTokenFromState(combatState, token.id);
  const shouldPersistCombat = persistCombat != null || isDm === true;
  if (shouldPersistCombat) {
    const persistFn =
      persistCombat ??
      ((state: CombatState) => persistCombatState(campaignId, state));
    const combatError = await persistFn(nextCombatState);
    if (combatError) {
      return { nextCombatState: combatState, error: combatError };
    }
  }

  return { nextCombatState };
}

/** Remove party tokens for characters marked dead in HP update patches. */
export function removeDeadCharacterTokensFromState(
  state: CombatState,
  characterUpdates: Array<{ characterId: string; conditions?: string[] }>
): CombatState {
  let next = state;
  for (const update of characterUpdates) {
    if (!update.conditions?.includes(DEAD_CONDITION_SLUG)) {
      continue;
    }
    const token = next.tokens.find(
      (entry) => entry.kind === "party" && entry.characterId === update.characterId
    );
    if (!token) continue;
    next = removeTokenFromState(next, token.id);
  }
  return next;
}
