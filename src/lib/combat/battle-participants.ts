import type { CombatState } from "@/lib/schemas/combat-state";

/** Record characters who joined the combat board at any point this encounter. */
export function registerBattleParticipants(
  state: CombatState,
  characterIds: Iterable<string>
): CombatState {
  const existing = new Set(state.battleParticipantCharacterIds ?? []);
  let changed = false;

  for (const id of characterIds) {
    if (!id || existing.has(id)) continue;
    existing.add(id);
    changed = true;
  }

  if (!changed) return state;
  return { ...state, battleParticipantCharacterIds: [...existing] };
}

export function getBattleParticipantIdSet(state: CombatState): Set<string> {
  return new Set(state.battleParticipantCharacterIds ?? []);
}
