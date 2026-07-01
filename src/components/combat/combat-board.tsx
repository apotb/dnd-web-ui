"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  addEnemyToState,
  addMarkerToState,
  addPartyMembersToState,
  removeTokenFromState,
  resetCombatBoard,
  syncPartyTokens,
  updateGridInState,
  updateTokenInState,
  tokenFootprintsOverlap,
  type EnemyRecord,
} from "@/lib/combat/state-utils";
import { clearCampaignInitiativeRolls } from "@/lib/combat/initiative-actions";
import {
  finalizeInitiativeIfReady,
  formatInitiativeResultTooltip,
  getAddedCombatantTokens,
  getPartyInitiativeModifierForCharacter,
  getTokensNeedingPlayerRolls,
  integrateNewCombatantsInitiative,
  sortInitiativeTokenIds,
  startInitiativeCollection,
  updateInitiativeAfterVisibilityChange,
} from "@/lib/combat/initiative";
import { saveCharacterData } from "@/lib/character/save-character-data";
import { calculateAcBreakdown, formatAcTooltip } from "@/lib/character/ac-derivation";
import {
  applyHpDelta,
  combatTokenHpFingerprint,
  getTokenHpDisplay,
  mergeLiveStatePreservingTokenHp,
  parsePositiveHpAmount,
  patchTokenHpFromDamage,
} from "@/lib/combat/hp-adjust";
import {
  removeCombatImage,
  resolveCombatImageUrl,
  uploadCombatBackground,
  uploadMarkerPortrait,
} from "@/lib/combat/storage";
import { getCharacterPortraitUrl } from "@/lib/character/portrait-storage";
import { preloadImageUrls } from "@/lib/image-preload";
import type { ParsedCharacter } from "@/lib/character/utils";
import {
  applyLayOnHands,
  getEffectiveMaxHp,
  type LayOnHandsMode,
} from "@/lib/dnd/mechanical-features";
import type { LayOnHandsCombatTarget } from "@/lib/combat/combat-mechanical-actions";
import { speciesSubtitleLabel } from "@/lib/content/catalog-tooltip";
import { PHB_SPECIES } from "@/lib/dnd/phb/species";
import {
  persistCombatState,
  useRealtimeCombatState,
} from "@/lib/hooks/use-realtime-combat-state";
import { useRealtimeCharacters } from "@/lib/hooks/use-realtime-characters";
import type { CombatState, CombatToken, PendingAttack } from "@/lib/schemas/combat-state";
import { DEFAULT_BOARD_TITLE, isCombatantToken, isHiddenEnemy, isTokenInTurnOrder } from "@/lib/schemas/combat-state";
import {
  MAX_GRID_SIZE,
  MAX_TILE_FEET,
  MIN_GRID_SIZE,
  MIN_TILE_FEET,
} from "@/lib/schemas/combat-grid";
import { AddEnemyDialog } from "@/components/combat/add-enemy-dialog";
import { AddPartyMemberDialog } from "@/components/combat/add-party-member-dialog";
import {
  CharacterSlotAssignModal,
  CharacterSlotClaimModal,
} from "@/components/combat/character-slot-modal";
import { EnemyTokenDialog, type EnemyTokenDialogValues } from "@/components/combat/enemy-token-dialog";
import { EncounterLoadDialog } from "@/components/combat/encounter-load-dialog";
import { EncounterNameModal } from "@/components/combat/encounter-name-modal";
import { EncounterOverwriteConfirmModal } from "@/components/combat/encounter-overwrite-confirm-modal";
import { MarkerDialog, type MarkerDialogValues } from "@/components/combat/marker-dialog";
import {
  CombatActionPanel,
  CombatBonusActionPanel,
} from "@/components/combat/combat-action-panel";
import { CombatEndTurnConfirmModal } from "@/components/combat/combat-end-turn-confirm-modal";
import { CombatEndTurnPanel } from "@/components/combat/combat-end-turn-panel";
import { CombatMovePanel } from "@/components/combat/combat-move-panel";
import { CombatBoardFullscreen } from "@/components/combat/combat-board-fullscreen";
import { CombatMeasureOverlay } from "@/components/combat/combat-measure-overlay";
import { CombatMovementOverlay } from "@/components/combat/combat-movement-overlay";
import { CombatCollisionOverlay } from "@/components/combat/combat-collision-overlay";
import { CombatHelpTargetModal } from "@/components/combat/combat-help-target-modal";
import { CombatDashConfirmModal } from "@/components/combat/combat-dash-confirm-modal";
import { CombatShellDefenseConfirmModal } from "@/components/combat/combat-shell-defense-confirm-modal";
import { CombatLayOnHandsModal } from "@/components/combat/combat-lay-on-hands-modal";
import { CombatOtherActionsModal } from "@/components/combat/combat-other-actions-modal";
import { CombatOpportunityAttackModal } from "@/components/combat/combat-opportunity-attack-modal";
import { CombatOpportunityAttackPanel } from "@/components/combat/combat-opportunity-attack-panel";
import { CombatAttackSubmitModal } from "@/components/combat/combat-attack-submit-modal";
import type { AttackSubmitValues } from "@/components/combat/combat-attack-submit-modal";
import { CombatDmApprovalTray } from "@/components/combat/combat-dm-approval-tray";
import { CombatSaveRollModal } from "@/components/combat/combat-save-roll-modal";
import { CombatTargetingOverlay } from "@/components/combat/combat-targeting-overlay";
import { CombatObjectInteractionOverlay } from "@/components/combat/combat-object-interaction-overlay";
import { CombatEquipmentChangeModal } from "@/components/combat/combat-equipment-change-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { AlertModal } from "@/components/ui/alert-modal";
import { Tooltip } from "@/components/ui/tooltip";
import {
  findDerivedAttackByOptionId,
  getCombatOptionGroupsForToken,
  getOpportunityAttackOptionsForToken,
  isAttackTargetingOption,
  isLeaveAreaOption,
  isOtherActionsOption,
  isDashActionOption,
  isDisengageActionOption,
  isEmergeFromShellOption,
  isHelpActionOption,
  isImplementedCombatOption,
  isLayOnHandsOption,
  isShellDefenseEnterOption,
  isUseObjectActionOption,
  COMBAT_USE_OBJECT_OPTION_ID,
  type CombatOption,
} from "@/lib/combat/combat-options";
import { leaveCombatArea } from "@/lib/combat/battle-over-actions";
import { getBattleOverTurnDisplay, isBattleOver } from "@/lib/combat/battle-over";
import {
  recordCombatActionUsed,
  recordCombatDash,
  recordCombatDisengage,
  recordCombatEquipmentChange,
  recordCombatLayOnHands,
  recordCombatObjectPickup,
} from "@/lib/combat/combat-action-actions";
import { hasEquippableInventoryItems } from "@/lib/combat/object-equipment-change";
import {
  canStartObjectInteraction,
  getAdjacentPickupMarkers,
  isPickupMarker,
} from "@/lib/combat/object-pickup";
import {
  cancelCombatAttack,
  resolveCombatAttack,
  shouldAutoApprovePendingAttack,
  submitCombatAttack,
  submitCombatDmSaveRolls,
  submitCombatSaveRoll,
  type CharacterHpUpdate,
} from "@/lib/combat/attack-actions";
import {
  recordCombatFeatureEffectEnter,
  recordCombatFeatureEffectExit,
} from "@/lib/combat/feature-effect-actions";
import {
  getTokenStatusLabels,
  isTokenRestrictedByEffects,
  SHELL_DEFENSE_EFFECT_ID,
} from "@/lib/combat/feature-effects";
import { getTokenAc, getTokenSaveModifier } from "@/lib/combat/attack-resolution";
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
import {
  getTargetingHighlights,
  getAttackRollDisadvantage,
  formatAttackDisadvantageLabel,
  hasRangedAttackAdjacentDisadvantage,
  parseAttackRangeSpec,
} from "@/lib/combat/targeting";
import {
  applyRectangleToBlockedSet,
  areBlockedCellsEqual,
  blockedCellsFromSet,
  buildBlockedCellSet,
  type BlockedCell,
} from "@/lib/combat/collision";
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
  applyActionGranted,
  canUserActForToken,
  canUserControlTurn,
  canUserEndTurn,
  getCurrentTurnToken,
  getCurrentTurnTokenId,
  getNextTurnToken,
  isBattleActive,
} from "@/lib/combat/turn";
import { useCombatCatalog } from "@/lib/combat/use-combat-catalog";
import {
  adjustTurnMovementUsedFeet,
  computeReachableDestinations,
  findDestinationAtCell,
  getDashPreviewRemainingFeet,
  getRemainingMovementFeet,
  getTokenSpeedFt,
  type ReachableDestination,
  type GridPosition,
} from "@/lib/combat/movement";
import { commitCombatMove } from "@/lib/combat/movement-actions";
import { getCombatTokenDisplayLabel, getEnemyTokenLabelLetter } from "@/lib/combat/party-token-label";
import {
  assignCharacterToPlaceholder,
  canPlayerClaimPlaceholder,
  hasUnclaimedCharacterPlaceholders,
  isCharacterPlaceholder,
  populateCharacterPlaceholders,
} from "@/lib/combat/character-placeholder";
import { claimCombatCharacterSlot } from "@/lib/combat/character-slot-actions";
import {
  combatStateToEncounterPayload,
  isPreBattleSetup,
  savedEncounterToCombatState,
} from "@/lib/combat/saved-encounters";
import type { Encounter } from "@/lib/types/database";

type ConfirmRequest = {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};

interface CombatBoardProps {
  campaignId: string;
  initialCombatState: CombatState;
  characters: ParsedCharacter[];
  enemies: EnemyRecord[];
  isDm: boolean;
  userId: string | null;
  ownedCharacterId?: string | null;
}

function tokenColorClass(kind: CombatToken["kind"]): string {
  if (kind === "party") return "combat-token-party";
  if (kind === "ally") return "combat-token-ally";
  if (kind === "marker") return "combat-token-marker";
  return "combat-token-enemy";
}

