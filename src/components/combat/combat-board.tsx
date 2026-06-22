"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addEnemyToState,
  addPartyMembersToState,
  removeTokenFromState,
  resetCombatBoard,
  syncPartyTokens,
  updateGridInState,
  updateTokenInState,
  type EnemyRecord,
} from "@/lib/combat/state-utils";
import { clearCampaignInitiativeRolls } from "@/lib/combat/initiative-actions";
import {
  finalizeInitiativeIfReady,
  formatInitiativeResultTooltip,
  getPartyInitiativeModifierForCharacter,
  startInitiativeCollection,
} from "@/lib/combat/initiative";
import { saveCharacterData } from "@/lib/character/save-character-data";
import {
  applyHpDelta,
  applyTokenHpOverlays,
  combatTokenHpFingerprint,
  getTokenHpDisplay,
  mergeLiveStatePreservingTokenHp,
  reconcileTokenHpOverlays,
  type TokenHpOverlay,
} from "@/lib/combat/hp-adjust";
import {
  removeCombatImage,
  resolveCombatImageUrl,
  uploadCombatBackground,
} from "@/lib/combat/storage";
import { getCharacterPortraitUrl } from "@/lib/character/portrait-storage";
import type { ParsedCharacter } from "@/lib/character/utils";
import { speciesSubtitleLabel } from "@/lib/content/catalog-tooltip";
import { PHB_SPECIES } from "@/lib/dnd/phb/species";
import {
  persistCombatState,
  useRealtimeCombatState,
} from "@/lib/hooks/use-realtime-combat-state";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import {
  MAX_GRID_SIZE,
  MAX_TILE_FEET,
  MIN_GRID_SIZE,
  MIN_TILE_FEET,
} from "@/lib/schemas/combat-grid";
import { AddEnemyDialog } from "@/components/combat/add-enemy-dialog";
import { AddPartyMemberDialog } from "@/components/combat/add-party-member-dialog";
import {
  CombatActionPanel,
  CombatBonusActionPanel,
} from "@/components/combat/combat-action-panel";
import { CombatEndTurnConfirmModal } from "@/components/combat/combat-end-turn-confirm-modal";
import { CombatEndTurnPanel } from "@/components/combat/combat-end-turn-panel";
import { CombatMovePanel } from "@/components/combat/combat-move-panel";
import { CombatMovementOverlay } from "@/components/combat/combat-movement-overlay";
import { CombatHelpTargetModal } from "@/components/combat/combat-help-target-modal";
import { CombatDashConfirmModal } from "@/components/combat/combat-dash-confirm-modal";
import { CombatHpAdjustModal } from "@/components/combat/combat-hp-adjust-modal";
import { CombatRollModal } from "@/components/combat/combat-roll-modal";
import { CombatOpportunityAttackModal } from "@/components/combat/combat-opportunity-attack-modal";
import { CombatOpportunityAttackPanel } from "@/components/combat/combat-opportunity-attack-panel";
import { CombatAttackSubmitModal } from "@/components/combat/combat-attack-submit-modal";
import type { AttackSubmitValues } from "@/components/combat/combat-attack-submit-modal";
import { CombatDmApprovalTray } from "@/components/combat/combat-dm-approval-tray";
import { CombatSaveRollModal } from "@/components/combat/combat-save-roll-modal";
import { CombatTargetingOverlay } from "@/components/combat/combat-targeting-overlay";
import { Tooltip } from "@/components/ui/tooltip";
import {
  getCombatOptionGroupsForToken,
  getOpportunityAttackOptionsForToken,
  isAttackTargetingOption,
  isConfirmActionOption,
  isDashActionOption,
  isDisengageActionOption,
  isHelpActionOption,
  isImplementedCombatOption,
  type CombatOption,
} from "@/lib/combat/combat-options";
import {
  recordCombatActionUsed,
  recordCombatDash,
  recordCombatDisengage,
} from "@/lib/combat/combat-action-actions";
import {
  cancelCombatAttack,
  resolveCombatAttack,
  submitCombatAttack,
  submitCombatDmSaveRolls,
  submitCombatSaveRoll,
  type CharacterHpUpdate,
} from "@/lib/combat/attack-actions";
import {
  buildTargetList,
  findPlayerSaveContext,
  optionToAttack,
} from "@/lib/combat/pending-attack-builder";
import {
  getPendingAttackForAttacker,
  getDmApprovalTrayAttacks,
  hasPendingAttackForAttacker,
  canAdvanceTurnWithPendingAttacks,
} from "@/lib/combat/pending-attacks";
import { getTargetingHighlights } from "@/lib/combat/targeting";
import type { DerivedAttack } from "@/lib/dnd/attacks";
import {
  submitCombatOpportunityAttack,
} from "@/lib/combat/attack-actions";
import {
  skipCombatOpportunityAttack,
} from "@/lib/combat/opportunity-attack-actions";
import {
  canSkipOpportunityAttackAction,
  findUserOpportunityAttackAttackerToken,
  hasPendingOpportunityAttacks,
  hasSubmittedOpportunityAttack,
  isAttackerPendingOpportunityAttack,
} from "@/lib/combat/opportunity-attacks";
import {
  getAdjacentAllyTokens,
  getOpportunityAttackAttackerIds,
  getOpportunityAttackReactors,
} from "@/lib/combat/engagement";
import { endCombatTurn } from "@/lib/combat/turn-actions";
import {
  canUserControlTurn,
  canUserEndTurn,
  getCurrentTurnToken,
  getCurrentTurnTokenId,
  getNextTurnToken,
  isBattleActive,
} from "@/lib/combat/turn";
import { useCombatCatalog } from "@/lib/combat/use-combat-catalog";
import {
  computeReachableDestinations,
  findDestinationAtCell,
  getDashPreviewRemainingFeet,
  getRemainingMovementFeet,
  getTokenSpeedFt,
  type ReachableDestination,
} from "@/lib/combat/movement";
import { commitCombatMove } from "@/lib/combat/movement-actions";

interface CombatBoardProps {
  campaignId: string;
  initialCombatState: CombatState;
  characters: ParsedCharacter[];
  enemies: EnemyRecord[];
  isDm: boolean;
  userId: string | null;
}

function tokenColorClass(kind: CombatToken["kind"]): string {
  if (kind === "party") return "combat-token-party";
  if (kind === "ally") return "combat-token-ally";
  return "combat-token-enemy";
}

function resolveTokenPortraitUrl(
  supabase: ReturnType<typeof createClient>,
  token: CombatToken
): string | null {
  if (!token.portraitPath) return null;
  if (token.kind === "party" && token.characterId) {
    return getCharacterPortraitUrl(supabase, token.portraitPath);
  }
  return resolveCombatImageUrl(supabase, token.portraitPath);
}

type GridContentBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function getGridContentBox(gridEl: HTMLElement, rect: DOMRect): GridContentBox {
  const style = getComputedStyle(gridEl);
  const borderLeft = parseFloat(style.borderLeftWidth) || 0;
  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const borderRight = parseFloat(style.borderRightWidth) || 0;
  const borderBottom = parseFloat(style.borderBottomWidth) || 0;

  return {
    left: rect.left + borderLeft,
    top: rect.top + borderTop,
    width: rect.width - borderLeft - borderRight,
    height: rect.height - borderTop - borderBottom,
  };
}

function clampTokenPosition(
  token: CombatToken,
  cellX: number,
  cellY: number,
  state: CombatState
) {
  const maxX = Math.max(0, state.gridWidth - token.width);
  const maxY = Math.max(0, state.gridHeight - token.height);
  return {
    x: Math.min(Math.max(0, cellX), maxX),
    y: Math.min(Math.max(0, cellY), maxY),
  };
}

function isInsideContent(clientX: number, clientY: number, content: GridContentBox) {
  return (
    clientX >= content.left &&
    clientX <= content.left + content.width &&
    clientY >= content.top &&
    clientY <= content.top + content.height
  );
}

function positionFromPointer(
  token: CombatToken,
  clientX: number,
  clientY: number,
  gridEl: HTMLElement,
  state: CombatState
) {
  const rect = gridEl.getBoundingClientRect();
  const content = getGridContentBox(gridEl, rect);

  if (!isInsideContent(clientX, clientY, content)) {
    return null;
  }

  const cellX = Math.floor(((clientX - content.left) / content.width) * state.gridWidth);
  const cellY = Math.floor(((clientY - content.top) / content.height) * state.gridHeight);

  return clampTokenPosition(token, cellX, cellY, state);
}

function gridCellFromPointer(
  clientX: number,
  clientY: number,
  gridEl: HTMLElement,
  state: CombatState
): { x: number; y: number } | null {
  const rect = gridEl.getBoundingClientRect();
  const content = getGridContentBox(gridEl, rect);

  if (!isInsideContent(clientX, clientY, content)) {
    return null;
  }

  const x = Math.floor(
    ((clientX - content.left) / content.width) * state.gridWidth
  );
  const y = Math.floor(
    ((clientY - content.top) / content.height) * state.gridHeight
  );

  if (x < 0 || y < 0 || x >= state.gridWidth || y >= state.gridHeight) {
    return null;
  }

  return { x, y };
}

