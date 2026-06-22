import type { ParsedCharacter } from "@/lib/character/utils";
import type { EnemyData } from "@/lib/schemas/enemy";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";

export interface TokenHpOverlay {
  currentHp: number;
  maxHp: number;
  damageTaken?: number;
}

export function combatTokenHpFingerprint(state: CombatState): string {
  return JSON.stringify(
    state.tokens.map((token) => ({
      id: token.id,
      currentHp: token.currentHp ?? null,
      maxHp: token.maxHp ?? null,
      damageTaken: token.damageTaken ?? 0,
    }))
  );
}

export function getTokenHpDisplay(
  token: CombatToken,
  character: ParsedCharacter | null,
  enemyData: EnemyData | null
): { currentHp: number; maxHp: number } {
  if (token.kind === "party" && character) {
    return {
      currentHp: token.currentHp ?? character.data.combat.currentHp,
      maxHp: token.maxHp ?? character.data.combat.maxHp,
    };
  }

  const maxHp = token.maxHp ?? enemyData?.hitPoints.average ?? 1;
  return {
    currentHp: token.currentHp ?? maxHp,
    maxHp,
  };
}

export function mergeLiveStatePreservingTokenHp(
  draft: CombatState,
  liveState: CombatState
): CombatState {
  const draftById = new Map(draft.tokens.map((token) => [token.id, token]));
  return {
    ...liveState,
    tokens: liveState.tokens.map((token) => {
      const local = draftById.get(token.id);
      if (!local || local.currentHp == null) return token;
      return {
        ...token,
        currentHp: local.currentHp,
        maxHp: local.maxHp ?? token.maxHp,
        damageTaken: local.damageTaken ?? token.damageTaken,
      };
    }),
  };
}

export function applyTokenHpOverlays(
  state: CombatState,
  overlays: ReadonlyMap<string, TokenHpOverlay>
): CombatState {
  if (overlays.size === 0) return state;

  return {
    ...state,
    tokens: state.tokens.map((token) => {
      const overlay = overlays.get(token.id);
      if (!overlay) return token;
      return {
        ...token,
        currentHp: overlay.currentHp,
        maxHp: overlay.maxHp,
        damageTaken: overlay.damageTaken ?? token.damageTaken,
      };
    }),
  };
}

export function reconcileTokenHpOverlays(
  liveState: CombatState,
  overlays: Map<string, TokenHpOverlay>
): boolean {
  let changed = false;

  for (const [tokenId, overlay] of overlays) {
    const liveToken = liveState.tokens.find((token) => token.id === tokenId);
    if (liveToken?.currentHp === overlay.currentHp) {
      overlays.delete(tokenId);
      changed = true;
    }
  }

  return changed;
}

export function applyHpDelta(currentHp: number, maxHp: number, delta: number): number {
  if (delta >= 0) {
    return Math.min(maxHp, currentHp + delta);
  }
  return Math.max(0, currentHp + delta);
}