/** Lower renders first (underneath); party on top, then enemies, then markers/allies. */
function tokenStackOrder(kind: CombatToken["kind"]): number {
  if (kind === "party") return 2;
  if (kind === "enemy") return 1;
  return 0;
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

function gridCellFromPointerClamped(
  clientX: number,
  clientY: number,
  gridEl: HTMLElement,
  state: CombatState
): { x: number; y: number } {
  const rect = gridEl.getBoundingClientRect();
  const content = getGridContentBox(gridEl, rect);
  const x = Math.floor(
    ((clientX - content.left) / content.width) * state.gridWidth
  );
  const y = Math.floor(
    ((clientY - content.top) / content.height) * state.gridHeight
  );

  return {
    x: Math.min(state.gridWidth - 1, Math.max(0, x)),
    y: Math.min(state.gridHeight - 1, Math.max(0, y)),
  };
}

function resolveGridCellFromPointer(
  clientX: number,
  clientY: number,
  gridEl: HTMLElement,
  state: CombatState
): { x: number; y: number } {
  return (
    gridCellFromPointer(clientX, clientY, gridEl, state) ??
    gridCellFromPointerClamped(clientX, clientY, gridEl, state)
  );
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
  let bestStack = -Infinity;

  for (const token of matches) {
    const centerX =
      content.left + ((token.x + token.width / 2) / state.gridWidth) * content.width;
    const centerY =
      content.top + ((token.y + token.height / 2) / state.gridHeight) * content.height;
    const distance = (clientX - centerX) ** 2 + (clientY - centerY) ** 2;
    const stack = tokenStackOrder(token.kind);
    if (
      distance < bestDistance ||
      (distance === bestDistance && stack > bestStack)
    ) {
      bestDistance = distance;
      bestStack = stack;
      best = token;
    }
  }

  return best;
}

function findOverlappingMarkerTokens(
  token: CombatToken,
  tokens: CombatToken[]
): CombatToken[] {
  if (token.kind === "marker") return [];

  return tokens.filter(
    (other) =>
      other.kind === "marker" &&
      other.placed &&
      other.tooltip.trim() !== "" &&
      other.id !== token.id &&
      tokenFootprintsOverlap(token, other)
  );
}

const DRAG_THRESHOLD_PX = 4;

export function CombatBoard({
  campaignId,
  initialCombatState,
  characters,
  enemies,
  isDm,
  userId,
  ownedCharacterId = null,
}: CombatBoardProps) {
  const router = useRouter();
  const enemiesBySlug = useMemo(
    () => Object.fromEntries(enemies.map((enemy) => [enemy.slug, enemy])),
    [enemies]
  );

  const liveCharacters = useRealtimeCharacters(campaignId, characters, isDm);
  const [localCharacters, setLocalCharacters] = useState(liveCharacters);
  const charactersById = useMemo(
    () => Object.fromEntries(localCharacters.map((character) => [character.id, character])),
    [localCharacters]
  );
  const ownedCharacter = useMemo(
    () => (ownedCharacterId ? charactersById[ownedCharacterId] ?? null : null),
    [charactersById, ownedCharacterId]
  );

  useEffect(() => {
    setLocalCharacters(liveCharacters);
  }, [liveCharacters]);

  const liveState = useRealtimeCombatState(campaignId, initialCombatState);
  const [draft, setDraft] = useState(liveState);
  const [addOpen, setAddOpen] = useState(false);
  const [addPartyOpen, setAddPartyOpen] = useState(false);
  const [addMarkerOpen, setAddMarkerOpen] = useState(false);
  const [editMarkerOpen, setEditMarkerOpen] = useState(false);
  const [editEnemyOpen, setEditEnemyOpen] = useState(false);
  const [encounterLoadOpen, setEncounterLoadOpen] = useState(false);
  const [savingEncounter, setSavingEncounter] = useState(false);
  const [saveEncounterNameOpen, setSaveEncounterNameOpen] = useState(false);
  const [overwriteConfirmEncounter, setOverwriteConfirmEncounter] = useState<Encounter | null>(null);
  const [pendingSaveName, setPendingSaveName] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const pendingNavigationHrefRef = useRef<string | null>(null);
  const showAlert = useCallback((message: string | { error?: string }) => {
    const text = typeof message === "string" ? message : message.error ?? "Something went wrong.";
    setAlertMessage(text);
  }, []);
  const requestConfirm = useCallback((request: ConfirmRequest) => setConfirmRequest(request), []);
  const [characterSlotTokenId, setCharacterSlotTokenId] = useState<string | null>(null);
  const [assigningCharacterSlot, setAssigningCharacterSlot] = useState(false);
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
    attackDisadvantageByTokenId?: Record<string, boolean>;
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
  const [objectInteractionMode, setObjectInteractionMode] = useState(false);
  const [equipmentChangeOpen, setEquipmentChangeOpen] = useState(false);
  const [submittingEquipmentChange, setSubmittingEquipmentChange] = useState(false);
  const [hoveredMovementCell, setHoveredMovementCell] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pendingDashDestination, setPendingDashDestination] =
    useState<ReachableDestination | null>(null);
  const [pendingDashActionConfirm, setPendingDashActionConfirm] = useState(false);
  const [pendingShellDefenseConfirm, setPendingShellDefenseConfirm] = useState(false);
  const [pendingLayOnHands, setPendingLayOnHands] = useState(false);
  const [pendingOtherActionsConfirm, setPendingOtherActionsConfirm] = useState(false);
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
  const [hpAmount, setHpAmount] = useState("1");
  const [applyingHp, setApplyingHp] = useState(false);
  const [adjustingMovement, setAdjustingMovement] = useState(false);
  const [grantingAction, setGrantingAction] = useState(false);
  const [endTurnConfirmOpen, setEndTurnConfirmOpen] = useState(false);
  const [collisionEditMode, setCollisionEditMode] = useState(false);
  const [collisionDraft, setCollisionDraft] = useState<Set<string>>(() => new Set());
  const [collisionDragStart, setCollisionDragStart] = useState<BlockedCell | null>(null);
  const [collisionDragEnd, setCollisionDragEnd] = useState<BlockedCell | null>(null);
  const [collisionDragRemoving, setCollisionDragRemoving] = useState(false);
  const [savingCollision, setSavingCollision] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);
  const [measureStartCell, setMeasureStartCell] = useState<GridPosition | null>(null);
  const [measureHoverCell, setMeasureHoverCell] = useState<GridPosition | null>(null);
  const [boardExpanded, setBoardExpanded] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const draggingTokenIdRef = useRef<string | null>(null);
  const suppressNextGridDeselectRef = useRef(false);
  const collisionPointerIdRef = useRef<number | null>(null);
  const combatStateRef = useRef<CombatState>(initialCombatState);
  const attackTargetingRef = useRef(attackTargeting);
  attackTargetingRef.current = attackTargeting;
  const supabase = useMemo(() => createClient(), []);

  const awaitingPersistFingerprintRef = useRef<string | null>(null);

  const combatState = isDm ? draft : liveState;

  combatStateRef.current = combatState;

  const backgroundUrl = useMemo(
    () => resolveCombatImageUrl(supabase, combatState.backgroundPath),
    [combatState.backgroundPath, supabase]
  );

  useEffect(() => {
    preloadImageUrls(
      combatState.tokens
        .map((token) => resolveTokenPortraitUrl(supabase, token))
        .filter((url): url is string => url != null)
    );
  }, [combatState.tokens, supabase]);

  const collisionDirty = useMemo(
    () =>
      collisionEditMode &&
      !areBlockedCellsEqual(
        blockedCellsFromSet(collisionDraft),
        combatState.blockedCells ?? []
      ),
    [collisionDraft, collisionEditMode, combatState.blockedCells]
  );

  const canUseCollisionEdit =
    !movementMode && !attackTargeting && !draggingTokenId && !startingInitiative && !measureMode;

  const canUseMeasure =
    !movementMode && !attackTargeting && !draggingTokenId && !collisionEditMode;

  const savedBlockedKeys = useMemo(
    () => buildBlockedCellSet(combatState.blockedCells ?? []),
    [combatState.blockedCells]
  );

  const showCollisionDragHint =
    isDm && !!draggingTokenId && !collisionEditMode && savedBlockedKeys.size > 0;

  const characterRosterKey = useMemo(
    () =>
      localCharacters
        .map((character) => character.id)
        .sort()
        .join(","),
    [localCharacters]
  );

  const persist = useCallback(
    async (next: CombatState): Promise<string | null> => {
      if (!isDm) return null;
      awaitingPersistFingerprintRef.current = combatTokenHpFingerprint(next);
      setDraft(next);
      const error = await persistCombatState(campaignId, next);
      if (error) {
        awaitingPersistFingerprintRef.current = null;
      }
      return error;
    },
    [campaignId, isDm]
  );

  const persistRef = useRef(persist);
  persistRef.current = persist;

  const discardCollisionEdits = useCallback(() => {
    setCollisionEditMode(false);
    setCollisionDragStart(null);
    setCollisionDragEnd(null);
    setCollisionDragRemoving(false);
    collisionPointerIdRef.current = null;
    setCollisionDraft(buildBlockedCellSet(combatStateRef.current.blockedCells ?? []));
  }, []);

  useEffect(() => {
    if (!collisionDirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [collisionDirty]);

  useEffect(() => {
    if (!collisionDirty) return;

    function handleDocumentClick(event: MouseEvent) {
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target === "_blank") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      event.preventDefault();
      event.stopPropagation();
      pendingNavigationHrefRef.current = href;
      requestConfirm({
        title: "Discard collision edits?",
        description: "You have unsaved collision edits. Discard them and leave this page?",
        confirmLabel: "Leave",
        destructive: true,
        onConfirm: () => {
          discardCollisionEdits();
          const target = pendingNavigationHrefRef.current;
          pendingNavigationHrefRef.current = null;
          if (target) router.push(target);
        },
      });
    }

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [collisionDirty, discardCollisionEdits, requestConfirm, router]);

  useEffect(() => {
    if (!collisionEditMode) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Shift") return;
      if (collisionPointerIdRef.current != null) {
        setCollisionDragRemoving(true);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key !== "Shift") return;
      if (collisionPointerIdRef.current != null) {
        setCollisionDragRemoving(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [collisionEditMode]);

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

  useEffect(() => {
    if (!isDm) return;
    if (draggingTokenIdRef.current) return;

    setDraft((prev) => {
      const awaited = awaitingPersistFingerprintRef.current;
      const liveHp = combatTokenHpFingerprint(liveState);
      const prevHp = combatTokenHpFingerprint(prev);

      if (awaited && liveHp === awaited) {
        awaitingPersistFingerprintRef.current = null;
      }

      if (liveHp === prevHp) {
        return liveState;
      }

      if (awaitingPersistFingerprintRef.current != null) {
        return mergeLiveStatePreservingTokenHp(prev, liveState);
      }

      return liveState;
    });
  }, [isDm, liveState]);

  useEffect(() => {
    if (!isDm) return;
    setDraft((prev) => syncPartyTokens(prev, localCharacters));
    // Only re-sync party token metadata when roster membership changes, not on HP edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- localCharacters read at roster change time
  }, [characterRosterKey, isDm]);

  const beginTokenDrag = useCallback(
    (tokenId: string, pointerId: number, clientX: number, clientY: number) => {
      if (collisionEditMode) return;
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
        suppressNextGridDeselectRef.current = true;

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
    [clearTokenHover, collisionEditMode]
  );

  const handleTokenPointerDown = useCallback(
    (tokenId: string, event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDm || collisionEditMode) return;
      event.preventDefault();
      event.stopPropagation();

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
        if (!dragStarted) {
          setSelectedTokenId(tokenId);
        }
      }

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [beginTokenDrag, collisionEditMode, isDm]
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
  const playerAbsentFromCombatBoard =
    !isDm &&
    (!ownedCharacterId || !presentCharacterIds.has(ownedCharacterId));

  const initiativeTokens = useMemo(() => {
    if (combatState.initiative.status !== "ready") return [];
    const tokensById = new Map(combatState.tokens.map((token) => [token.id, token]));
    const { order, results } = combatState.initiative;

    if (isDm) {
      const combatantsWithResults = combatState.tokens.filter(
        (token) => isCombatantToken(token) && results[token.id] != null
      );
      return sortInitiativeTokenIds(combatantsWithResults, results)
        .map((tokenId) => tokensById.get(tokenId))
        .filter((token): token is CombatToken => token != null);
    }

    return order
      .map((tokenId) => tokensById.get(tokenId))
      .filter(
        (token): token is CombatToken => token != null && isTokenInTurnOrder(token)
      );
  }, [
    combatState.initiative.order,
    combatState.initiative.results,
    combatState.initiative.status,
    combatState.tokens,
    isDm,
  ]);

  const gridRenderTokens = useMemo(
    () =>
      [...combatState.tokens].sort(
        (a, b) => tokenStackOrder(a.kind) - tokenStackOrder(b.kind)
      ),
    [combatState.tokens]
  );

  const selectedToken = selectedTokenId
    ? combatState.tokens.find((token) => token.id === selectedTokenId) ?? null
    : null;
  const selectedMarker = selectedToken?.kind === "marker" ? selectedToken : null;
  const selectedEnemy = selectedToken?.kind === "enemy" ? selectedToken : null;
  const canEditSelectedToken = selectedMarker != null || selectedEnemy != null;
  const combatantCount = useMemo(
    () => combatState.tokens.filter(isCombatantToken).length,
    [combatState.tokens]
  );

  const hpAmountValid = parsePositiveHpAmount(hpAmount) != null;

  const canStartInitiative =
    isDm &&
    combatState.initiative.status === "none" &&
    combatantCount > 0 &&
    !startingInitiative &&
    !hasUnclaimedCharacterPlaceholders(combatState);

  const preBattleSetup = isPreBattleSetup(combatState);
  const characterSlotToken = characterSlotTokenId
    ? combatState.tokens.find((token) => token.id === characterSlotTokenId) ?? null
    : null;

  const battleActive = isBattleActive(combatState);
  const battleOver = isBattleOver(combatState);
  const currentTurnTokenId = getCurrentTurnTokenId(combatState);
  const currentTurnToken = getCurrentTurnToken(combatState);
  const canAdjustTurnMovement =
    battleActive && !battleOver && currentTurnToken != null && isCombatantToken(currentTurnToken);
  const nextTurnToken = getNextTurnToken(combatState);
  const nextTurnLabel = nextTurnToken
    ? getCombatTokenDisplayLabel(nextTurnToken)
    : "Unknown";
  const currentTurnCharacter = currentTurnToken?.characterId
    ? charactersById[currentTurnToken.characterId] ?? null
    : null;
  const currentTurnEnemy =
    currentTurnToken?.enemySlug ? enemiesBySlug[currentTurnToken.enemySlug] ?? null : null;

  const selectedActingCharacter = selectedToken?.characterId
    ? charactersById[selectedToken.characterId] ?? null
    : null;

  const userControllableBattleOverTokens = useMemo(() => {
    if (!battleOver) return [];
    return combatState.tokens.filter((token) => {
      const character = token.characterId ? charactersById[token.characterId] ?? null : null;
      return canUserActForToken(userId, isDm, token, character);
    });
  }, [battleOver, charactersById, combatState.tokens, isDm, userId]);

  const defaultBattleOverActingToken =
    userControllableBattleOverTokens.length === 1
      ? userControllableBattleOverTokens[0]
      : null;

  const selectedBattleOverActingToken =
    selectedToken &&
    canUserActForToken(userId, isDm, selectedToken, selectedActingCharacter)
      ? selectedToken
      : null;

  const actingToken = battleOver
    ? selectedBattleOverActingToken ?? defaultBattleOverActingToken
    : currentTurnToken;
  const actingTokenCharacter = actingToken?.characterId
    ? charactersById[actingToken.characterId] ?? null
    : null;
  const actingTokenEnemy =
    actingToken?.enemySlug ? enemiesBySlug[actingToken.enemySlug] ?? null : null;

  const { catalogItems, classCatalog, featureCatalogs } = useCombatCatalog(characters);
  const tokenSpeedOptions = useMemo(
    () => ({
      catalogItems,
      speciesList: featureCatalogs.species,
    }),
    [catalogItems, featureCatalogs.species]
  );

  const baseSpeedFt = actingToken
    ? getTokenSpeedFt(
        actingToken,
        actingTokenCharacter,
        actingTokenEnemy?.data ?? null,
        tokenSpeedOptions
      )
    : 0;
  const currentSpeedFt = baseSpeedFt;
  const battleOverEconomy = getBattleOverTurnDisplay();
  const movementUsedFeet = battleOver
    ? battleOverEconomy.movementUsedFeet
    : combatState.turn.movementUsedFeet;
  const dashUsed = battleOver ? battleOverEconomy.dashUsed : combatState.turn.dashUsed;
  const actionUsedForTwoWeapon = battleOver
    ? battleOverEconomy.actionUsedForTwoWeapon
    : combatState.turn.actionUsedForTwoWeapon;
  const twoWeaponFightingUsedOffHand = battleOver
    ? battleOverEconomy.twoWeaponFightingUsedOffHand
    : combatState.turn.twoWeaponFightingUsedOffHand;
  const actionUsed = battleOver ? battleOverEconomy.actionUsed : combatState.turn.actionUsed;
  const bonusActionUsed = battleOver
    ? battleOverEconomy.bonusActionUsed
    : combatState.turn.bonusActionUsed;
  const disengageUsed = battleOver
    ? battleOverEconomy.disengageUsed
    : combatState.turn.disengageUsed;
  const freeObjectInteractionUsed = battleOver
    ? battleOverEconomy.freeObjectInteractionUsed
    : combatState.turn.freeObjectInteractionUsed;
  const pendingAttacks = combatState.pendingAttacks;
  const autoApprove = combatState.autoApprove;
  const dmApprovalTrayAttacks = useMemo(
    () => getDmApprovalTrayAttacks(pendingAttacks),
    [pendingAttacks]
  );
  const currentTurnPendingAttack = actingToken
    ? getPendingAttackForAttacker(combatState, actingToken.id)
    : null;
  const pendingOpportunityAttacks = combatState.pendingOpportunityAttacks;
  const opportunityAttacksPending = hasPendingOpportunityAttacks(combatState);
  const remainingMovementFeet = getRemainingMovementFeet(
    currentSpeedFt,
    movementUsedFeet,
    dashUsed
  );
  const actingTokenRestricted = actingToken
    ? isTokenRestrictedByEffects(actingToken)
    : false;
  const canUseDash =
    !battleOver && !dashUsed && !actionUsed && !actingTokenRestricted;
  const showMovePanel =
    (remainingMovementFeet > 0 || canUseDash) && !actingTokenRestricted;
  const dashPreviewFeet = getDashPreviewRemainingFeet(
    currentSpeedFt,
    movementUsedFeet,
    dashUsed,
    actionUsed
  );

  const userControlsTurn = canUserControlTurn(
    userId,
    isDm,
    combatState,
    currentTurnToken,
    currentTurnCharacter
  );
  const userControlsActingToken = battleOver && actingToken != null;
  const userControlsCombat = battleOver ? userControlsActingToken : userControlsTurn;

  useEffect(() => {
    if (!battleOver || !defaultBattleOverActingToken) return;
    setSelectedTokenId((current) => current ?? defaultBattleOverActingToken.id);
  }, [battleOver, defaultBattleOverActingToken]);

  const canUseObjectAction = useMemo(() => {
    if (!actingToken || !actingTokenCharacter) return false;
    return canStartObjectInteraction({
      state: combatState,
      actorToken: actingToken,
      character: actingTokenCharacter,
      userId,
      isDm,
      catalogItems,
    });
  }, [actingToken, actingTokenCharacter, catalogItems, combatState, isDm, userId]);

  const actingTokenHasEquippableItems = useMemo(() => {
    if (!actingTokenCharacter) return false;
    return hasEquippableInventoryItems(actingTokenCharacter, catalogItems);
  }, [actingTokenCharacter, catalogItems]);

  const adjacentPickupMarkers = useMemo(() => {
    if (!actingToken) return [];
    return getAdjacentPickupMarkers(actingToken, combatState);
  }, [actingToken, combatState]);

  const currentTurnOptionGroups = useMemo(() => {
    if (!actingToken) {
      return { actions: [], bonusActions: [] };
    }
    return getCombatOptionGroupsForToken(actingToken, {
      character: actingTokenCharacter,
      enemyData: actingTokenEnemy?.data ?? null,
      catalogItems,
      classCatalog,
      featureCatalogs,
      actionUsedForTwoWeapon,
      twoWeaponFightingUsedOffHand,
      actionUsed,
      bonusActionUsed,
      dashUsed,
      freeObjectInteractionUsed,
      combatState,
      token: actingToken,
      partyCharacters: localCharacters,
      canUseObject: canUseObjectAction,
      battleOver,
    });
  }, [
    actionUsed,
    actionUsedForTwoWeapon,
    actingToken,
    actingTokenCharacter,
    actingTokenEnemy,
    battleOver,
    bonusActionUsed,
    canUseObjectAction,
    catalogItems,
    classCatalog,
    combatState,
    dashUsed,
    featureCatalogs,
    freeObjectInteractionUsed,
    localCharacters,
    twoWeaponFightingUsedOffHand,
  ]);

  const userCanEndTurn =
    !battleOver &&
    canUserEndTurn(userId, isDm, combatState, currentTurnToken, currentTurnCharacter);

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
    const token = combatState.tokens.find((entry) => entry.id === provokingId);
    return token ? getCombatTokenDisplayLabel(token) : "An enemy";
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
    !battleOver && pendingOpportunityAttacks?.provokingTokenId === currentTurnToken?.id;

  async function handleEndTurn() {
    if (!userCanEndTurn || endingTurn) return;
    setEndingTurn(true);
    setMovementMode(false);
    const { next, error } = await endCombatTurn(campaignId, combatState, { isDm });
    setEndingTurn(false);
    setEndTurnConfirmOpen(false);
    if (error) {
      showAlert(error);
      return;
    }
    if (isDm) {
      setDraft(next);
    }
  }

  function clearMeasureMode() {
    setMeasureMode(false);
    setMeasureStartCell(null);
    setMeasureHoverCell(null);
  }

  function clearAttackFlow() {
    setAttackTargeting(null);
    setAttackSubmitDraft(null);
    setHoveredTargetingCell(null);
  }

  function clearObjectInteractionMode() {
    setObjectInteractionMode(false);
    setEquipmentChangeOpen(false);
  }

  async function handleSelectCombatOption(option: CombatOption) {
    if (!isImplementedCombatOption(option)) return;
    if (attackTargeting) {
      if (option.id === attackTargeting.option.id) {
        clearAttackFlow();
      }
      return;
    }
    if (objectInteractionMode) {
      if (isUseObjectActionOption(option)) {
        clearObjectInteractionMode();
      }
      return;
    }
    if (movementMode || measureMode || turnTokenHasPendingAction) return;

    if (isLeaveAreaOption(option)) {
      if (!userControlsCombat || !actingToken) return;
      const label = getCombatTokenDisplayLabel(actingToken);
      requestConfirm({
        title: "Leave Area?",
        description: `Remove ${label} from the board?`,
        confirmLabel: "Leave",
        destructive: true,
        onConfirm: async () => {
          const { next, error } = await leaveCombatArea(campaignId, combatStateRef.current, {
            isDm,
            tokenId: actingToken.id,
          });
          if (error) {
            showAlert(error);
            return;
          }
          if (isDm) {
            setDraft(next);
          }
          setSelectedTokenId(null);
        },
      });
      return;
    }

    if (isUseObjectActionOption(option)) {
      if (!userControlsCombat || !actingToken || !actingTokenCharacter) return;
      if (!canUseObjectAction) {
        showAlert("No object interactions or equipment changes are available.");
        return;
      }
      setMovementMode(false);
      clearMeasureMode();
      clearAttackFlow();
      setObjectInteractionMode(true);
      return;
    }

    if (isHelpActionOption(option)) {
      if (!actingToken) return;
      const allies = getAdjacentAllyTokens(actingToken, combatState).sort((a, b) =>
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
        showAlert(error);
        return;
      }
      if (isDm) {
        setDraft(next);
      }
      return;
    }

    if (isDashActionOption(option)) {
      if (battleOver || dashUsed || actionUsed) return;
      setPendingDashActionConfirm(true);
      return;
    }

    if (isShellDefenseEnterOption(option)) {
      if (!actingToken || battleOver || actionUsed) return;
      setPendingShellDefenseConfirm(true);
      return;
    }

    if (isLayOnHandsOption(option)) {
      if (!actingToken || !actingTokenCharacter || battleOver || actionUsed) return;
      setPendingLayOnHands(true);
      return;
    }

    if (isEmergeFromShellOption(option)) {
      if (!actingToken || battleOver || bonusActionUsed) return;
      const { next, error } = await recordCombatFeatureEffectExit(
        campaignId,
        combatState,
        {
          isDm,
          tokenId: actingToken.id,
          effectId: SHELL_DEFENSE_EFFECT_ID,
          character: actingTokenCharacter,
        }
      );
      if (error) {
        showAlert(error);
        return;
      }
      if (isDm) {
        setDraft(next);
      }
      return;
    }

    if (isOtherActionsOption(option)) {
      setPendingOtherActionsConfirm(true);
      return;
    }

    if (isAttackTargetingOption(option) && userControlsCombat && actingToken && !battleOver) {
      const attack = optionToAttack(option);
      if (!attack) return;
      if (
        actingToken &&
        hasPendingAttackForAttacker(combatState, actingToken.id)
      ) {
        showAlert("You already have an action pending.");
        return;
      }
      setMovementMode(false);
      clearMeasureMode();
      clearObjectInteractionMode();
      clearAttackFlow();
      setAttackTargeting({ option, attack });
      return;
    }
  }

  function handleToggleMeasureMode() {
    if (!measureMode && !canUseMeasure) return;
    if (measureMode) {
      clearMeasureMode();
      return;
    }
    setMeasureStartCell(null);
    setMeasureHoverCell(null);
    setMeasureMode(true);
  }

  function handleMeasureCellClick(cell: GridPosition) {
    if (!measureStartCell) {
      setMeasureStartCell(cell);
      setMeasureHoverCell(null);
      return;
    }

    setMeasureStartCell(cell);
    setMeasureHoverCell(null);
  }

  const mapSelectionActive = Boolean(attackTargeting || movementMode || objectInteractionMode);
  const selectedActionOptionId =
    pendingOptionId ??
    attackTargeting?.option.id ??
    (objectInteractionMode ? COMBAT_USE_OBJECT_OPTION_ID : null);
  const turnActionsLocked = mapSelectionActive || turnTokenHasPendingAction;

  const targetingHighlights = useMemo(() => {
    if (!attackTargeting || !actingToken) return null;
    return getTargetingHighlights(
      actingToken,
      combatState,
      attackTargeting.attack
    );
  }, [attackTargeting, combatState, actingToken]);

  const damageTakenByTokenId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const token of combatState.tokens) {
      map[token.id] = token.damageTaken ?? 0;
    }
    return map;
  }, [combatState.tokens]);

  function buildAttackDisadvantageMap(
    attacker: CombatToken | null | undefined,
    attack: DerivedAttack,
    targets: CombatToken[]
  ): Record<string, boolean> {
    if (!attacker) return {};
    return Object.fromEntries(
      targets.map((target) => [
        target.id,
        getAttackRollDisadvantage(attacker, target, combatState, attack),
      ])
    );
  }

  function resolvePendingDisadvantageLabel(
    pending: PendingAttack,
    targetTokenId: string
  ): string | null {
    const target = pending.targets.find((entry) => entry.tokenId === targetTokenId);
    if (!target?.attackDisadvantage) return null;

    const attacker = combatState.tokens.find((token) => token.id === pending.attackerTokenId);
    const targetToken = combatState.tokens.find((token) => token.id === targetTokenId);
    if (!attacker || !targetToken) return "Disadvantage on attack roll";

    const character = attacker.characterId
      ? charactersById[attacker.characterId] ?? null
      : null;
    const attack = findDerivedAttackByOptionId(
      pending.optionId,
      attacker,
      character,
      catalogItems,
      classCatalog
    );
    if (!attack) return "Disadvantage on attack roll";

    return (
      formatAttackDisadvantageLabel(attacker, targetToken, combatState, attack) ??
      "Disadvantage on attack roll"
    );
  }

  function openAttackSubmit(
    targets: CombatToken[],
    aoeCenter: { x: number; y: number } | null,
    attacker: CombatToken | null = actingToken
  ) {
    if (!attackTargeting || targets.length === 0 || !attacker) return;
    setAttackSubmitDraft({
      option: attackTargeting.option,
      attack: attackTargeting.attack,
      targets,
      aoeCenter,
      attackerToken: attacker,
      attackDisadvantageByTokenId: buildAttackDisadvantageMap(
        attacker,
        attackTargeting.attack,
        targets
      ),
    });
    setAttackTargeting(null);
    setHoveredTargetingCell(null);
  }

  function handleTargetingAtCell(cell: { x: number; y: number }) {
    if (!attackTargeting || !actingToken || !targetingHighlights) return;

    const targets = buildTargetList(
      actingToken,
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
            ...(update.inventoryItems != null
              ? {
                  inventory: {
                    ...character.data.inventory,
                    items: update.inventoryItems,
                  },
                }
              : {}),
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
      catalogItems,
      classCatalog,
    });
    setSubmittingAttack(false);
    if (error) {
      if (attackSubmitDraft.isOpportunityAttack) {
        setUserOaLocked(false);
      }
      showAlert(error);
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
      attackDisadvantageByTokenId: buildAttackDisadvantageMap(
        userOaAttackerToken,
        attack,
        [provokingToken]
      ),
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
      showAlert(error);
      return;
    }
    if (isDm) {
      setDraft(next);
    }
  }

  async function handleSubmitPlayerSave(
    saveRoll: number,
    saveTotal: number,
    saveRoll2?: number | null
  ) {
    if (!playerSaveContext) return;
    setSubmittingSaveId(playerSaveContext.pending.id);
    const { next, error, characterUpdates } = await submitCombatSaveRoll(campaignId, combatState, {
      isDm,
      pendingAttackId: playerSaveContext.pending.id,
      tokenId: playerSaveContext.target.tokenId,
      saveRoll,
      saveTotal,
      saveRoll2,
      charactersById,
    });
    setSubmittingSaveId(null);
    if (error) {
      showAlert(error);
      return;
    }
    if (isDm) {
      setDraft(next);
      applyCharacterHpUpdates(next, characterUpdates);
    }
  }

  async function handleSubmitDmSaves(
    pendingAttackId: string,
    saves: Array<{ tokenId: string; saveRoll: number; saveTotal: number; saveRoll2?: number | null }>
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
      showAlert(error);
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
      showAlert(error);
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
      showAlert(error);
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

  const playerSaveModifier = useMemo(() => {
    if (!playerSaveContext) return null;
    const token = combatState.tokens.find(
      (entry) => entry.id === playerSaveContext.target.tokenId
    );
    if (!token) return null;
    const character = token.characterId ? charactersById[token.characterId] ?? null : null;
    return getTokenSaveModifier(token, playerSaveContext.pending.saveAbility, {
      character,
      enemyData: null,
      classCatalog,
    });
  }, [playerSaveContext, combatState.tokens, charactersById, classCatalog]);

  useEffect(() => {
    if (!isDm) return;

    for (const pending of combatState.pendingAttacks) {
      if (!shouldAutoApprovePendingAttack(combatState, pending)) continue;
      if (autoResolvingAttackIdsRef.current.has(pending.id)) continue;
      if (resolvingAttackId === pending.id) continue;

      autoResolvingAttackIdsRef.current.add(pending.id);
      void resolveCombatAttack(campaignId, combatState, pending, charactersById, isDm)
        .then(({ next, error, characterUpdates }) => {
          if (error) {
            showAlert(error);
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
    autoApprove,
    campaignId,
    charactersById,
    combatState,
    isDm,
    resolvingAttackId,
  ]);

  function handleToggleAutoApprove(checked: boolean) {
    if (checked === autoApprove) return;
    void persist({ ...combatState, autoApprove: checked });
  }

  function handleToggleMovementMode() {
    if (
      attackTargeting ||
      objectInteractionMode ||
      measureMode ||
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
    if (!actingToken || !movementMode || !userControlsCombat) return [];
    return computeReachableDestinations(actingToken, combatState, {
      speedFt: currentSpeedFt,
      usedFeet: movementUsedFeet,
      dashUsed,
      actionUsed,
      allowDash: true,
    });
  }, [
    actingToken,
    battleOver,
    combatState,
    currentSpeedFt,
    dashUsed,
    actionUsed,
    movementMode,
    movementUsedFeet,
    userControlsCombat,
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
    clearObjectInteractionMode();
  }, [turnTokenHasPendingAction]);

  useEffect(() => {
    if (!userControlsCombat || !canUseObjectAction) {
      setObjectInteractionMode(false);
    }
  }, [userControlsCombat, canUseObjectAction]);

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
    setPendingOtherActionsConfirm(false);
    setPendingOpportunityAttackMove(null);
    setHelpTargetPickerAllies(null);
    setEndTurnConfirmOpen(false);
    clearMeasureMode();
    clearAttackFlow();
  }, [battleOver, actingToken?.id, currentTurnTokenId, userControlsCombat]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (measureMode) {
          clearMeasureMode();
          return;
        }
        clearAttackFlow();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function tryCommitMovement(
    destination: ReachableDestination,
    dashConsumed: boolean
  ) {
    if (!actingToken || !userControlsCombat || provokingMovePending) return;
    if (dashConsumed && (dashUsed || actionUsed)) return;

    if (!battleOver) {
      const opportunityAttackReactors = getOpportunityAttackReactors(
        actingToken,
        destination,
        combatState,
        disengageUsed
      );

      if (opportunityAttackReactors.length > 0) {
        const opportunityAttackerTokenIds = getOpportunityAttackAttackerIds(
          actingToken,
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
          reactorLabels: opportunityAttackReactors.map((reactor) =>
            getCombatTokenDisplayLabel(reactor)
          ),
          opportunityAttackerTokenIds,
        });
        return;
      }
    }

    await commitMovementToDestination(destination, dashConsumed);
  }

  async function commitMovementToDestination(
    destination: ReachableDestination,
    dashConsumed: boolean,
    opportunityAttackerTokenIds?: string[]
  ) {
    if (!actingToken || !userControlsCombat) return;

    const { next, error } = await commitCombatMove(campaignId, combatState, {
      isDm,
      tokenId: actingToken.id,
      x: destination.x,
      y: destination.y,
      costFeet: destination.costFeet,
      dashConsumed,
      opportunityAttackerTokenIds,
    });

    if (error) {
      showAlert(error);
      return;
    }

    if (isDm) {
      setDraft(next);
    }
  }

  async function handleMovementCellClick(cellX: number, cellY: number) {
    if (!actingToken || !userControlsCombat || !movementMode) return;

    const destination = findDestinationAtCell(
      movementDestinations,
      actingToken,
      cellX,
      cellY
    );
    if (!destination) return;

    if (destination.zone === "dash" && !dashUsed && !actionUsed) {
      if (battleOver) {
        await tryCommitMovement(destination, false);
        return;
      }
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
      showAlert(error);
      return;
    }
    if (isDm) {
      setDraft(next);
    }
    setMovementMode(true);
    clearAttackFlow();
    clearObjectInteractionMode();
  }

  async function handleConfirmShellDefense() {
    if (!actingToken) return;
    const { next, error } = await recordCombatFeatureEffectEnter(
      campaignId,
      combatState,
      {
        isDm,
        tokenId: actingToken.id,
        effectId: SHELL_DEFENSE_EFFECT_ID,
        character: actingTokenCharacter,
      }
    );
    setPendingShellDefenseConfirm(false);
    if (error) {
      showAlert(error);
      return;
    }
    if (isDm) {
      setDraft(next);
    }
  }

  async function handleConfirmLayOnHands(input: {
    target: LayOnHandsCombatTarget;
    mode: LayOnHandsMode;
    healAmount: number;
  }) {
    if (!actingToken || !actingTokenCharacter) return;

    const targetToken = input.target.token;
    const targetCharacter = input.target.character;

    const result = applyLayOnHands(
      actingTokenCharacter.data,
      targetCharacter.data,
      input.mode,
      input.healAmount,
      featureCatalogs,
      { selfTarget: targetCharacter.id === actingTokenCharacter.id }
    );
    if (!result) {
      showAlert("Lay on Hands could not be applied.");
      return;
    }

    const maxHp =
      targetToken.maxHp ?? getEffectiveMaxHp(result.targetData, featureCatalogs);
    const nextHp = result.targetData.combat.currentHp;
    const nextWithHp = updateTokenInState(combatState, targetToken.id, {
      currentHp: nextHp,
      maxHp,
    });

    const { next, error } = await recordCombatLayOnHands(campaignId, nextWithHp, {
      isDm,
      targetTokenId: targetToken.id,
      targetCurrentHp: nextHp,
    });
    if (error) {
      showAlert(error);
      return;
    }

    const paladinSave = await saveCharacterData(
      actingTokenCharacter.id,
      result.paladinData,
      undefined,
      { isDm, originalData: actingTokenCharacter.data }
    );
    if (paladinSave.error) {
      showAlert(paladinSave.error);
      return;
    }

    if (targetCharacter.id !== actingTokenCharacter.id) {
      const targetSave = await saveCharacterData(
        targetCharacter.id,
        result.targetData,
        undefined,
        { isDm, originalData: targetCharacter.data }
      );
      if (targetSave.error) {
        showAlert(targetSave.error);
        return;
      }
    }

    setLocalCharacters((current) =>
      current.map((entry) => {
        if (entry.id === actingTokenCharacter.id) {
          return { ...entry, data: result.paladinData };
        }
        if (entry.id === targetCharacter.id) {
          return { ...entry, data: result.targetData };
        }
        return entry;
      })
    );

    if (isDm) {
      setDraft(next);
    }
  }

  async function handleConfirmOtherActions() {
    const { next, error } = await recordCombatActionUsed(campaignId, combatState, {
      isDm,
    });
    setPendingOtherActionsConfirm(false);
    if (error) {
      showAlert(error);
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

  async function handleApplyHpToSelected(sign: 1 | -1) {
    if (!selectedToken) return;
    const amount = parsePositiveHpAmount(hpAmount);
    if (amount == null) return;

    const delta = sign * amount;
    const token = selectedToken;
    const character = token.characterId ? charactersById[token.characterId] ?? null : null;
    const enemyData = token.enemySlug ? enemiesBySlug[token.enemySlug]?.data ?? null : null;
    const { currentHp, maxHp } = getTokenHpDisplay(token, character, enemyData);
    const nextHp = applyHpDelta(currentHp, maxHp, delta);
    const damageDelta = delta < 0 ? -delta : 0;
    const patched = patchTokenHpFromDamage(
      token,
      nextHp,
      (token.damageTaken ?? 0) + damageDelta
    );

    let next = updateTokenInState(combatState, token.id, {
      currentHp: patched.currentHp,
      maxHp,
      damageTaken: patched.damageTaken,
      ...(patched.hidden != null ? { hidden: patched.hidden } : {}),
    });

    if (token.kind === "enemy" && !(token.hidden ?? false) && (patched.hidden ?? false)) {
      next = updateInitiativeAfterVisibilityChange(next, token.id, false, true);
    }

    setApplyingHp(true);

    const persistError = await persist(next);
    if (persistError) {
      setApplyingHp(false);
      showAlert(persistError);
      return;
    }

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
        setApplyingHp(false);
        showAlert(error);
        return;
      }
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

    setApplyingHp(false);
  }

  async function handleAdjustTurnMovement(deltaUsedFeet: number) {
    if (!canAdjustTurnMovement) return;

    const next = adjustTurnMovementUsedFeet(combatState, deltaUsedFeet);
    setAdjustingMovement(true);
    const error = await persist(next);
    setAdjustingMovement(false);
    if (error) {
      showAlert(error);
    }
  }

  async function handleGrantTurnAction() {
    if (!canAdjustTurnMovement || !actionUsed) return;

    const next = applyActionGranted(combatState);
    setGrantingAction(true);
    const error = await persist(next);
    setGrantingAction(false);
    if (error) {
      showAlert(error);
    }
  }

  async function handlePickupObject(markerId: string) {
    if (!objectInteractionMode || !userControlsCombat || !actingToken || !actingTokenCharacter) {
      return;
    }

    const marker = combatState.tokens.find((token) => token.id === markerId);
    if (!marker || !isPickupMarker(marker)) {
      showAlert("That marker cannot be picked up.");
      return;
    }

    const { next, error, characterId, inventoryItems } = await recordCombatObjectPickup(
      campaignId,
      combatState,
      {
        isDm,
        actorTokenId: actingToken.id,
        markerId,
        character: actingTokenCharacter,
        catalogItems,
      }
    );

    if (error) {
      showAlert(error);
      return;
    }

    clearObjectInteractionMode();
    if (isDm) {
      setDraft(next);
    }
    if (characterId && inventoryItems) {
      applyCharacterHpUpdates(next, [
        {
          characterId,
          currentHp: actingTokenCharacter.data.combat.currentHp,
          tempHp: actingTokenCharacter.data.combat.tempHp,
          inventoryItems,
        },
      ]);
    }
  }

  async function handleConfirmEquipmentChange(nextItems: ParsedCharacter["data"]["inventory"]["items"]) {
    if (!objectInteractionMode || !userControlsCombat || !actingToken || !actingTokenCharacter) {
      return;
    }

    setSubmittingEquipmentChange(true);
    const { next, error, characterId, inventoryItems } = await recordCombatEquipmentChange(
      campaignId,
      combatState,
      {
        isDm,
        actorTokenId: actingToken.id,
        character: actingTokenCharacter,
        nextItems,
        catalogItems,
      }
    );
    setSubmittingEquipmentChange(false);

    if (error) {
      showAlert(error);
      return;
    }

    setEquipmentChangeOpen(false);
    clearObjectInteractionMode();
    if (isDm) {
      setDraft(next);
    }
    if (characterId && inventoryItems) {
      applyCharacterHpUpdates(next, [
        {
          characterId,
          currentHp: actingTokenCharacter.data.combat.currentHp,
          tempHp: actingTokenCharacter.data.combat.tempHp,
          inventoryItems,
        },
      ]);
    }
  }

  function handleTokenClick(tokenId: string, event: React.MouseEvent) {
    if (attackTargeting || movementMode || measureMode || draggingTokenId || collisionEditMode) {
      return;
    }
    event.stopPropagation();

    const token = combatState.tokens.find((entry) => entry.id === tokenId);
    if (!token) return;

    if (objectInteractionMode && userControlsCombat && isPickupMarker(token)) {
      void handlePickupObject(tokenId);
      return;
    }

    if (
      objectInteractionMode &&
      userControlsCombat &&
      actingToken &&
      token.id === actingToken.id &&
      actingTokenHasEquippableItems
    ) {
      setEquipmentChangeOpen(true);
      return;
    }

    if (isCharacterPlaceholder(token)) {
      if (isDm) {
        setCharacterSlotTokenId(tokenId);
        return;
      }
      if (canPlayerClaimPlaceholder(token, ownedCharacter, presentCharacterIds)) {
        setCharacterSlotTokenId(tokenId);
      }
      return;
    }

    if (battleOver) {
      const character = token.characterId ? charactersById[token.characterId] ?? null : null;
      if (canUserActForToken(userId, isDm, token, character)) {
        setSelectedTokenId(tokenId);
      }
      return;
    }
  }

  const handleCollisionPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!collisionEditMode || !isDm) return;
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const grid = gridRef.current;
      if (!grid) return;

      const dragStartCell = gridCellFromPointer(
        event.clientX,
        event.clientY,
        grid,
        combatStateRef.current
      );
      if (!dragStartCell) return;
      const selectionStartX = dragStartCell.x;
      const selectionStartY = dragStartCell.y;

      const pointerId = event.pointerId;
      collisionPointerIdRef.current = pointerId;
      setCollisionDragStart(dragStartCell);
      setCollisionDragEnd(dragStartCell);
      setCollisionDragRemoving(event.shiftKey);

      function handlePointerMove(moveEvent: PointerEvent) {
        if (moveEvent.pointerId !== pointerId) return;
        const activeGrid = gridRef.current;
        if (!activeGrid) return;

        const cell = resolveGridCellFromPointer(
          moveEvent.clientX,
          moveEvent.clientY,
          activeGrid,
          combatStateRef.current
        );
        setCollisionDragEnd(cell);
        setCollisionDragRemoving(moveEvent.shiftKey);
      }

      function finishDrag(upEvent: PointerEvent) {
        if (upEvent.pointerId !== pointerId) return;

        cleanup();
        const activeGrid = gridRef.current;
        if (!activeGrid) {
          setCollisionDragStart(null);
          setCollisionDragEnd(null);
          setCollisionDragRemoving(false);
          collisionPointerIdRef.current = null;
          return;
        }

        const end = resolveGridCellFromPointer(
          upEvent.clientX,
          upEvent.clientY,
          activeGrid,
          combatStateRef.current
        );
        const removing = upEvent.shiftKey;
        const state = combatStateRef.current;

        setCollisionDraft((prev) => {
          const next = new Set(prev);
          applyRectangleToBlockedSet(
            next,
            selectionStartX,
            selectionStartY,
            end.x,
            end.y,
            state.gridWidth,
            state.gridHeight,
            removing ? "remove" : "add"
          );
          return next;
        });

        setCollisionDragStart(null);
        setCollisionDragEnd(null);
        setCollisionDragRemoving(false);
        collisionPointerIdRef.current = null;
      }

      function cleanup() {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", finishDrag);
        window.removeEventListener("pointercancel", finishDrag);
      }

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", finishDrag);
      window.addEventListener("pointercancel", finishDrag);
    },
    [collisionEditMode, isDm]
  );

  async function handleToggleCollisionEditMode() {
    if (collisionEditMode) {
      setSavingCollision(true);
      const next = {
        ...combatState,
        blockedCells: blockedCellsFromSet(collisionDraft),
      };
      const error = await persist(next);
      setSavingCollision(false);
      if (error) {
        showAlert(error);
        return;
      }
      setCollisionEditMode(false);
      setCollisionDragStart(null);
      setCollisionDragEnd(null);
      setCollisionDragRemoving(false);
      collisionPointerIdRef.current = null;
      return;
    }

    setCollisionDraft(buildBlockedCellSet(combatState.blockedCells ?? []));
    setCollisionDragStart(null);
    setCollisionDragEnd(null);
    setCollisionDragRemoving(false);
    setCollisionEditMode(true);
  }

  async function promptPlayerInitiativeRolls(charactersToPrompt: ParsedCharacter[]) {
    await Promise.all(
      charactersToPrompt.map(async (character) => {
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
  }

  async function handleAddEnemy(enemy: EnemyRecord) {
    const previous = combatState;
    const withToken = addEnemyToState(previous, enemy);
    const added = getAddedCombatantTokens(previous, withToken);
    const { state, charactersNeedingPlayerRolls } = integrateNewCombatantsInitiative(
      withToken,
      added,
      characters,
      enemiesBySlug,
      userId
    );
    await persist(state);
    await promptPlayerInitiativeRolls(charactersNeedingPlayerRolls);
  }

  async function handleAddMarker(values: MarkerDialogValues) {
    const markerId = crypto.randomUUID();
    let portraitPath: string | null = null;

    if (values.portraitFile) {
      const { path, error } = await uploadMarkerPortrait(
        supabase,
        campaignId,
        markerId,
        values.portraitFile
      );
      if (error) {
        showAlert(error);
        return;
      }
      portraitPath = path;
    }

    const next = addMarkerToState(combatState, values.name, values.tooltip, {
      id: markerId,
      portraitPath,
      hasCollision: values.hasCollision,
      isObject: values.isObject,
      itemPickup: values.itemPickup,
      pickupItemId: values.pickupItemId,
      pickupQuantity: values.pickupQuantity,
    });
    await persist(next);
    setAddMarkerOpen(false);
  }

  async function handleEditMarker(values: MarkerDialogValues) {
    if (!selectedMarker) return;

    const previousPath = selectedMarker.portraitPath;
    let portraitPath = selectedMarker.portraitPath ?? null;

    if (values.removePortrait) {
      portraitPath = null;
    } else if (values.portraitFile) {
      const { path, error } = await uploadMarkerPortrait(
        supabase,
        campaignId,
        selectedMarker.id,
        values.portraitFile
      );
      if (error) {
        showAlert(error);
        return;
      }
      portraitPath = path;
    }

    const next = updateTokenInState(combatState, selectedMarker.id, {
      name: values.name,
      label: values.name,
      tooltip: values.tooltip,
      portraitPath,
      hasCollision: values.hasCollision,
      isObject: values.isObject,
      itemPickup: values.itemPickup,
      pickupItemId: values.pickupItemId,
      pickupQuantity: values.pickupQuantity,
    });
    const persistError = await persist(next);
    if (persistError) {
      showAlert(persistError);
      return;
    }

    if (previousPath && previousPath !== portraitPath) {
      await removeCombatImage(supabase, previousPath);
    }

    setEditMarkerOpen(false);
  }

  async function handleEditEnemy(values: EnemyTokenDialogValues) {
    if (!selectedEnemy) return;

    const wasHidden = selectedEnemy.hidden ?? false;
    const isHidden = values.hidden;

    let next = updateTokenInState(combatState, selectedEnemy.id, {
      displayName: values.displayName || undefined,
      hidden: isHidden,
    });

    if (wasHidden !== isHidden) {
      next = updateInitiativeAfterVisibilityChange(
        next,
        selectedEnemy.id,
        wasHidden,
        isHidden
      );
    }

    const persistError = await persist(next);
    if (persistError) {
      showAlert(persistError);
      return;
    }
    setEditEnemyOpen(false);
  }

  async function handleAddPartyMembers(selected: ParsedCharacter[]) {
    const previous = combatState;
    const withTokens = addPartyMembersToState(previous, selected);
    const added = getAddedCombatantTokens(previous, withTokens);
    const { state, charactersNeedingPlayerRolls } = integrateNewCombatantsInitiative(
      withTokens,
      added,
      characters,
      enemiesBySlug,
      userId
    );
    await persist(state);
    await promptPlayerInitiativeRolls(charactersNeedingPlayerRolls);
  }

  function handleRemoveSelected() {
    if (!selectedToken) return;
    const tokenId = selectedToken.id;
    const label = getCombatTokenDisplayLabel(selectedToken);
    requestConfirm({
      title: `Remove ${label}?`,
      description: `Remove ${label} from the board?`,
      confirmLabel: "Remove",
      destructive: true,
      onConfirm: async () => {
        const next = removeTokenFromState(combatStateRef.current, tokenId);
        await persist(next);
        setSelectedTokenId(null);
      },
    });
  }

  function handleResetBoard() {
    requestConfirm({
      title: "Reset combat board?",
      description: "All tokens will be removed from the board.",
      confirmLabel: "Reset",
      destructive: true,
      onConfirm: async () => {
        await clearCampaignInitiativeRolls(
          campaignId,
          characters.map((character) => character.id)
        );
        const next = resetCombatBoard(combatStateRef.current, characters);
        await persist(next);
        setSelectedTokenId(null);
        if (collisionEditMode) {
          setCollisionEditMode(false);
          setCollisionDragStart(null);
          setCollisionDragEnd(null);
          setCollisionDragRemoving(false);
          collisionPointerIdRef.current = null;
          setCollisionDraft(buildBlockedCellSet(next.blockedCells ?? []));
        }
      },
    });
  }

  async function handleConfirmModalConfirm() {
    if (!confirmRequest) return;
    setConfirmBusy(true);
    try {
      await confirmRequest.onConfirm();
    } finally {
      setConfirmBusy(false);
      setConfirmRequest(null);
    }
  }

  async function handleLoadEncounter(
    encounter: Encounter,
    options: { autoPopulateCharacters: boolean }
  ) {
    await clearCampaignInitiativeRolls(
      campaignId,
      characters.map((character) => character.id)
    );
    let next = savedEncounterToCombatState(
      encounter,
      enemiesBySlug,
      characters.map((character) => character.id)
    );
    if (options.autoPopulateCharacters) {
      next = populateCharacterPlaceholders(next, characters);
    }
    await persist(next);
    setSelectedTokenId(null);
    if (collisionEditMode) {
      setCollisionEditMode(false);
      setCollisionDragStart(null);
      setCollisionDragEnd(null);
      setCollisionDragRemoving(false);
      collisionPointerIdRef.current = null;
      setCollisionDraft(buildBlockedCellSet(next.blockedCells ?? []));
    }
  }

  async function handleBoardTitleCommit(rawValue: string) {
    const nextTitle = rawValue.trim() || DEFAULT_BOARD_TITLE;
    if (nextTitle === (combatState.boardTitle ?? DEFAULT_BOARD_TITLE)) return;
    await persist({ ...combatStateRef.current, boardTitle: nextTitle });
  }

  async function linkBoardToEncounter(name: string, encounterId: string) {
    await persist({
      ...combatStateRef.current,
      boardTitle: name,
      savedEncounterId: encounterId,
    });
  }

  async function persistEncounterOverwrite(name: string, targetId: string) {
    setSavingEncounter(true);
    const payload = combatStateToEncounterPayload(combatState, enemiesBySlug);

    const { error } = await supabase
      .from("encounters")
      .update({
        name,
        background_path: payload.backgroundPath,
        grid_width: payload.gridWidth,
        grid_height: payload.gridHeight,
        tile_feet: payload.tileFeet,
        blocked_cells: payload.blockedCells,
        data: payload.data,
        total_cr: payload.totalCr,
      })
      .eq("id", targetId);

    setSavingEncounter(false);
    setSaveEncounterNameOpen(false);
    setOverwriteConfirmEncounter(null);
    setPendingSaveName(null);
    if (error) {
      showAlert(error.message);
      return;
    }
    await linkBoardToEncounter(name, targetId);
  }

  async function persistEncounterInsert(name: string) {
    setSavingEncounter(true);
    const payload = combatStateToEncounterPayload(combatState, enemiesBySlug);

    const { data, error } = await supabase
      .from("encounters")
      .insert({
        name,
        background_path: payload.backgroundPath,
        grid_width: payload.gridWidth,
        grid_height: payload.gridHeight,
        tile_feet: payload.tileFeet,
        blocked_cells: payload.blockedCells,
        data: payload.data,
        total_cr: payload.totalCr,
      })
      .select("*")
      .single();

    setSavingEncounter(false);
    setSaveEncounterNameOpen(false);
    setOverwriteConfirmEncounter(null);
    setPendingSaveName(null);
    if (error) {
      showAlert(error.message);
      return;
    }
    if (data) {
      await linkBoardToEncounter(data.name, data.id);
    }
  }

  function handleSaveEncounterClick() {
    if (!isDm || !preBattleSetup) return;
    setOverwriteConfirmEncounter(null);
    setPendingSaveName(null);
    setSaveEncounterNameOpen(true);
  }

  async function handleSaveEncounterSubmit(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    const { data, error } = await supabase
      .from("encounters")
      .select("*")
      .eq("name", trimmed)
      .limit(1);

    if (error) {
      showAlert(error.message);
      return;
    }

    const existing = (data?.[0] ?? null) as Encounter | null;
    if (existing) {
      setPendingSaveName(trimmed);
      setOverwriteConfirmEncounter(existing);
      setSaveEncounterNameOpen(false);
      return;
    }

    await persistEncounterInsert(trimmed);
  }

  async function handleConfirmOverwriteExistingEncounter() {
    if (!overwriteConfirmEncounter || !pendingSaveName) return;
    await persistEncounterOverwrite(pendingSaveName, overwriteConfirmEncounter.id);
  }

  const boardTitle = combatState.boardTitle ?? DEFAULT_BOARD_TITLE;
  const defaultSaveEncounterName =
    boardTitle === DEFAULT_BOARD_TITLE ? "" : boardTitle;

  async function handleClaimCharacterSlot() {
    if (!characterSlotToken || !ownedCharacter) return;
    setAssigningCharacterSlot(true);
    const { error } = await claimCombatCharacterSlot(campaignId, combatState, {
      isDm,
      tokenId: characterSlotToken.id,
      character: ownedCharacter,
    });
    setAssigningCharacterSlot(false);
    if (error) {
      showAlert(error);
      return;
    }
    setCharacterSlotTokenId(null);
  }

  async function handleAssignCharacterSlot(characterId: string) {
    if (!characterSlotToken) return;
    const character = charactersById[characterId];
    if (!character) return;

    setAssigningCharacterSlot(true);
    const next = assignCharacterToPlaceholder(
      combatState,
      characterSlotToken.id,
      character
    );
    const error = await persist(next);
    setAssigningCharacterSlot(false);
    if (error) {
      showAlert(error);
      return;
    }
    setCharacterSlotTokenId(null);
  }

  async function handleRemoveCharacterSlot() {
    if (!characterSlotToken) return;
    setAssigningCharacterSlot(true);
    const next = removeTokenFromState(combatState, characterSlotToken.id);
    const error = await persist(next);
    setAssigningCharacterSlot(false);
    if (error) {
      showAlert(error);
      return;
    }
    setCharacterSlotTokenId(null);
  }

  async function handleStartInitiative() {
    if (combatState.initiative.status !== "none") return;
    if (combatantCount === 0) {
      showAlert("Add at least one combatant before starting initiative.");
      return;
    }

    setStartingInitiative(true);

    let next = startInitiativeCollection(combatState, characters, enemiesBySlug, userId);
    next = finalizeInitiativeIfReady(next);
    const persistError = await persistCombatState(campaignId, next);
    if (persistError) {
      setStartingInitiative(false);
      showAlert(persistError);
      return;
    }
    setDraft(next);

    if (next.initiative.status !== "collecting") {
      setStartingInitiative(false);
      return;
    }

    const claimedNeedingRolls = getTokensNeedingPlayerRolls(next, characters, userId);
    await promptPlayerInitiativeRolls(claimedNeedingRolls);

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
    requestConfirm({
      title: "Remove background?",
      description: "Remove the combat map background?",
      confirmLabel: "Remove",
      destructive: true,
      onConfirm: async () => {
        const previousPath = combatStateRef.current.backgroundPath;
        const next = { ...combatStateRef.current, backgroundPath: null };
        await persist(next);
        await removeCombatImage(supabase, previousPath);
      },
    });
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

    if (
      collisionEditMode &&
      (next.gridWidth !== combatState.gridWidth ||
        next.gridHeight !== combatState.gridHeight)
    ) {
      setCollisionDraft(new Set());
    }

    void persist(next);
  }

  function renderToken(token: CombatToken) {
    if (isHiddenEnemy(token) && !isDm) return null;

    const portraitUrl = resolveTokenPortraitUrl(supabase, token);
    const displayLabel = getCombatTokenDisplayLabel(token);
    const isSelected = selectedTokenId === token.id;
    const enemy = token.enemySlug ? enemiesBySlug[token.enemySlug] : null;
    const character = token.characterId ? charactersById[token.characterId] : null;
    const isHiddenForDm = isHiddenEnemy(token) && isDm;
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
    const partyAcTooltip =
      character != null
        ? formatAcTooltip(
            calculateAcBreakdown(character.data, catalogItems, classCatalog)
          )
        : null;
    const effectiveAc = getTokenAc(token, character, enemy?.data ?? null);
    const statusLabels = getTokenStatusLabels(token);
    const isExpanded =
      isHovered &&
      ((token.kind === "enemy" && (isDm ? enemy != null : true)) ||
        (token.kind === "party" && character != null) ||
        token.kind === "marker");

    const isDragging = draggingTokenId === token.id;
    const isActiveTurn =
      battleActive && !battleOver && token.id === currentTurnTokenId;
    const isPlaceholder = isCharacterPlaceholder(token);
    const isClaimablePlaceholder =
      isPlaceholder &&
      (isDm || canPlayerClaimPlaceholder(token, ownedCharacter, presentCharacterIds));

    const style = {
      gridColumn: `${token.x + 1} / span ${token.width}`,
      gridRow: `${token.y + 1} / span ${token.height}`,
    };

    const isPickupTarget =
      objectInteractionMode &&
      isPickupMarker(token) &&
      adjacentPickupMarkers.some((marker) => marker.id === token.id);
    const isSelfObjectTarget =
      objectInteractionMode &&
      userControlsCombat &&
      actingToken != null &&
      token.id === actingToken.id &&
      actingTokenHasEquippableItems;

    const overlappingMarkerTooltips =
      isExpanded && token.kind !== "marker"
        ? findOverlappingMarkerTokens(token, combatState.tokens)
        : [];

    return (
      <div
        key={token.id}
        className={`combat-token combat-token-on-grid ${tokenColorClass(token.kind)}${isDm ? " combat-token-dm" : ""}${isHiddenForDm ? " combat-token-hidden-enemy" : ""}${isHiddenForDm && isHovered ? " combat-token-hidden-enemy-hovered" : ""}${isPlaceholder ? " combat-token-placeholder" : ""}${isClaimablePlaceholder ? " combat-token-claimable" : ""}${isSelected ? " combat-token-selected" : ""}${isExpanded ? " combat-token-expanded" : ""}${isDragging ? " combat-token-dragging" : ""}${isActiveTurn ? " combat-token-active-turn" : ""}${isPickupTarget ? " combat-token-pickup-highlight" : ""}${isSelfObjectTarget ? " combat-token-self-object-target" : ""}`}
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
              {displayLabel.slice(0, 1)}
            </div>
          )}
        </div>
        <div className="combat-token-tooltip-stack">
          <div
            className={`combat-token-label${isExpanded ? " combat-token-label-expanded" : ""}`}
          >
            <span className="combat-token-label-name">{displayLabel}</span>
            {portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={portraitUrl}
                alt=""
                className="combat-token-label-portrait"
                draggable={false}
                decoding="async"
              />
            ) : isExpanded ? (
              <div className="combat-token-label-portrait combat-token-label-portrait-fallback">
                {displayLabel.slice(0, 1)}
              </div>
            ) : null}
            {isExpanded && token.kind === "party" && character ? (
              <>
                {speciesClassLine ? (
                  <span className="combat-token-label-detail">{speciesClassLine}</span>
                ) : null}
                {partyAcTooltip ? (
                  <Tooltip content={partyAcTooltip}>
                    <span className="combat-token-label-detail">
                      AC {effectiveAc}
                    </span>
                  </Tooltip>
                ) : (
                  <span className="combat-token-label-detail">
                    AC {effectiveAc}
                  </span>
                )}
                {statusLabels.map((label) => (
                  <span key={label} className="combat-token-status-chip">
                    {label}
                  </span>
                ))}
                <span className="combat-token-label-detail">
                  HP {token.currentHp ?? character.data.combat.currentHp}/
                  {token.maxHp ?? character.data.combat.maxHp}
                </span>
                <span className="combat-token-label-detail">
                  Speed{" "}
                  {getTokenSpeedFt(token, character, null, tokenSpeedOptions)} ft
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
            {isExpanded && isHiddenForDm ? (
              <span className="combat-token-label-detail combat-token-hidden-label">Hidden</span>
            ) : null}
            {isExpanded && token.kind === "marker" && token.tooltip ? (
              <span className="combat-token-label-detail combat-token-marker-tooltip">
                {token.tooltip}
              </span>
            ) : null}
          </div>
          {overlappingMarkerTooltips.map((marker) => (
            <div key={marker.id} className="combat-token-marker combat-token-marker-underfoot-wrap">
              <div className="combat-token-label">
                <span className="combat-token-label-name">
                  {getCombatTokenDisplayLabel(marker)}
                </span>
                <span className="combat-token-label-detail combat-token-marker-tooltip">
                  {marker.tooltip}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderPendingMoveGhost() {
    const preview = pendingOpportunityMovePreview;
    if (!preview) return null;
    const { token, x, y } = preview;
    const portraitUrl = resolveTokenPortraitUrl(supabase, token);
    const displayLabel = getCombatTokenDisplayLabel(token);

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
              {displayLabel.slice(0, 1)}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderCombatGrid(fullscreen: boolean) {
    return (
      <div
        ref={gridRef}
        className={`combat-grid${fullscreen ? " combat-grid-fullscreen" : ""}${draggingTokenId ? " combat-grid-dragging" : ""}${movementMode ? " combat-grid-movement-mode" : ""}${attackTargeting ? " combat-grid-targeting-mode" : ""}${objectInteractionMode ? " combat-grid-object-interaction-mode" : ""}${collisionEditMode ? " combat-grid-collision-mode" : ""}${measureMode ? " combat-grid-measure-mode" : ""}`}
        style={{
          ["--grid-width" as string]: combatState.gridWidth,
          ["--grid-height" as string]: combatState.gridHeight,
          ["--grid-aspect-ratio" as string]: `${combatState.gridWidth} / ${combatState.gridHeight}`,
        }}
        onPointerMove={(event) => {
          updateHoverFromPointer(event.clientX, event.clientY);
        }}
        onPointerUpCapture={attackTargeting ? handleGridTargetingPointerUp : undefined}
        onPointerLeave={() => {
          clearTokenHover();
        }}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            clearTokenHover();
          }
        }}
        onClick={(event) => {
          if (!isDm || collisionEditMode) return;
          if (event.target === event.currentTarget) {
            if (suppressNextGridDeselectRef.current) {
              suppressNextGridDeselectRef.current = false;
              return;
            }
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
        {collisionEditMode && isDm ? (
          <CombatCollisionOverlay
            gridWidth={combatState.gridWidth}
            gridHeight={combatState.gridHeight}
            blockedKeys={collisionDraft}
            dragStart={collisionDragStart}
            dragEnd={collisionDragEnd}
            dragRemoving={collisionDragRemoving}
            onPointerDown={handleCollisionPointerDown}
          />
        ) : null}
        {showCollisionDragHint ? (
          <CombatCollisionOverlay
            gridWidth={combatState.gridWidth}
            gridHeight={combatState.gridHeight}
            blockedKeys={savedBlockedKeys}
            translucent
          />
        ) : null}
        {gridRenderTokens.map((token) => renderToken(token))}
        {renderPendingMoveGhost()}
        {attackTargeting && !collisionEditMode && actingToken && userControlsCombat && targetingHighlights ? (
          <CombatTargetingOverlay
            gridWidth={combatState.gridWidth}
            gridHeight={combatState.gridHeight}
            attacker={actingToken}
            attack={attackTargeting.attack}
            state={combatState}
            validCells={targetingHighlights.validCells}
            rangedCellZones={targetingHighlights.rangedCellZones}
            hoveredCell={hoveredTargetingCell}
            previewCenter={null}
            onPointerMove={updateHoverFromPointer}
            onPointerLeave={handleTargetingPointerLeave}
            onCellHover={setHoveredTargetingCell}
          />
        ) : null}
        {objectInteractionMode &&
        !collisionEditMode &&
        actingToken &&
        userControlsCombat &&
        (adjacentPickupMarkers.length > 0 || actingTokenHasEquippableItems) ? (
          <CombatObjectInteractionOverlay
            pickupMarkers={adjacentPickupMarkers}
            selfToken={actingTokenHasEquippableItems ? actingToken : null}
          />
        ) : null}
        {movementMode && !collisionEditMode && actingToken && userControlsCombat ? (
          <CombatMovementOverlay
            gridWidth={combatState.gridWidth}
            gridHeight={combatState.gridHeight}
            token={actingToken}
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
        {measureMode && !collisionEditMode ? (
          <CombatMeasureOverlay
            gridWidth={combatState.gridWidth}
            gridHeight={combatState.gridHeight}
            tileFeet={combatState.tileFeet}
            startCell={measureStartCell}
            hoveredCell={measureHoverCell}
            onCellHover={setMeasureHoverCell}
            onCellClick={handleMeasureCellClick}
          />
        ) : null}
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
            <Tooltip content={battleOver ? "Battle over" : `Turn ${combatState.turn.round}`}>
              <div
                className="combat-turn-round combat-turn-portrait-wrap-tooltip"
                aria-label={battleOver ? "Battle over" : `Turn ${combatState.turn.round}`}
              >
                {battleOver ? "-" : combatState.turn.round}
              </div>
            </Tooltip>
          ) : null}
          {initiativeTokens.map((token) => {
            const portraitUrl = resolveTokenPortraitUrl(supabase, token);
            const displayLabel = getCombatTokenDisplayLabel(token);
            const initiativeResult = combatState.initiative.results[token.id];
            const isHiddenForDm = isHiddenEnemy(token) && isDm;
            const labelLetter =
              token.kind === "enemy" ? getEnemyTokenLabelLetter(token) : null;
            const turnTooltip =
              isDm && initiativeResult
                ? formatInitiativeResultTooltip(displayLabel, initiativeResult)
                : displayLabel;

            const portrait = (
              <div className="combat-turn-portrait-frame">
                {portraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={portraitUrl}
                    alt={displayLabel}
                    className="combat-turn-portrait"
                    draggable={false}
                  />
                ) : (
                  <div
                    className="combat-turn-portrait combat-turn-portrait-fallback"
                    aria-label={displayLabel}
                  >
                    {labelLetter ?? displayLabel.slice(0, 1)}
                  </div>
                )}
                {labelLetter && portraitUrl ? (
                  <span className="combat-turn-portrait-letter" aria-hidden>
                    {labelLetter}
                  </span>
                ) : null}
              </div>
            );

            return (
              <div
                key={token.id}
                className={`combat-turn-portrait-wrap combat-turn-portrait-wrap-tooltip combat-turn-${token.kind}${isHiddenForDm ? " combat-turn-hidden-enemy" : ""}${!battleOver && token.id === currentTurnTokenId ? " combat-turn-portrait-active" : ""}`}
              >
                <Tooltip content={turnTooltip}>{portrait}</Tooltip>
              </div>
            );
          })}
        </div>

        <div className="combat-main">
          <div className="combat-board-area">
            <div className="combat-toolbar combat-toolbar-header">
              <div className="combat-toolbar-top">
                <div className="combat-toolbar-meta">
                  {isDm ? (
                    <input
                      type="text"
                      className="combat-title combat-title-input"
                      key={boardTitle}
                      defaultValue={boardTitle}
                      aria-label="Combat board title"
                      onBlur={(event) => void handleBoardTitleCommit(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                    />
                  ) : (
                    <h2 className="combat-title">{boardTitle}</h2>
                  )}
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
                <div className="combat-board-view-actions">
                  {isDm ? (
                    <label
                      className={`candy-btn combat-auto-approve-toggle${autoApprove ? " candy-btn-active" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={autoApprove}
                        onChange={(event) => handleToggleAutoApprove(event.target.checked)}
                        aria-label="Auto-approve player actions"
                      />
                      <span>Auto-approve</span>
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="candy-btn combat-expand-btn"
                    onClick={() => setBoardExpanded(true)}
                  >
                    Expand
                  </button>
                  <button
                    type="button"
                    className={`candy-btn combat-measure-btn${measureMode ? " candy-btn-active" : ""}`}
                    disabled={!measureMode && !canUseMeasure}
                    onClick={handleToggleMeasureMode}
                  >
                    Measure
                  </button>
                </div>
              </div>
              {battleActive && !playerAbsentFromCombatBoard ? (
                <div className="combat-toolbar-panels">
                  {!battleOver && userOaSubmittedPending ? (
                    <div className="combat-turn-waiting combat-attack-waiting">
                      <p className="combat-turn-waiting-text combat-attack-waiting-text">
                        Opportunity attack pending review…
                      </p>
                    </div>
                  ) : !battleOver && userCanTakeOpportunityAttack ? (
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
                  ) : !battleOver && userControlsCombat && provokingMovePending ? (
                    <div className="combat-turn-waiting combat-attack-waiting">
                      <p className="combat-turn-waiting-text combat-attack-waiting-text">
                        Waiting for opportunity attacks…
                      </p>
                    </div>
                  ) : userControlsCombat ? (
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
                              objectInteractionMode ||
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
                            key={actingToken?.id ?? "no-acting-token"}
                            options={currentTurnOptionGroups.actions}
                            onSelectOption={handleSelectCombatOption}
                            selectedOptionId={selectedActionOptionId}
                            pendingOptionId={pendingOptionId}
                            selectionLocked={turnActionsLocked}
                          />
                        ) : null}
                        {objectInteractionMode && freeObjectInteractionUsed && !actionUsed ? (
                          <p className="combat-object-interaction-hint">
                            This pickup will use your action.
                          </p>
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
                  ) : !battleOver && opportunityAttacksPending ? (
                    <div className="combat-turn-waiting combat-attack-waiting">
                      <p className="combat-turn-waiting-text combat-attack-waiting-text">
                        Waiting for opportunity attacks…
                      </p>
                    </div>
                  ) : battleOver ? (
                    <div className="combat-turn-waiting combat-attack-waiting">
                      <p className="combat-turn-waiting-text combat-attack-waiting-text">
                        Select a character you control to move or act.
                      </p>
                    </div>
                  ) : (
                    <div className="combat-turn-waiting combat-attack-waiting">
                      <p className="combat-turn-waiting-text combat-attack-waiting-text">
                        Waiting for{" "}
                        {currentTurnToken
                          ? getCombatTokenDisplayLabel(currentTurnToken)
                          : "the active combatant"}
                        &apos;s
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
                    className={`candy-btn${collisionEditMode ? " candy-btn-active" : ""}`}
                    onClick={() => void handleToggleCollisionEditMode()}
                    disabled={(!collisionEditMode && !canUseCollisionEdit) || savingCollision}
                  >
                    {savingCollision ? "Saving…" : "Collision"}
                  </button>
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
                    onClick={() => setAddMarkerOpen(true)}
                  >
                    Add marker
                  </button>
                  <button
                    type="button"
                    className="candy-btn"
                    onClick={() => {
                      if (selectedMarker) setEditMarkerOpen(true);
                      else if (selectedEnemy) setEditEnemyOpen(true);
                    }}
                    disabled={!canEditSelectedToken}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="candy-btn"
                    onClick={handleRemoveSelected}
                    disabled={!selectedToken}
                  >
                    Remove
                  </button>
                  {preBattleSetup ? (
                    <>
                      <button
                        type="button"
                        className="candy-btn"
                        onClick={() => handleSaveEncounterClick()}
                        disabled={savingEncounter}
                      >
                        {savingEncounter ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        className="candy-btn"
                        onClick={() => setEncounterLoadOpen(true)}
                      >
                        Load
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="combat-hp-adjust-group">
                        <button
                          type="button"
                          className="candy-btn"
                          disabled={
                            !selectedToken ||
                            selectedToken.kind === "marker" ||
                            !hpAmountValid ||
                            applyingHp
                          }
                          onClick={() => void handleApplyHpToSelected(1)}
                        >
                          {applyingHp ? "…" : "Heal"}
                        </button>
                        <input
                          type="number"
                          className="combat-hp-amount-input"
                          min={1}
                          value={hpAmount}
                          onChange={(event) => setHpAmount(event.target.value)}
                          disabled={
                            !selectedToken ||
                            selectedToken.kind === "marker" ||
                            applyingHp
                          }
                          aria-label="HP amount"
                        />
                        <button
                          type="button"
                          className="candy-btn"
                          disabled={
                            !selectedToken ||
                            selectedToken.kind === "marker" ||
                            !hpAmountValid ||
                            applyingHp
                          }
                          onClick={() => void handleApplyHpToSelected(-1)}
                        >
                          {applyingHp ? "…" : "Damage"}
                        </button>
                      </div>
                      <div className="combat-hp-adjust-group">
                        <button
                          type="button"
                          className="candy-btn"
                          disabled={
                            !canAdjustTurnMovement ||
                            adjustingMovement ||
                            movementUsedFeet === 0
                          }
                          onClick={() => void handleAdjustTurnMovement(-5)}
                        >
                          {adjustingMovement ? "…" : "+5 ft"}
                        </button>
                        <button
                          type="button"
                          className="candy-btn"
                          disabled={!canAdjustTurnMovement || adjustingMovement}
                          onClick={() => void handleAdjustTurnMovement(5)}
                        >
                          {adjustingMovement ? "…" : "-5 ft"}
                        </button>
                        <button
                          type="button"
                          className="candy-btn"
                          disabled={
                            !canAdjustTurnMovement ||
                            grantingAction ||
                            !actionUsed
                          }
                          onClick={() => void handleGrantTurnAction()}
                        >
                          {grantingAction ? "…" : "Grant action"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            <div className="combat-grid-shell">
              {!boardExpanded ? renderCombatGrid(false) : null}
            </div>
            {isDm && battleActive && dmApprovalTrayAttacks.length > 0 ? (
              <CombatDmApprovalTray
                pendingAttacks={dmApprovalTrayAttacks}
                tokens={combatState.tokens}
                charactersById={charactersById}
                enemiesBySlug={enemiesBySlug}
                classCatalog={classCatalog}
                resolveDisadvantageLabel={resolvePendingDisadvantageLabel}
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
      <MarkerDialog
        open={addMarkerOpen}
        onOpenChange={setAddMarkerOpen}
        mode="add"
        catalogItems={catalogItems}
        onSubmit={(values) => void handleAddMarker(values)}
      />
      <MarkerDialog
        open={editMarkerOpen}
        onOpenChange={setEditMarkerOpen}
        mode="edit"
        catalogItems={catalogItems}
        initialName={selectedMarker?.name ?? ""}
        initialTooltip={selectedMarker?.tooltip ?? ""}
        initialHasCollision={selectedMarker?.hasCollision ?? false}
        initialIsObject={selectedMarker?.isObject ?? false}
        initialItemPickup={selectedMarker?.itemPickup ?? false}
        initialPickupItemId={selectedMarker?.pickupItemId}
        initialPickupQuantity={selectedMarker?.pickupQuantity ?? 1}
        initialPortraitPath={selectedMarker?.portraitPath ?? null}
        onSubmit={(values) => void handleEditMarker(values)}
      />
      <EnemyTokenDialog
        open={editEnemyOpen}
        onOpenChange={setEditEnemyOpen}
        defaultLabel={selectedEnemy?.label ?? ""}
        catalogName={
          selectedEnemy?.enemySlug
            ? enemiesBySlug[selectedEnemy.enemySlug]?.name ?? selectedEnemy.name
            : selectedEnemy?.name ?? ""
        }
        initialDisplayName={selectedEnemy?.displayName ?? ""}
        initialHidden={selectedEnemy?.hidden ?? false}
        onSubmit={(values) => void handleEditEnemy(values)}
      />
      {attackSubmitDraft ? (
        <CombatAttackSubmitModal
          attack={attackSubmitDraft.attack}
          optionName={attackSubmitDraft.option.name}
          targets={attackSubmitDraft.targets}
          attackerToken={attackSubmitDraft.attackerToken}
          combatState={combatState}
          attackDisadvantageByTokenId={attackSubmitDraft.attackDisadvantageByTokenId ?? {}}
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
          saveModifier={playerSaveModifier}
          damageType={playerSaveContext.pending.damageType}
          saveHalfDamageOnSuccess={playerSaveContext.pending.saveHalfDamageOnSuccess}
          submitting={submittingSaveId === playerSaveContext.pending.id}
          onCancel={() => {}}
          onSubmit={(saveRoll, saveTotal, saveRoll2) =>
            void handleSubmitPlayerSave(saveRoll, saveTotal, saveRoll2)
          }
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
      <CombatBoardFullscreen open={boardExpanded} onClose={() => setBoardExpanded(false)}>
        {renderCombatGrid(true)}
      </CombatBoardFullscreen>
      {helpTargetPickerAllies ? (
        <CombatHelpTargetModal
          allies={helpTargetPickerAllies}
          resolvePortraitUrl={(token) => resolveTokenPortraitUrl(supabase, token)}
          onSelect={() => setHelpTargetPickerAllies(null)}
          onCancel={() => setHelpTargetPickerAllies(null)}
        />
      ) : null}
      {equipmentChangeOpen && actingTokenCharacter ? (
        <CombatEquipmentChangeModal
          initialItems={actingTokenCharacter.data.inventory.items}
          catalogItems={catalogItems}
          speciesDisplayName={actingTokenCharacter.data.basicInfo.species ?? ""}
          turn={
            battleOver
              ? getBattleOverTurnDisplay()
              : {
                  freeObjectInteractionUsed,
                  actionUsed,
                }
          }
          submitting={submittingEquipmentChange}
          onConfirm={(nextItems) => void handleConfirmEquipmentChange(nextItems)}
          onCancel={() => setEquipmentChangeOpen(false)}
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
      {pendingShellDefenseConfirm ? (
        <CombatShellDefenseConfirmModal
          onConfirm={() => void handleConfirmShellDefense()}
          onCancel={() => setPendingShellDefenseConfirm(false)}
        />
      ) : null}
      {pendingLayOnHands && actingToken && actingTokenCharacter ? (
        <CombatLayOnHandsModal
          actorToken={actingToken}
          actorCharacter={actingTokenCharacter}
          combatState={combatState}
          partyCharacters={localCharacters}
          featureCatalogs={featureCatalogs}
          onConfirm={handleConfirmLayOnHands}
          onClose={() => setPendingLayOnHands(false)}
        />
      ) : null}
      {pendingOtherActionsConfirm ? (
        <CombatOtherActionsModal
          onCancel={() => setPendingOtherActionsConfirm(false)}
          onUse={() => void handleConfirmOtherActions()}
        />
      ) : null}
      {pendingOpportunityAttackMove ? (
        <CombatOpportunityAttackModal
          reactorLabels={pendingOpportunityAttackMove.reactorLabels}
          onConfirm={() => void handleConfirmOpportunityAttackMove()}
          onCancel={() => setPendingOpportunityAttackMove(null)}
        />
      ) : null}
      {saveEncounterNameOpen ? (
        <EncounterNameModal
          title="Save encounter"
          description="Enter a name for this encounter setup."
          initialName={pendingSaveName ?? defaultSaveEncounterName}
          submitting={savingEncounter}
          onCancel={() => {
            if (!savingEncounter) {
              setSaveEncounterNameOpen(false);
              setPendingSaveName(null);
            }
          }}
          onSubmit={(name) => void handleSaveEncounterSubmit(name)}
        />
      ) : null}
      {overwriteConfirmEncounter ? (
        <EncounterOverwriteConfirmModal
          encounter={overwriteConfirmEncounter}
          enemiesBySlug={enemiesBySlug}
          submitting={savingEncounter}
          onCancel={() => {
            if (savingEncounter) return;
            setOverwriteConfirmEncounter(null);
            setSaveEncounterNameOpen(true);
          }}
          onConfirm={() => void handleConfirmOverwriteExistingEncounter()}
        />
      ) : null}
      <ConfirmModal
        open={confirmRequest != null}
        title={confirmRequest?.title ?? ""}
        description={confirmRequest?.description ?? ""}
        confirmLabel={confirmBusy ? "…" : (confirmRequest?.confirmLabel ?? "Confirm")}
        confirmDisabled={confirmBusy}
        destructive={confirmRequest?.destructive}
        onCancel={() => {
          if (confirmBusy) return;
          pendingNavigationHrefRef.current = null;
          setConfirmRequest(null);
        }}
        onConfirm={() => void handleConfirmModalConfirm()}
      />
      <AlertModal
        open={alertMessage != null}
        message={alertMessage ?? ""}
        onClose={() => setAlertMessage(null)}
      />
      <EncounterLoadDialog
        open={encounterLoadOpen}
        onOpenChange={setEncounterLoadOpen}
        enemiesBySlug={enemiesBySlug}
        onLoad={(encounter, options) => void handleLoadEncounter(encounter, options)}
      />
      {characterSlotToken && isCharacterPlaceholder(characterSlotToken) && isDm ? (
        <CharacterSlotAssignModal
          tokenLabel={getCombatTokenDisplayLabel(characterSlotToken)}
          characters={localCharacters}
          presentCharacterIds={presentCharacterIds}
          submitting={assigningCharacterSlot}
          onAssign={(characterId) => void handleAssignCharacterSlot(characterId)}
          onRemove={() => void handleRemoveCharacterSlot()}
          onCancel={() => setCharacterSlotTokenId(null)}
        />
      ) : null}
      {characterSlotToken &&
      isCharacterPlaceholder(characterSlotToken) &&
      !isDm &&
      ownedCharacter ? (
        <CharacterSlotClaimModal
          characterName={ownedCharacter.name}
          claiming={assigningCharacterSlot}
          onConfirm={() => void handleClaimCharacterSlot()}
          onCancel={() => setCharacterSlotTokenId(null)}
        />
      ) : null}
    </div>
  );
}