function findTokenAtPointer(
  clientX: number,
  clientY: number,
  gridEl: HTMLElement,
  state: CombatState
): CombatToken | null {
  const rect = gridEl.getBoundingClientRect();
  const content = getGridContentBox(gridEl, rect);

  if (!isInsideContent(clientX, clientY, content)) {
    return null;
  }

  const cellX = Math.floor(
    ((clientX - content.left) / content.width) * state.gridWidth
  );
  const cellY = Math.floor(
    ((clientY - content.top) / content.height) * state.gridHeight
  );

  const matches = state.tokens.filter(
    (token) =>
      cellX >= token.x &&
      cellX < token.x + token.width &&
      cellY >= token.y &&
      cellY < token.y + token.height
  );

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  let best = matches[0];
  let bestDistance = Infinity;

  for (const token of matches) {
    const centerX =
      content.left + ((token.x + token.width / 2) / state.gridWidth) * content.width;
    const centerY =
      content.top + ((token.y + token.height / 2) / state.gridHeight) * content.height;
    const distance = (clientX - centerX) ** 2 + (clientY - centerY) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = token;
    }
  }

  return best;
}

const DRAG_THRESHOLD_PX = 4;

export function CombatBoard({
  campaignId,
  initialCombatState,
  characters,
  enemies,
  isDm,
  userId,
}: CombatBoardProps) {
  const enemiesBySlug = useMemo(
    () => Object.fromEntries(enemies.map((enemy) => [enemy.slug, enemy])),
    [enemies]
  );

  const [localCharacters, setLocalCharacters] = useState(characters);
  const charactersById = useMemo(
    () => Object.fromEntries(localCharacters.map((character) => [character.id, character])),
    [localCharacters]
  );

  useEffect(() => {
    setLocalCharacters(characters);
  }, [campaignId]);

  const liveState = useRealtimeCombatState(campaignId, initialCombatState);
  const [draft, setDraft] = useState(liveState);
  const [addOpen, setAddOpen] = useState(false);
  const [addPartyOpen, setAddPartyOpen] = useState(false);
  const [startingInitiative, setStartingInitiative] = useState(false);
  const [endingTurn, setEndingTurn] = useState(false);
  const [attackTargeting, setAttackTargeting] = useState<{
    option: CombatOption;
    attack: DerivedAttack;
  } | null>(null);
  const [attackSubmitDraft, setAttackSubmitDraft] = useState<{
    option: CombatOption;
    attack: DerivedAttack;
    targets: CombatToken[];
    aoeCenter: { x: number; y: number } | null;
    isOpportunityAttack?: boolean;
    attackerToken?: CombatToken;
  } | null>(null);
  const [hoveredTargetingCell, setHoveredTargetingCell] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [submittingAttack, setSubmittingAttack] = useState(false);
  const [submittingSaveId, setSubmittingSaveId] = useState<string | null>(null);
  const [resolvingAttackId, setResolvingAttackId] = useState<string | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);
  const [movementMode, setMovementMode] = useState(false);
  const [hoveredMovementCell, setHoveredMovementCell] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pendingDashDestination, setPendingDashDestination] =
    useState<ReachableDestination | null>(null);
  const [pendingDashActionConfirm, setPendingDashActionConfirm] = useState(false);
  const [pendingRollOption, setPendingRollOption] = useState<CombatOption | null>(null);
  const [pendingOpportunityAttackMove, setPendingOpportunityAttackMove] = useState<{
    destination: ReachableDestination;
    dashConsumed: boolean;
    reactorLabels: string[];
    opportunityAttackerTokenIds?: string[];
  } | null>(null);
  const [skippingOpportunityAttack, setSkippingOpportunityAttack] = useState(false);
  const [userOaLocked, setUserOaLocked] = useState(false);
  const prevUserOaSubmittedPendingRef = useRef(false);
  const autoResolvingAttackIdsRef = useRef<Set<string>>(new Set());
  const [helpTargetPickerAllies, setHelpTargetPickerAllies] = useState<
    CombatToken[] | null
  >(null);
  const [hpAdjustTokenId, setHpAdjustTokenId] = useState<string | null>(null);
  const [hpAdjustLiveHp, setHpAdjustLiveHp] = useState<{
    currentHp: number;
    maxHp: number;
  } | null>(null);
  const [submittingHpAdjust, setSubmittingHpAdjust] = useState(false);
  const [hpOverlayVersion, setHpOverlayVersion] = useState(0);
  const [endTurnConfirmOpen, setEndTurnConfirmOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const draggingTokenIdRef = useRef<string | null>(null);
  const combatStateRef = useRef<CombatState>(initialCombatState);
  const attackTargetingRef = useRef(attackTargeting);
  attackTargetingRef.current = attackTargeting;
  const supabase = useMemo(() => createClient(), []);

  const tokenHpOverlaysRef = useRef<Map<string, TokenHpOverlay>>(new Map());
  const awaitingPersistFingerprintRef = useRef<string | null>(null);
  const lastLocalCombatWriteAtRef = useRef(0);
  const hpAdjustTokenIdRef = useRef<string | null>(null);
  hpAdjustTokenIdRef.current = hpAdjustTokenId;

  const combatState = useMemo(() => {
    void hpOverlayVersion;
    const base = isDm ? draft : liveState;
    return applyTokenHpOverlays(base, tokenHpOverlaysRef.current);
  }, [draft, hpOverlayVersion, isDm, liveState]);

  combatStateRef.current = combatState;

  const backgroundUrl = useMemo(
    () => resolveCombatImageUrl(supabase, combatState.backgroundPath),
    [combatState.backgroundPath, supabase]
  );

  const bumpHpOverlay = useCallback(() => {
    setHpOverlayVersion((version) => version + 1);
  }, []);

  const characterRosterKey = useMemo(
    () =>
      localCharacters
        .map((character) => character.id)
        .sort()
        .join(","),
    [localCharacters]
  );

  const persist = useCallback(
    async (next: CombatState) => {
      if (!isDm) return;
      lastLocalCombatWriteAtRef.current = Date.now();
      awaitingPersistFingerprintRef.current = combatTokenHpFingerprint(next);
      setDraft(next);
      const error = await persistCombatState(campaignId, next);
      if (error) {
        awaitingPersistFingerprintRef.current = null;
      }
    },
    [campaignId, isDm]
  );

  const persistRef = useRef(persist);
  persistRef.current = persist;

  const clearTokenHover = useCallback(() => {
    setHoveredTokenId(null);
  }, []);

  const updateHoverFromPointer = useCallback((clientX: number, clientY: number) => {
    if (draggingTokenIdRef.current) return;

    const grid = gridRef.current;
    if (!grid) return;

    const token = findTokenAtPointer(
      clientX,
      clientY,
      grid,
      combatStateRef.current
    );
    setHoveredTokenId(token?.id ?? null);
  }, []);

  function shouldPreserveCombatTokenHpOverlay(): boolean {
    return (
      tokenHpOverlaysRef.current.size > 0 ||
      hpAdjustTokenIdRef.current != null ||
      awaitingPersistFingerprintRef.current != null ||
      Date.now() - lastLocalCombatWriteAtRef.current < 5000
    );
  }

  useEffect(() => {
    if (!isDm) return;
    if (draggingTokenIdRef.current) return;

    if (reconcileTokenHpOverlays(liveState, tokenHpOverlaysRef.current)) {
      bumpHpOverlay();
    }

    const awaited = awaitingPersistFingerprintRef.current;
    if (awaited && combatTokenHpFingerprint(liveState) === awaited) {
      awaitingPersistFingerprintRef.current = null;
    }

    setDraft((prev) => {
      if (combatTokenHpFingerprint(liveState) === combatTokenHpFingerprint(prev)) {
        return prev;
      }

      const localSource = applyTokenHpOverlays(prev, tokenHpOverlaysRef.current);

      if (shouldPreserveCombatTokenHpOverlay()) {
        return mergeLiveStatePreservingTokenHp(localSource, liveState);
      }

      return liveState;
    });
  }, [bumpHpOverlay, isDm, liveState]);

  useEffect(() => {
    if (!isDm) return;
    setDraft((prev) => syncPartyTokens(prev, localCharacters));
    // Only re-sync party token metadata when roster membership changes, not on HP edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- localCharacters read at roster change time
  }, [characterRosterKey, isDm]);

  const beginTokenDrag = useCallback(
    (tokenId: string, pointerId: number, clientX: number, clientY: number) => {
      const state = combatStateRef.current;
      const token = state.tokens.find((entry) => entry.id === tokenId);
      const grid = gridRef.current;
      if (!token || !grid) return;
      const dragGrid: HTMLDivElement = grid;

      clearTokenHover();

      const startPosition = { x: token.x, y: token.y };
      let lastPosition = startPosition;

      draggingTokenIdRef.current = tokenId;
      setDraggingTokenId(tokenId);
      setSelectedTokenId(tokenId);
      dragGrid.setPointerCapture(pointerId);

      function applyPointer(clientX: number, clientY: number) {
        const currentState = combatStateRef.current;
        const activeToken = currentState.tokens.find((entry) => entry.id === tokenId);
        const activeGrid = gridRef.current;
        if (!activeToken || !activeGrid) return null;

        const position = positionFromPointer(
          activeToken,
          clientX,
          clientY,
          activeGrid,
          currentState
        );
        if (!position) return null;

        lastPosition = position;
        setDraft((prev) => updateTokenInState(prev, tokenId, position));
        return position;
      }

      applyPointer(clientX, clientY);

      function handlePointerMove(event: PointerEvent) {
        if (event.pointerId !== pointerId) return;
        applyPointer(event.clientX, event.clientY);
      }

      function finishDrag(event: PointerEvent) {
        if (event.pointerId !== pointerId) return;

        dragGrid.removeEventListener("pointermove", handlePointerMove);
        dragGrid.removeEventListener("pointerup", finishDrag);
        dragGrid.removeEventListener("pointercancel", finishDrag);

        if (dragGrid.hasPointerCapture(pointerId)) {
          dragGrid.releasePointerCapture(pointerId);
        }

        draggingTokenIdRef.current = null;
        setDraggingTokenId(null);

        applyPointer(event.clientX, event.clientY);
        setDraft((prev) => {
          const next = updateTokenInState(prev, tokenId, lastPosition);
          void persistRef.current(next);
          return next;
        });
      }

      dragGrid.addEventListener("pointermove", handlePointerMove);
      dragGrid.addEventListener("pointerup", finishDrag);
      dragGrid.addEventListener("pointercancel", finishDrag);
    },
    [clearTokenHover]
  );

  const handleTokenPointerDown = useCallback(
    (tokenId: string, event: React.PointerEvent<HTMLDivElement>) => {
      if (isBattleActive(combatStateRef.current)) return;
      if (!isDm) return;
      event.preventDefault();
      event.stopPropagation();
      setSelectedTokenId(tokenId);

      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      let dragStarted = false;

      function cleanup() {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
      }

      function handlePointerMove(moveEvent: PointerEvent) {
        if (moveEvent.pointerId !== pointerId || dragStarted) return;

        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

        dragStarted = true;
        cleanup();
        beginTokenDrag(tokenId, pointerId, moveEvent.clientX, moveEvent.clientY);
      }

      function handlePointerUp(upEvent: PointerEvent) {
        if (upEvent.pointerId !== pointerId) return;
        cleanup();
      }

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [beginTokenDrag, isDm]
  );

  const presentCharacterIds = useMemo(
    () =>
      new Set(
        combatState.tokens
          .filter((token) => token.kind === "party" && token.characterId)
          .map((token) => token.characterId!)
      ),
    [combatState.tokens]
  );

  const initiativeTokens = useMemo(() => {
    if (combatState.initiative.status !== "ready") return [];
    const tokensById = new Map(combatState.tokens.map((token) => [token.id, token]));
    return combatState.initiative.order
      .map((tokenId) => tokensById.get(tokenId))
      .filter((token): token is CombatToken => token != null);
  }, [combatState.initiative.order, combatState.initiative.status, combatState.tokens]);

  const selectedToken = selectedTokenId
    ? combatState.tokens.find((token) => token.id === selectedTokenId) ?? null
    : null;

  const hpAdjustToken = hpAdjustTokenId
    ? combatState.tokens.find((token) => token.id === hpAdjustTokenId) ?? null
    : null;

  function openHpAdjustForToken(tokenId: string) {
    const token = combatStateRef.current.tokens.find((entry) => entry.id === tokenId);
    if (!token) return;
    const character = token.characterId ? charactersById[token.characterId] ?? null : null;
    const enemyData = token.enemySlug ? enemiesBySlug[token.enemySlug]?.data ?? null : null;
    const display = getTokenHpDisplay(token, character, enemyData);
    setHpAdjustTokenId(tokenId);
    setHpAdjustLiveHp({ currentHp: display.currentHp, maxHp: display.maxHp });
  }

  const canStartInitiative =
    isDm &&
    combatState.initiative.status === "none" &&
    combatState.tokens.length > 0 &&
    !startingInitiative;

  const battleActive = isBattleActive(combatState);
  const currentTurnTokenId = getCurrentTurnTokenId(combatState);
  const currentTurnToken = getCurrentTurnToken(combatState);
  const nextTurnToken = getNextTurnToken(combatState);
  const nextTurnLabel = nextTurnToken?.label ?? "Unknown";
  const currentTurnCharacter = currentTurnToken?.characterId
    ? charactersById[currentTurnToken.characterId] ?? null
    : null;
  const currentTurnEnemy =
    currentTurnToken?.enemySlug ? enemiesBySlug[currentTurnToken.enemySlug] ?? null : null;

  const { catalogItems, classCatalog, featureCatalogs } = useCombatCatalog(characters);

  const currentSpeedFt = currentTurnToken
    ? getTokenSpeedFt(currentTurnToken, currentTurnCharacter, currentTurnEnemy?.data ?? null)
    : 0;
  const movementUsedFeet = combatState.turn.movementUsedFeet;
  const dashUsed = combatState.turn.dashUsed;
  const actionUsedForTwoWeapon = combatState.turn.actionUsedForTwoWeapon;
  const actionUsed = combatState.turn.actionUsed;
  const bonusActionUsed = combatState.turn.bonusActionUsed;
  const disengageUsed = combatState.turn.disengageUsed;
  const pendingAttacks = combatState.pendingAttacks;
  const dmApprovalTrayAttacks = useMemo(
    () => getDmApprovalTrayAttacks(pendingAttacks),
    [pendingAttacks]
  );
  const currentTurnPendingAttack = currentTurnTokenId
    ? getPendingAttackForAttacker(combatState, currentTurnTokenId)
    : null;
  const pendingOpportunityAttacks = combatState.pendingOpportunityAttacks;
  const opportunityAttacksPending = hasPendingOpportunityAttacks(combatState);
  const remainingMovementFeet = getRemainingMovementFeet(
    currentSpeedFt,
    movementUsedFeet,
    dashUsed
  );
  const canUseDash = !dashUsed && !actionUsed;
  const showMovePanel = remainingMovementFeet > 0 || canUseDash;
  const dashPreviewFeet = getDashPreviewRemainingFeet(
    currentSpeedFt,
    movementUsedFeet,
    dashUsed,
    actionUsed
  );

  const currentTurnOptionGroups = useMemo(() => {
    if (!currentTurnToken) {
      return { actions: [], bonusActions: [] };
    }
    return getCombatOptionGroupsForToken(currentTurnToken, {
      character: currentTurnCharacter,
      enemyData: currentTurnEnemy?.data ?? null,
      catalogItems,
      classCatalog,
      featureCatalogs,
      actionUsedForTwoWeapon,
      actionUsed,
      bonusActionUsed,
      dashUsed,
      combatState,
      token: currentTurnToken,
    });
  }, [
    actionUsed,
    actionUsedForTwoWeapon,
    bonusActionUsed,
    catalogItems,
    classCatalog,
    combatState,
    currentTurnCharacter,
    currentTurnEnemy,
    currentTurnToken,
    dashUsed,
    featureCatalogs,
  ]);

  const userControlsTurn = canUserControlTurn(
    userId,
    isDm,
    combatState,
    currentTurnToken,
    currentTurnCharacter
  );
  const userCanEndTurn = canUserEndTurn(
    userId,
    isDm,
    combatState,
    currentTurnToken,
    currentTurnCharacter
  );

  const userOaAttackerToken = useMemo(
    () =>
      findUserOpportunityAttackAttackerToken(
        combatState,
        charactersById,
        userId,
        isDm
      ),
    [charactersById, combatState, isDm, userId]
  );

  const userOaSubmittedPending = useMemo(
    () =>
      userOaAttackerToken != null &&
      hasSubmittedOpportunityAttack(combatState, userOaAttackerToken.id),
    [combatState, userOaAttackerToken]
  );

  const userOaBusy = useMemo(
    () =>
      userOaLocked ||
      userOaSubmittedPending ||
      !!attackSubmitDraft?.isOpportunityAttack ||
      skippingOpportunityAttack ||
      submittingAttack,
    [
      attackSubmitDraft,
      skippingOpportunityAttack,
      submittingAttack,
      userOaLocked,
      userOaSubmittedPending,
    ]
  );

  useEffect(() => {
    if (!userOaAttackerToken) {
      setUserOaLocked(false);
      prevUserOaSubmittedPendingRef.current = false;
      return;
    }

    const stillQueued = isAttackerPendingOpportunityAttack(
      combatState,
      userOaAttackerToken.id
    );

    if (
      prevUserOaSubmittedPendingRef.current &&
      !userOaSubmittedPending &&
      stillQueued
    ) {
      setUserOaLocked(false);
    }

    if (!stillQueued) {
      setUserOaLocked(false);
    } else if (userOaSubmittedPending) {
      setUserOaLocked(true);
    }

    prevUserOaSubmittedPendingRef.current = userOaSubmittedPending;
  }, [combatState, userOaAttackerToken, userOaSubmittedPending]);

  const userCanTakeOpportunityAttack = useMemo(() => {
    if (!userOaAttackerToken || !pendingOpportunityAttacks || userOaBusy) return false;
    return canSkipOpportunityAttackAction(combatState, userOaAttackerToken.id);
  }, [
    combatState,
    pendingOpportunityAttacks,
    userOaAttackerToken,
    userOaBusy,
  ]);

  const opportunityAttackOptions = useMemo(() => {
    if (!userOaAttackerToken) return [];
    const character = userOaAttackerToken.characterId
      ? charactersById[userOaAttackerToken.characterId] ?? null
      : null;
    const enemyData = userOaAttackerToken.enemySlug
      ? enemiesBySlug[userOaAttackerToken.enemySlug]?.data ?? null
      : null;
    return getOpportunityAttackOptionsForToken(userOaAttackerToken, {
      character,
      enemyData,
      catalogItems,
      classCatalog,
    });
  }, [
    catalogItems,
    charactersById,
    classCatalog,
    enemiesBySlug,
    userOaAttackerToken,
  ]);

  const provokingTokenLabel = useMemo(() => {
    const provokingId = pendingOpportunityAttacks?.provokingTokenId;
    if (!provokingId) return "An enemy";
    return combatState.tokens.find((token) => token.id === provokingId)?.label ?? "An enemy";
  }, [combatState.tokens, pendingOpportunityAttacks?.provokingTokenId]);

  const pendingOpportunityMovePreview = useMemo(() => {
    const pending = pendingOpportunityAttacks;
    if (!pending?.destination) return null;
    const token = combatState.tokens.find((entry) => entry.id === pending.provokingTokenId);
    if (!token) return null;
    return {
      token,
      x: pending.destination.x,
      y: pending.destination.y,
    };
  }, [combatState.tokens, pendingOpportunityAttacks]);

  const userOaPendingAttack = userOaAttackerToken
    ? getPendingAttackForAttacker(combatState, userOaAttackerToken.id)
    : null;
  const userOaPendingOptionId =
    userOaPendingAttack?.isOpportunityAttack ? userOaPendingAttack.optionId : null;

  const turnTokenHasPendingAction =
    currentTurnPendingAttack != null &&
    !currentTurnPendingAttack.isOpportunityAttack;
  const playerHasPendingAction = turnTokenHasPendingAction && !isDm;
  const pendingOptionId = turnTokenHasPendingAction
    ? currentTurnPendingAttack.optionId
    : null;

  const turnEndBlockedByPendingAttacks = !canAdvanceTurnWithPendingAttacks(combatState);
  const enemyTurnBlockedByOpportunityAttacks =
    opportunityAttacksPending &&
    currentTurnToken != null &&
    (currentTurnToken.kind === "enemy" || currentTurnToken.kind === "ally");

  const provokingMovePending =
    pendingOpportunityAttacks?.provokingTokenId === currentTurnToken?.id;

  async function handleEndTurn() {
    if (!userCanEndTurn || endingTurn) return;
    setEndingTurn(true);
    setMovementMode(false);
    const { next, error } = await endCombatTurn(campaignId, combatState, { isDm });
    setEndingTurn(false);
    setEndTurnConfirmOpen(false);
    if (error) {
      window.alert(error);
      return;
    }
    if (isDm) {
      setDraft(next);
    }
  }

  function clearAttackFlow() {
    setAttackTargeting(null);
    setAttackSubmitDraft(null);
    setHoveredTargetingCell(null);
  }

  async function handleSelectCombatOption(option: CombatOption) {
    if (!isImplementedCombatOption(option)) return;
    if (attackTargeting || movementMode || turnTokenHasPendingAction) return;

    if (isHelpActionOption(option)) {
      if (!currentTurnToken) return;
      const allies = getAdjacentAllyTokens(currentTurnToken, combatState).sort((a, b) =>
        a.label.localeCompare(b.label)
      );
      if (allies.length === 0) return;
      setHelpTargetPickerAllies(allies);
      return;
    }

    if (isDisengageActionOption(option)) {
      const { next, error } = await recordCombatDisengage(campaignId, combatState, {
        isDm,
      });
      if (error) {
        window.alert(error);
        return;
      }
      if (isDm) {
        setDraft(next);
      }
      return;
    }

    if (isDashActionOption(option)) {
      if (dashUsed || combatState.turn.actionUsed) return;
      setPendingDashActionConfirm(true);
      return;
    }

    if (isConfirmActionOption(option)) {
      setPendingRollOption(option);
      return;
    }

    if (isAttackTargetingOption(option) && userControlsTurn && currentTurnToken) {
      const attack = optionToAttack(option);
      if (!attack) return;
      if (
        currentTurnToken &&
        hasPendingAttackForAttacker(combatState, currentTurnToken.id)
      ) {
        window.alert("You already have an action pending.");
        return;
      }
      setMovementMode(false);
      clearAttackFlow();
      setAttackTargeting({ option, attack });
      return;
    }
  }

  const mapSelectionActive = Boolean(attackTargeting || movementMode);
  const selectedActionOptionId =
    pendingOptionId ?? attackTargeting?.option.id ?? null;
  const turnActionsLocked = mapSelectionActive || turnTokenHasPendingAction;

  const targetingHighlights = useMemo(() => {
    if (!attackTargeting || !currentTurnToken) return null;
    return getTargetingHighlights(
      currentTurnToken,
      combatState,
      attackTargeting.attack
    );
  }, [attackTargeting, combatState, currentTurnToken]);

  const hoveredTargetToken = useMemo(() => {
    if (!hoveredTokenId) return null;
    return combatState.tokens.find((token) => token.id === hoveredTokenId) ?? null;
  }, [combatState.tokens, hoveredTokenId]);

  const hoveredTargetDetail = useMemo(() => {
    if (!attackTargeting || !hoveredTargetToken) return null;

    if (!isDm && hoveredTargetToken.kind === "enemy") {
      const damageTaken = hoveredTargetToken.damageTaken ?? 0;
      return damageTaken > 0 ? `Damage taken: ${damageTaken}` : null;
    }

    if (hoveredTargetToken.kind === "party") {
      const character = hoveredTargetToken.characterId
        ? charactersById[hoveredTargetToken.characterId]
        : null;
      if (!character) return null;
      const currentHp =
        hoveredTargetToken.currentHp ?? character.data.combat.currentHp;
      const maxHp = hoveredTargetToken.maxHp ?? character.data.combat.maxHp;
      return `HP ${currentHp}/${maxHp} · AC ${character.data.combat.ac}`;
    }

    const enemy = hoveredTargetToken.enemySlug
      ? enemiesBySlug[hoveredTargetToken.enemySlug]?.data
      : null;
    if (isDm && enemy) {
      const currentHp =
        hoveredTargetToken.currentHp ?? enemy.hitPoints.average;
      const maxHp = hoveredTargetToken.maxHp ?? enemy.hitPoints.average;
      return `HP ${currentHp}/${maxHp} · AC ${enemy.armorClass.value}`;
    }

    return null;
  }, [
    attackTargeting,
    charactersById,
    enemiesBySlug,
    hoveredTargetToken,
    isDm,
  ]);

  const damageTakenByTokenId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const token of combatState.tokens) {
      map[token.id] = token.damageTaken ?? 0;
    }
    return map;
  }, [combatState.tokens]);

  function openAttackSubmit(
    targets: CombatToken[],
    aoeCenter: { x: number; y: number } | null
  ) {
    if (!attackTargeting || targets.length === 0) return;
    setAttackSubmitDraft({
      option: attackTargeting.option,
      attack: attackTargeting.attack,
      targets,
      aoeCenter,
    });
    setAttackTargeting(null);
    setHoveredTargetingCell(null);
  }

  function handleTargetingAtCell(cell: { x: number; y: number }) {
    if (!attackTargeting || !currentTurnToken || !targetingHighlights) return;

    const targets = buildTargetList(
      currentTurnToken,
      combatState,
      attackTargeting.attack,
      null,
      cell,
      charactersById,
      enemiesBySlug
    );

    if (targets.length === 0) return;

    openAttackSubmit(
      targets,
      targetingHighlights.spec.isAoe ? cell : null
    );
  }

  function handleTargetingPointerLeave() {
    clearTokenHover();
    setHoveredTargetingCell(null);
  }

  const handleTargetingAtCellRef = useRef(handleTargetingAtCell);
  handleTargetingAtCellRef.current = handleTargetingAtCell;

  function handleGridTargetingPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (!attackTargetingRef.current) return;

    const grid = gridRef.current;
    if (!grid?.contains(event.target as Node)) return;

    const target = event.target as HTMLElement;
    if (target.closest(".combat-targeting-banner")) return;

    const cell = gridCellFromPointer(
      event.clientX,
      event.clientY,
      grid,
      combatStateRef.current
    );
    if (!cell) return;

    handleTargetingAtCellRef.current(cell);
  }

  function applyCharacterHpUpdates(next: CombatState, updates?: CharacterHpUpdate[]) {
    if (!updates?.length) return;
    setLocalCharacters((current) =>
      current.map((character) => {
        const update = updates.find((entry) => entry.characterId === character.id);
        if (!update) return character;
        const token = next.tokens.find((entry) => entry.characterId === character.id);
        return {
          ...character,
          data: {
            ...character.data,
            combat: {
              ...character.data.combat,
              currentHp: token?.currentHp ?? update.currentHp,
              tempHp: update.tempHp,
            },
          },
        };
      })
    );
  }

  async function handleSubmitAttack(values: AttackSubmitValues) {
    if (!attackSubmitDraft) return;
    setSubmittingAttack(true);

    const attacker =
      attackSubmitDraft.attackerToken ??
      (attackSubmitDraft.isOpportunityAttack ? userOaAttackerToken : currentTurnToken);
    if (!attacker) {
      setSubmittingAttack(false);
      return;
    }

    const submitFn = attackSubmitDraft.isOpportunityAttack
      ? submitCombatOpportunityAttack
      : submitCombatAttack;

    const { next, error, characterUpdates } = await submitFn(campaignId, combatState, {
      userId,
      isDm,
      attacker,
      combatOption: attackSubmitDraft.option,
      attack: attackSubmitDraft.attack,
      targets: attackSubmitDraft.targets,
      aoeCenter: attackSubmitDraft.aoeCenter,
      submission: values,
      charactersById,
      enemiesBySlug,
    });
    setSubmittingAttack(false);
    if (error) {
      if (attackSubmitDraft.isOpportunityAttack) {
        setUserOaLocked(false);
      }
      window.alert(error);
      return;
    }
    if (attackSubmitDraft.isOpportunityAttack) {
      setUserOaLocked(hasPendingAttackForAttacker(next, attacker.id));
    }
    if (isDm) {
      setDraft(next);
      applyCharacterHpUpdates(next, characterUpdates);
    }
    setAttackSubmitDraft(null);
  }

  async function handleSelectOpportunityAttackOption(option: CombatOption) {
    if (!userOaAttackerToken || !pendingOpportunityAttacks || userOaBusy) return;
    const attack = optionToAttack(option);
    if (!attack) return;

    const provokingToken = combatState.tokens.find(
      (token) => token.id === pendingOpportunityAttacks.provokingTokenId
    );
    if (!provokingToken) return;

    setAttackSubmitDraft({
      option,
      attack,
      targets: [provokingToken],
      aoeCenter: null,
      isOpportunityAttack: true,
      attackerToken: userOaAttackerToken,
    });
  }

  async function handleSkipOpportunityAttack() {
    if (!userOaAttackerToken || userOaBusy) return;
    setSkippingOpportunityAttack(true);
    setUserOaLocked(true);
    const { next, error } = await skipCombatOpportunityAttack(campaignId, combatState, {
      isDm,
      attackerTokenId: userOaAttackerToken.id,
    });
    setSkippingOpportunityAttack(false);
    if (error) {
      setUserOaLocked(false);
      window.alert(error);
      return;
    }
    if (isDm) {
      setDraft(next);
    }
  }

  async function handleSubmitPlayerSave(saveRoll: number, saveTotal: number) {
    if (!playerSaveContext) return;
    setSubmittingSaveId(playerSaveContext.pending.id);
    const { next, error, characterUpdates } = await submitCombatSaveRoll(campaignId, combatState, {
      isDm,
      pendingAttackId: playerSaveContext.pending.id,
      tokenId: playerSaveContext.target.tokenId,
      saveRoll,
      saveTotal,
      charactersById,
    });
    setSubmittingSaveId(null);
    if (error) {
      window.alert(error);
      return;
    }
    if (isDm) {
      setDraft(next);
      applyCharacterHpUpdates(next, characterUpdates);
    }
  }

  async function handleSubmitDmSaves(
    pendingAttackId: string,
    saves: Array<{ tokenId: string; saveRoll: number; saveTotal: number }>
  ) {
    setSubmittingSaveId(pendingAttackId);
    const { next, error, characterUpdates } = await submitCombatDmSaveRolls(
      campaignId,
      combatState,
      pendingAttackId,
      saves,
      charactersById,
      isDm
    );
    setSubmittingSaveId(null);
    if (error) {
      window.alert(error);
      return;
    }
    if (isDm) {
      setDraft(next);
      applyCharacterHpUpdates(next, characterUpdates);
    }
  }

  async function handleResolveAttack(reviewed: (typeof pendingAttacks)[number]) {
    setResolvingAttackId(reviewed.id);
    const { next, error, characterUpdates } = await resolveCombatAttack(
      campaignId,
      combatState,
      reviewed,
      charactersById,
      isDm
    );
    setResolvingAttackId(null);
    if (error) {
      window.alert(error);
      return;
    }
    if (isDm) {
      setDraft(next);
      applyCharacterHpUpdates(next, characterUpdates);
    }
  }

  async function handleRejectAttack(pendingAttackId: string) {
    const { next, error } = await cancelCombatAttack(
      campaignId,
      combatState,
      pendingAttackId,
      isDm
    );
    if (error) {
      window.alert(error);
      return;
    }
    if (isDm) {
      setDraft(next);
    }
  }

  const playerSaveContext = useMemo(() => {
    if (!userId) return null;
    return findPlayerSaveContext(
      pendingAttacks,
      combatState.tokens,
      charactersById,
      userId
    );
  }, [pendingAttacks, combatState.tokens, charactersById, userId]);

  useEffect(() => {
    if (!isDm) return;

    for (const pending of combatState.pendingAttacks) {
      if (!pending.skipDmReview || pending.status !== "awaiting-dm-review") continue;
      if (autoResolvingAttackIdsRef.current.has(pending.id)) continue;
      if (resolvingAttackId === pending.id) continue;

      autoResolvingAttackIdsRef.current.add(pending.id);
      void resolveCombatAttack(campaignId, combatState, pending, charactersById, isDm)
        .then(({ next, error, characterUpdates }) => {
          if (error) {
            window.alert(error);
            return;
          }
          setDraft(next);
          applyCharacterHpUpdates(next, characterUpdates);
        })
        .finally(() => {
          autoResolvingAttackIdsRef.current.delete(pending.id);
        });
    }
  }, [
    campaignId,
    charactersById,
    combatState,
    isDm,
    resolvingAttackId,
  ]);

  function handleToggleMovementMode() {
    if (
      attackTargeting ||
      turnTokenHasPendingAction ||
      provokingMovePending ||
      pendingOpportunityAttackMove
    ) {
      return;
    }
    setMovementMode((value) => !value);
    setHoveredMovementCell(null);
  }

  const movementDestinations = useMemo(() => {
    if (!currentTurnToken || !movementMode || !userControlsTurn) return [];
    return computeReachableDestinations(currentTurnToken, combatState, {
      speedFt: currentSpeedFt,
      usedFeet: movementUsedFeet,
      dashUsed,
      actionUsed,
    });
  }, [
    combatState,
    currentSpeedFt,
    currentTurnToken,
    dashUsed,
    actionUsed,
    movementMode,
    movementUsedFeet,
    userControlsTurn,
  ]);

  useEffect(() => {
    if (!showMovePanel) {
      setMovementMode(false);
    }
  }, [showMovePanel]);

  useEffect(() => {
    if (!turnTokenHasPendingAction) return;
    setMovementMode(false);
    clearAttackFlow();
  }, [turnTokenHasPendingAction]);

  useEffect(() => {
    if (!provokingMovePending && !pendingOpportunityAttackMove) return;
    setMovementMode(false);
    setHoveredMovementCell(null);
  }, [pendingOpportunityAttackMove, provokingMovePending]);

  useEffect(() => {
    setMovementMode(false);
    setHoveredMovementCell(null);
    setPendingDashDestination(null);
    setPendingDashActionConfirm(false);
    setPendingRollOption(null);
    setPendingOpportunityAttackMove(null);
    setHelpTargetPickerAllies(null);
    setEndTurnConfirmOpen(false);
    clearAttackFlow();
  }, [currentTurnTokenId, userControlsTurn]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        clearAttackFlow();
        setHpAdjustTokenId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function tryCommitMovement(
    destination: ReachableDestination,
    dashConsumed: boolean
  ) {
    if (!currentTurnToken || !userControlsTurn || provokingMovePending) return;
    if (dashConsumed && (dashUsed || actionUsed)) return;

    const opportunityAttackReactors = getOpportunityAttackReactors(
      currentTurnToken,
      destination,
      combatState,
      disengageUsed
    );

    if (opportunityAttackReactors.length > 0) {
      const opportunityAttackerTokenIds = getOpportunityAttackAttackerIds(
        currentTurnToken,
        opportunityAttackReactors
      );
      if (opportunityAttackerTokenIds.length === 0) {
        await commitMovementToDestination(destination, dashConsumed);
        return;
      }
      setMovementMode(false);
      setHoveredMovementCell(null);
      setPendingOpportunityAttackMove({
        destination,
        dashConsumed,
        reactorLabels: opportunityAttackReactors.map((reactor) => reactor.label),
        opportunityAttackerTokenIds,
      });
      return;
    }

    await commitMovementToDestination(destination, dashConsumed);
  }

  async function commitMovementToDestination(
    destination: ReachableDestination,
    dashConsumed: boolean,
    opportunityAttackerTokenIds?: string[]
  ) {
    if (!currentTurnToken || !userControlsTurn) return;

    const { next, error } = await commitCombatMove(campaignId, combatState, {
      isDm,
      tokenId: currentTurnToken.id,
      x: destination.x,
      y: destination.y,
      costFeet: destination.costFeet,
      dashConsumed,
      opportunityAttackerTokenIds,
    });

    if (error) {
      window.alert(error);
      return;
    }

    if (isDm) {
      setDraft(next);
    }
  }

  async function handleMovementCellClick(cellX: number, cellY: number) {
    if (!currentTurnToken || !userControlsTurn || !movementMode) return;

    const destination = findDestinationAtCell(
      movementDestinations,
      currentTurnToken,
      cellX,
      cellY
    );
    if (!destination) return;

    if (destination.zone === "dash" && !dashUsed && !actionUsed) {
      setPendingDashDestination(destination);
      return;
    }

    await tryCommitMovement(destination, false);
  }

  async function handleConfirmDashMove() {
    if (!pendingDashDestination || dashUsed || actionUsed) return;
    const destination = pendingDashDestination;
    setPendingDashDestination(null);
    await tryCommitMovement(destination, true);
  }

  async function handleConfirmDashAction() {
    setPendingDashActionConfirm(false);
    const { next, error } = await recordCombatDash(campaignId, combatState, { isDm });
    if (error) {
      window.alert(error);
      return;
    }
    if (isDm) {
      setDraft(next);
    }
    setMovementMode(true);
    clearAttackFlow();
  }

  async function handleUseStandardAction() {
    if (!pendingRollOption) return;
    const { next, error } = await recordCombatActionUsed(campaignId, combatState, {
      isDm,
    });
    setPendingRollOption(null);
    if (error) {
      window.alert(error);
      return;
    }
    if (isDm) {
      setDraft(next);
    }
  }

  async function handleConfirmOpportunityAttackMove() {
    if (!pendingOpportunityAttackMove) return;
    const { destination, dashConsumed, opportunityAttackerTokenIds } =
      pendingOpportunityAttackMove;
    setPendingOpportunityAttackMove(null);
    await commitMovementToDestination(
      destination,
      dashConsumed,
      opportunityAttackerTokenIds
    );
  }

  async function handleApplyHpAdjust(delta: number) {
    if (!hpAdjustTokenId || delta === 0) return;

    const previousState = combatStateRef.current;
    const token = previousState.tokens.find((entry) => entry.id === hpAdjustTokenId);
    if (!token) return;

    const character = token.characterId ? charactersById[token.characterId] ?? null : null;
    const enemyData = token.enemySlug ? enemiesBySlug[token.enemySlug]?.data ?? null : null;
    const { currentHp, maxHp } = getTokenHpDisplay(token, character, enemyData);
    const nextHp = applyHpDelta(currentHp, maxHp, delta);
    const damageDelta = delta < 0 ? -delta : 0;
    const previousLocalCharacters =
      token.kind === "party" && character ? localCharacters : null;

    const adjustingToken = token;

    const next = updateTokenInState(previousState, adjustingToken.id, {
      currentHp: nextHp,
      maxHp,
      damageTaken: (adjustingToken.damageTaken ?? 0) + damageDelta,
    });

    function rollback() {
      awaitingPersistFingerprintRef.current = null;
      tokenHpOverlaysRef.current.delete(adjustingToken.id);
      bumpHpOverlay();
      setDraft(previousState);
      combatStateRef.current = previousState;
      if (previousLocalCharacters) {
        setLocalCharacters(previousLocalCharacters);
      }
      const rollbackCharacter = adjustingToken.characterId
        ? previousLocalCharacters?.find((entry) => entry.id === adjustingToken.characterId) ??
          charactersById[adjustingToken.characterId] ??
          null
        : null;
      setHpAdjustLiveHp(
        getTokenHpDisplay(adjustingToken, rollbackCharacter, enemyData)
      );
    }

    const nextDamageTaken = (adjustingToken.damageTaken ?? 0) + damageDelta;

    // Optimistic UI — update board + modal immediately, persist in background.
    lastLocalCombatWriteAtRef.current = Date.now();
    awaitingPersistFingerprintRef.current = combatTokenHpFingerprint(next);
    tokenHpOverlaysRef.current.set(adjustingToken.id, {
      currentHp: nextHp,
      maxHp,
      damageTaken: nextDamageTaken,
    });
    bumpHpOverlay();
    setHpAdjustLiveHp({ currentHp: nextHp, maxHp });
    setDraft(next);
    combatStateRef.current = next;

    if (token.kind === "party" && character) {
      const nextCombat = {
        ...character.data.combat,
        currentHp: nextHp,
      };
      setLocalCharacters((current) =>
        current.map((entry) =>
          entry.id === character.id
            ? {
                ...entry,
                data: {
                  ...entry.data,
                  combat: nextCombat,
                },
              }
            : entry
        )
      );
    }

    setSubmittingHpAdjust(true);

    if (token.kind === "party" && character) {
      const nextCombat = {
        ...character.data.combat,
        currentHp: nextHp,
      };
      const error = await saveCharacterData(
        character.id,
        { ...character.data, combat: nextCombat },
        undefined,
        { isDm: true, originalData: character.data }
      );
      if (error) {
        setSubmittingHpAdjust(false);
        rollback();
        window.alert(error);
        return;
      }
    }

    const persistError = await persistCombatState(campaignId, next);
    setSubmittingHpAdjust(false);

    if (persistError) {
      rollback();
      window.alert(persistError);
    }
  }

  function handleTokenClick(tokenId: string, event: React.MouseEvent) {
    if (!isDm || !battleActive || attackTargeting || movementMode || draggingTokenId) return;
    event.stopPropagation();
    openHpAdjustForToken(tokenId);
  }

  function handleCloseHpAdjust() {
    setHpAdjustTokenId(null);
    setHpAdjustLiveHp(null);
  }

  async function handleAddEnemy(enemy: EnemyRecord) {
    const next = addEnemyToState(combatState, enemy);
    await persist(next);
    setAddOpen(false);
  }

  async function handleAddPartyMembers(selected: ParsedCharacter[]) {
    const next = addPartyMembersToState(combatState, selected);
    await persist(next);
  }

  async function handleRemoveSelected() {
    if (!selectedToken) return;
    const label = selectedToken.label;
    if (!window.confirm(`Remove ${label} from the board?`)) return;
    const next = removeTokenFromState(combatState, selectedToken.id);
    await persist(next);
    setSelectedTokenId(null);
  }

  async function handleResetBoard() {
    if (
      !window.confirm(
        "Reset the combat board?\n\nAll enemies will be removed, initiative will clear, and every party member will return to default starting positions."
      )
    ) {
      return;
    }

    await clearCampaignInitiativeRolls(
      campaignId,
      characters.map((character) => character.id)
    );
    const next = resetCombatBoard(combatState, characters);
    await persist(next);
    setSelectedTokenId(null);
  }

  async function handleStartInitiative() {
    if (combatState.initiative.status !== "none") return;
    if (combatState.tokens.length === 0) {
      window.alert("Add at least one combatant before starting initiative.");
      return;
    }

    setStartingInitiative(true);

    let next = startInitiativeCollection(combatState, characters, enemiesBySlug);
    next = finalizeInitiativeIfReady(next);
    const persistError = await persistCombatState(campaignId, next);
    if (persistError) {
      setStartingInitiative(false);
      window.alert(persistError);
      return;
    }
    setDraft(next);

    if (next.initiative.status !== "collecting") {
      setStartingInitiative(false);
      return;
    }

    const claimedNeedingRolls = next.tokens
      .filter((token) => {
        if (token.kind !== "party" || !token.characterId) return false;
        if (next.initiative.results[token.id]) return false;
        const character = charactersById[token.characterId];
        return !!character?.owner_user_id;
      })
      .map((token) => charactersById[token.characterId!])
      .filter(Boolean);

    await Promise.all(
      claimedNeedingRolls.map(async (character) => {
        const modifier = getPartyInitiativeModifierForCharacter(character);
        await saveCharacterData(
          character.id,
          {
            ...character.data,
            combat: {
              ...character.data.combat,
              pendingInitiativeRoll: {
                tokenId: character.id,
                modifier,
              },
            },
          },
          undefined,
          { isDm: true, originalData: character.data }
        );
      })
    );

    setStartingInitiative(false);
  }

  async function handleBackgroundUpload(file: File) {
    const { path, error } = await uploadCombatBackground(supabase, campaignId, file);
    if (error || !path) return;

    const previousPath = combatState.backgroundPath;
    const next = { ...combatState, backgroundPath: path };
    await persist(next);

    if (previousPath && previousPath !== path) {
      await removeCombatImage(supabase, previousPath);
    }
  }

  async function handleRemoveBackground() {
    if (!combatState.backgroundPath) return;
    if (!window.confirm("Remove the combat map background?")) return;

    const previousPath = combatState.backgroundPath;
    const next = { ...combatState, backgroundPath: null };
    await persist(next);
    await removeCombatImage(supabase, previousPath);
  }

  function handleGridSettingCommit(
    field: "gridWidth" | "gridHeight" | "tileFeet",
    raw: string
  ) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;

    const next = updateGridInState(combatState, { [field]: parsed });
    if (
      next.gridWidth === combatState.gridWidth &&
      next.gridHeight === combatState.gridHeight &&
      next.tileFeet === combatState.tileFeet
    ) {
      return;
    }

    void persist(next);
  }

  function renderToken(token: CombatToken) {
    const portraitUrl = resolveTokenPortraitUrl(supabase, token);
    const isSelected = selectedTokenId === token.id;
    const enemy = token.enemySlug ? enemiesBySlug[token.enemySlug] : null;
    const character = token.characterId ? charactersById[token.characterId] : null;
    const isHovered = hoveredTokenId === token.id && !draggingTokenId;
    const speciesClassLine = character
      ? [
          speciesSubtitleLabel(character.data.basicInfo.species, PHB_SPECIES),
          character.data.basicInfo.classes.length > 0
            ? character.data.basicInfo.classes.join(" / ")
            : (character.data.basicInfo.class?.trim() ?? ""),
        ]
          .filter(Boolean)
          .join(" ")
      : "";
    const enemyDamageTaken = token.damageTaken ?? 0;
    const isExpanded =
      isHovered &&
      ((token.kind === "enemy" && (isDm ? enemy != null : true)) ||
        (token.kind === "party" && character != null));

    const isDragging = draggingTokenId === token.id;
    const isActiveTurn = battleActive && token.id === currentTurnTokenId;

    const style = {
      gridColumn: `${token.x + 1} / span ${token.width}`,
      gridRow: `${token.y + 1} / span ${token.height}`,
    };

    const isAttackTarget =
      attackTargeting &&
      targetingHighlights?.validTargets.some((target) => target.id === token.id);

    return (
      <div
        key={token.id}
        className={`combat-token combat-token-on-grid ${tokenColorClass(token.kind)}${isDm ? " combat-token-dm" : ""}${isDm && battleActive && !attackTargeting && !movementMode ? " combat-token-hp-clickable" : ""}${isSelected ? " combat-token-selected" : ""}${isExpanded ? " combat-token-expanded" : ""}${isDragging ? " combat-token-dragging" : ""}${isActiveTurn ? " combat-token-active-turn" : ""}${isAttackTarget ? " combat-token-attack-target" : ""}`}
        style={style}
        onPointerDown={(event) => handleTokenPointerDown(token.id, event)}
        onClick={(event) => handleTokenClick(token.id, event)}
      >
        <div
          className={`combat-token-badge${isExpanded ? " combat-token-badge-expanded" : ""}`}
        >
          {portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portraitUrl} alt="" className="combat-token-portrait" draggable={false} />
          ) : (
            <div className="combat-token-portrait combat-token-portrait-fallback">
              {token.label.slice(0, 1)}
            </div>
          )}
          <div
            className={`combat-token-label${isExpanded ? " combat-token-label-expanded" : ""}`}
          >
            <span className="combat-token-label-name">{token.label}</span>
            {isExpanded ? (
              portraitUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={portraitUrl}
                  alt=""
                  className="combat-token-label-portrait"
                  draggable={false}
                />
              ) : (
                <div className="combat-token-label-portrait combat-token-label-portrait-fallback">
                  {token.label.slice(0, 1)}
                </div>
              )
            ) : null}
            {isExpanded && token.kind === "party" && character ? (
              <>
                {speciesClassLine ? (
                  <span className="combat-token-label-detail">{speciesClassLine}</span>
                ) : null}
                <span className="combat-token-label-detail">
                  AC {character.data.combat.ac}
                </span>
                <span className="combat-token-label-detail">
                  HP {token.currentHp ?? character.data.combat.currentHp}/
                  {token.maxHp ?? character.data.combat.maxHp}
                </span>
                <span className="combat-token-label-detail">
                  Speed {character.data.combat.speed} ft
                </span>
              </>
            ) : null}
            {isExpanded && !isDm && token.kind === "enemy" && enemyDamageTaken > 0 ? (
              <span className="combat-token-label-detail">
                Damage taken: {enemyDamageTaken}
              </span>
            ) : null}
            {isExpanded && isDm && enemy ? (
              <>
                <span className="combat-token-label-detail">
                  AC {enemy.data.armorClass.value}
                  {enemy.data.armorClass.note ? ` (${enemy.data.armorClass.note})` : ""}
                </span>
                <span className="combat-token-label-detail">
                  HP {token.currentHp ?? enemy.data.hitPoints.average}/
                  {token.maxHp ?? enemy.data.hitPoints.average}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  function renderPendingMoveGhost() {
    const preview = pendingOpportunityMovePreview;
    if (!preview) return null;
    const { token, x, y } = preview;
    const portraitUrl = resolveTokenPortraitUrl(supabase, token);

    return (
      <div
        key={`${token.id}-pending-move`}
        className={`combat-token combat-token-on-grid combat-token-pending-move ${tokenColorClass(token.kind)}`}
        style={{
          gridColumn: `${x + 1} / span ${token.width}`,
          gridRow: `${y + 1} / span ${token.height}`,
        }}
        aria-hidden
      >
        <div className="combat-token-badge">
          {portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portraitUrl} alt="" className="combat-token-portrait" draggable={false} />
          ) : (
            <div className="combat-token-portrait combat-token-portrait-fallback">
              {token.label.slice(0, 1)}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="combat-stage">
      <div className="combat-layout">
        <div
          className="combat-turn-column"
          aria-label={initiativeTokens.length > 0 ? "Initiative order" : undefined}
        >
          {battleActive ? (
            <Tooltip content={`Turn ${combatState.turn.round}`}>
              <div
                className="combat-turn-round combat-turn-portrait-wrap-tooltip"
                aria-label={`Turn ${combatState.turn.round}`}
              >
                {combatState.turn.round}
              </div>
            </Tooltip>
          ) : null}
          {initiativeTokens.map((token) => {
            const portraitUrl = resolveTokenPortraitUrl(supabase, token);
            const initiativeResult = combatState.initiative.results[token.id];
            const turnTooltip =
              isDm && initiativeResult
                ? formatInitiativeResultTooltip(token.label, initiativeResult)
                : token.label;

            const portrait = portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={portraitUrl}
                alt={token.label}
                className="combat-turn-portrait"
                draggable={false}
              />
            ) : (
              <div
                className="combat-turn-portrait combat-turn-portrait-fallback"
                aria-label={token.label}
              >
                {token.label.slice(0, 1)}
              </div>
            );

            return (
              <div
                key={token.id}
                className={`combat-turn-portrait-wrap combat-turn-portrait-wrap-tooltip combat-turn-${token.kind}${token.id === currentTurnTokenId ? " combat-turn-portrait-active" : ""}`}
              >
                <Tooltip content={turnTooltip}>{portrait}</Tooltip>
              </div>
            );
          })}
        </div>

        <div className="combat-main">
          <div className="combat-board-area">
            <div className="combat-toolbar combat-toolbar-header">
              <div className="combat-toolbar-meta">
                <h2 className="combat-title">Combat</h2>
                <p className="combat-meta">
                  {isDm ? (
                    <>
                      <input
                        type="number"
                        className="combat-meta-input"
                        min={MIN_GRID_SIZE}
                        max={MAX_GRID_SIZE}
                        key={`grid-width-${combatState.gridWidth}`}
                        defaultValue={combatState.gridWidth}
                        aria-label="Grid width in tiles"
                        onBlur={(event) =>
                          handleGridSettingCommit("gridWidth", event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                      />
                      <span className="combat-meta-sep">×</span>
                      <input
                        type="number"
                        className="combat-meta-input"
                        min={MIN_GRID_SIZE}
                        max={MAX_GRID_SIZE}
                        key={`grid-height-${combatState.gridHeight}`}
                        defaultValue={combatState.gridHeight}
                        aria-label="Grid height in tiles"
                        onBlur={(event) =>
                          handleGridSettingCommit("gridHeight", event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                      />
                      <span> tiles · </span>
                      <input
                        type="number"
                        className="combat-meta-input combat-meta-input-feet"
                        min={MIN_TILE_FEET}
                        max={MAX_TILE_FEET}
                        key={`tile-feet-${combatState.tileFeet}`}
                        defaultValue={combatState.tileFeet}
                        aria-label="Feet per tile"
                        onBlur={(event) =>
                          handleGridSettingCommit("tileFeet", event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                      />
                      <span> ft each</span>
                    </>
                  ) : (
                    <>
                      {combatState.gridWidth}×{combatState.gridHeight} tiles ·{" "}
                      {combatState.tileFeet} ft each
                    </>
                  )}
                </p>
              </div>
              {battleActive ? (
                <div className="combat-toolbar-panels">
                  {userOaSubmittedPending ? (
                    <div className="combat-turn-waiting combat-attack-waiting">
                      <p className="combat-turn-waiting-text combat-attack-waiting-text">
                        Opportunity attack pending review…
                      </p>
                    </div>
                  ) : userCanTakeOpportunityAttack ? (
                    <CombatOpportunityAttackPanel
                      provokingLabel={provokingTokenLabel}
                      options={opportunityAttackOptions}
                      onSelectOption={(option) => void handleSelectOpportunityAttackOption(option)}
                      onSkip={() => void handleSkipOpportunityAttack()}
                      selectedOptionId={selectedActionOptionId}
                      pendingOptionId={userOaPendingOptionId}
                      selectionLocked={userOaBusy}
                      skipping={skippingOpportunityAttack}
                    />
                  ) : userControlsTurn && provokingMovePending ? (
                    <div className="combat-turn-waiting combat-attack-waiting">
                      <p className="combat-turn-waiting-text combat-attack-waiting-text">
                        Waiting for opportunity attacks…
                      </p>
                    </div>
                  ) : userControlsTurn ? (
                    playerHasPendingAction ? (
                      <div className="combat-turn-waiting combat-attack-waiting">
                        <p className="combat-turn-waiting-text combat-attack-waiting-text">
                          Action pending DM review…
                        </p>
                      </div>
                    ) : enemyTurnBlockedByOpportunityAttacks ? (
                      <div className="combat-turn-waiting combat-attack-waiting">
                        <p className="combat-turn-waiting-text combat-attack-waiting-text">
                          Waiting for opportunity attacks…
                        </p>
                      </div>
                    ) : (
                      <>
                        {showMovePanel ? (
                          <CombatMovePanel
                            remainingFeet={remainingMovementFeet}
                            speedFeet={currentSpeedFt}
                            dashAvailableFeet={dashPreviewFeet}
                            dashUsed={dashUsed}
                            movementMode={movementMode}
                            disabled={
                              !!attackTargeting ||
                              turnTokenHasPendingAction ||
                              enemyTurnBlockedByOpportunityAttacks ||
                              provokingMovePending ||
                              !!pendingOpportunityAttackMove
                            }
                            onToggleMovementMode={handleToggleMovementMode}
                          />
                        ) : null}
                        {currentTurnOptionGroups.actions.length > 0 ? (
                          <CombatActionPanel
                            key={currentTurnTokenId ?? "no-turn"}
                            options={currentTurnOptionGroups.actions}
                            onSelectOption={handleSelectCombatOption}
                            selectedOptionId={selectedActionOptionId}
                            pendingOptionId={pendingOptionId}
                            selectionLocked={turnActionsLocked}
                          />
                        ) : null}
                        {currentTurnOptionGroups.bonusActions.length > 0 ? (
                          <CombatBonusActionPanel
                            options={currentTurnOptionGroups.bonusActions}
                            onSelectOption={handleSelectCombatOption}
                            selectedOptionId={selectedActionOptionId}
                            pendingOptionId={pendingOptionId}
                            selectionLocked={turnActionsLocked}
                          />
                        ) : null}
                        {userCanEndTurn ? (
                          <CombatEndTurnPanel
                            nextTurnLabel={nextTurnLabel}
                            onSelectEndTurn={() => setEndTurnConfirmOpen(true)}
                            endingTurn={endingTurn}
                            disabled={
                              turnActionsLocked ||
                              opportunityAttacksPending ||
                              turnEndBlockedByPendingAttacks
                            }
                          />
                        ) : null}
                      </>
                    )
                  ) : opportunityAttacksPending ? (
                    <div className="combat-turn-waiting combat-attack-waiting">
                      <p className="combat-turn-waiting-text combat-attack-waiting-text">
                        Waiting for opportunity attacks…
                      </p>
                    </div>
                  ) : (
                    <div className="combat-turn-waiting combat-attack-waiting">
                      <p className="combat-turn-waiting-text combat-attack-waiting-text">
                        Waiting for {currentTurnToken?.label ?? "the active combatant"}&apos;s
                        turn
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {isDm ? (
              <div className="combat-toolbar combat-toolbar-actions-row">
                <input
                  ref={backgroundInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void handleBackgroundUpload(file);
                  }}
                />
                <div className="combat-toolbar-actions">
                  <button
                    type="button"
                    className="candy-btn candy-btn-danger"
                    onClick={() => void handleResetBoard()}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="candy-btn candy-btn-success"
                    onClick={() => void handleStartInitiative()}
                    disabled={!canStartInitiative}
                  >
                    {startingInitiative ? "Starting…" : "Start"}
                  </button>
                  <button
                    type="button"
                    className="candy-btn"
                    onClick={() => backgroundInputRef.current?.click()}
                  >
                    Background
                  </button>
                  {combatState.backgroundPath ? (
                    <button
                      type="button"
                      className="candy-btn"
                      onClick={() => void handleRemoveBackground()}
                    >
                      Remove background
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="candy-btn"
                    onClick={() => setAddPartyOpen(true)}
                  >
                    Add party member
                  </button>
                  <button type="button" className="candy-btn" onClick={() => setAddOpen(true)}>
                    Add enemy
                  </button>
                  <button
                    type="button"
                    className="candy-btn"
                    onClick={handleRemoveSelected}
                    disabled={!selectedToken}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : null}

            <div className="combat-grid-shell">
              <div
                ref={gridRef}
                className={`combat-grid${draggingTokenId ? " combat-grid-dragging" : ""}${movementMode ? " combat-grid-movement-mode" : ""}${attackTargeting ? " combat-grid-targeting-mode" : ""}`}
                style={{
                  ["--grid-width" as string]: combatState.gridWidth,
                  ["--grid-height" as string]: combatState.gridHeight,
                }}
                onPointerMove={(event) => {
                  updateHoverFromPointer(event.clientX, event.clientY);
                }}
                onPointerUpCapture={
                  attackTargeting ? handleGridTargetingPointerUp : undefined
                }
                onPointerLeave={() => {
                  clearTokenHover();
                }}
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) {
                    clearTokenHover();
                  }
                }}
                onClick={(event) => {
                  if (!isDm) return;
                  if (event.target === event.currentTarget) {
                    setSelectedTokenId(null);
                  }
                }}
              >
                {backgroundUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={backgroundUrl}
                    alt=""
                    className="combat-grid-background"
                    draggable={false}
                  />
                ) : null}
                {combatState.tokens.map((token) => renderToken(token))}
                {renderPendingMoveGhost()}
                {attackTargeting && currentTurnToken && userControlsTurn && targetingHighlights ? (
                  <CombatTargetingOverlay
                    gridWidth={combatState.gridWidth}
                    gridHeight={combatState.gridHeight}
                    attacker={currentTurnToken}
                    attack={attackTargeting.attack}
                    state={combatState}
                    validTargets={targetingHighlights.validTargets}
                    validCells={targetingHighlights.validCells}
                    hoveredCell={hoveredTargetingCell}
                    previewCenter={null}
                    hoveredTokenLabel={hoveredTargetToken?.label ?? null}
                    hoveredTokenDetail={hoveredTargetDetail}
                    onPointerMove={updateHoverFromPointer}
                    onPointerLeave={handleTargetingPointerLeave}
                    onCellHover={setHoveredTargetingCell}
                    onCancel={clearAttackFlow}
                  />
                ) : null}
                {movementMode && currentTurnToken && userControlsTurn ? (
                  <CombatMovementOverlay
                    gridWidth={combatState.gridWidth}
                    gridHeight={combatState.gridHeight}
                    token={currentTurnToken}
                    destinations={movementDestinations}
                    hoveredCell={hoveredMovementCell}
                    remainingFeet={remainingMovementFeet}
                    speedFeet={currentSpeedFt}
                    usedFeet={movementUsedFeet}
                    dashUsed={dashUsed}
                    actionUsed={actionUsed}
                    onCellClick={(cellX, cellY) => void handleMovementCellClick(cellX, cellY)}
                    onCellHover={setHoveredMovementCell}
                  />
                ) : null}
              </div>
            </div>
            {isDm && battleActive && dmApprovalTrayAttacks.length > 0 ? (
              <CombatDmApprovalTray
                pendingAttacks={dmApprovalTrayAttacks}
                tokens={combatState.tokens}
                resolvingAttackId={resolvingAttackId}
                submittingSaveId={submittingSaveId}
                onReject={(pendingAttackId) => void handleRejectAttack(pendingAttackId)}
                onConfirm={(reviewed) => void handleResolveAttack(reviewed)}
                onSubmitDmSaves={(pendingAttackId, saves) =>
                  void handleSubmitDmSaves(pendingAttackId, saves)
                }
              />
            ) : null}
          </div>
        </div>
      </div>

      <AddEnemyDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        enemies={enemies}
        onSelect={handleAddEnemy}
      />
      <AddPartyMemberDialog
        open={addPartyOpen}
        onOpenChange={setAddPartyOpen}
        characters={characters}
        presentCharacterIds={presentCharacterIds}
        onConfirm={handleAddPartyMembers}
      />
      {hpAdjustToken && hpAdjustLiveHp ? (
        <CombatHpAdjustModal
          tokenLabel={hpAdjustToken.label}
          currentHp={hpAdjustLiveHp.currentHp}
          maxHp={hpAdjustLiveHp.maxHp}
          submitting={submittingHpAdjust}
          onCancel={handleCloseHpAdjust}
          onApply={(delta) => void handleApplyHpAdjust(delta)}
        />
      ) : null}
      {attackSubmitDraft ? (
        <CombatAttackSubmitModal
          attack={attackSubmitDraft.attack}
          optionName={attackSubmitDraft.option.name}
          targets={attackSubmitDraft.targets}
          damageTakenByTokenId={damageTakenByTokenId}
          submitting={submittingAttack}
          onCancel={() => setAttackSubmitDraft(null)}
          onSubmit={(values) => void handleSubmitAttack(values)}
        />
      ) : null}
      {playerSaveContext ? (
        <CombatSaveRollModal
          target={playerSaveContext.target}
          saveAbility={playerSaveContext.pending.saveAbility}
          saveDc={playerSaveContext.pending.saveDc}
          submitting={submittingSaveId === playerSaveContext.pending.id}
          onCancel={() => {}}
          onSubmit={(saveRoll, saveTotal) => void handleSubmitPlayerSave(saveRoll, saveTotal)}
        />
      ) : null}
      {endTurnConfirmOpen ? (
        <CombatEndTurnConfirmModal
          nextTurnLabel={nextTurnLabel}
          endingTurn={endingTurn}
          onCancel={() => setEndTurnConfirmOpen(false)}
          onConfirm={() => void handleEndTurn()}
        />
      ) : null}
      {helpTargetPickerAllies ? (
        <CombatHelpTargetModal
          allies={helpTargetPickerAllies}
          resolvePortraitUrl={(token) => resolveTokenPortraitUrl(supabase, token)}
          onSelect={() => setHelpTargetPickerAllies(null)}
          onCancel={() => setHelpTargetPickerAllies(null)}
        />
      ) : null}
      {pendingDashDestination ? (
        <CombatDashConfirmModal
          onConfirm={() => void handleConfirmDashMove()}
          onCancel={() => setPendingDashDestination(null)}
        />
      ) : null}
      {pendingDashActionConfirm ? (
        <CombatDashConfirmModal
          message="Use Dash? This will consume your action and grant extra movement equal to your speed."
          onConfirm={() => void handleConfirmDashAction()}
          onCancel={() => setPendingDashActionConfirm(false)}
        />
      ) : null}
      {pendingRollOption ? (
        <CombatRollModal
          option={pendingRollOption}
          onCancel={() => setPendingRollOption(null)}
          onUse={() => void handleUseStandardAction()}
        />
      ) : null}
      {pendingOpportunityAttackMove ? (
        <CombatOpportunityAttackModal
          reactorLabels={pendingOpportunityAttackMove.reactorLabels}
          onConfirm={() => void handleConfirmOpportunityAttackMove()}
          onCancel={() => setPendingOpportunityAttackMove(null)}
        />
      ) : null}
    </div>
  );
}
