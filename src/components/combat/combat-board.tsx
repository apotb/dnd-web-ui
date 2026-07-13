"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  addAlliesToState,
  addEnemyToState,
  addMarkerToState,
  addPartyMembersToState,
  removeTokenFromState,
  resetCombatBoard,
  resolveTokenEnemyData,
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
import { applyCombatHpDelta } from "@/lib/character/combat-derivation";
import { saveCharacterData } from "@/lib/character/save-character-data";
import { calculateAcBreakdown, formatAcTooltip } from "@/lib/character/ac-derivation";
import {
  applyHpDelta,
  combatStatePersistAwaitFingerprint,
  combatTokenLayoutFingerprint,
  getTokenHpDisplay,
  mergeLiveStatePreservingDraftTokens,
  parsePositiveHpAmount,
  patchTokenHpFromDamage,
} from "@/lib/combat/hp-adjust";
import {
  clearXpPool,
  creditXpForDefeatedEnemies,
  distributeXpPool,
} from "@/lib/combat/xp-pool";
import {
  cleanupEncounterOwnedImages,
  cloneEncounterPayloadImages,
} from "@/lib/combat/encounter-image-storage";
import {
  removeCombatImageIfUnreferenced,
  resolveCombatImageUrl,
  uploadCombatBackground,
  uploadMarkerPortrait,
} from "@/lib/combat/storage";
import { getCharacterPortraitUrl } from "@/lib/character/portrait-storage";
import { preloadImageUrls } from "@/lib/image-preload";
import type { ParsedCharacter } from "@/lib/character/utils";
import {
  applyHpPoolFeature,
  getEffectiveMaxHp,
  type HpPoolMode,
} from "@/lib/dnd/mechanical-features";
import type { HpPoolCombatTarget } from "@/lib/combat/combat-mechanical-actions";
import { speciesSubtitleLabel } from "@/lib/content/catalog-tooltip";
import { clampInspiration } from "@/lib/dnd/calculations";
import { PHB_SPECIES } from "@/lib/dnd/phb/species";
import {
  persistCombatState,
  useRealtimeCombatState,
} from "@/lib/hooks/use-realtime-combat-state";
import { useRealtimeCharacters } from "@/lib/hooks/use-realtime-characters";
import { useRealtimePartyData, refreshCampaignPartyData } from "@/lib/hooks/use-realtime-party-data";
import { getAllyRaceClassLine, listPartyAllies, syncAllyCombatToPartyData } from "@/lib/dnd/party-allies";
import type { PartyAlly, PartyData } from "@/lib/schemas/party";
import { useShowDmUi } from "@/components/layout/dm-view-provider";
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
import { AddAllyDialog } from "@/components/combat/add-ally-dialog";
import { AllyTokenDialog, type AllyTokenDialogValues } from "@/components/combat/ally-token-dialog";
import {
  CharacterSlotAssignModal,
  CharacterSlotClaimModal,
} from "@/components/combat/character-slot-modal";
import { EnemyTokenDialog, type EnemyTokenDialogValues } from "@/components/combat/enemy-token-dialog";
import { EncounterLoadDialog } from "@/components/combat/encounter-load-dialog";
import { EncounterNameModal } from "@/components/combat/encounter-name-modal";
import { EncounterOverwriteConfirmModal } from "@/components/combat/encounter-overwrite-confirm-modal";
import { MarkerDialog, type MarkerDialogValues } from "@/components/combat/marker-dialog";
import { DeathSaveRollModal } from "@/components/character/death-save-roll-modal";
import {
  CombatActionPanel,
  CombatBonusActionPanel,
  CombatMultiattackPanel,
  CombatSavingThrowsPanel,
} from "@/components/combat/combat-action-panel";
import { CombatMultiattackBranchModal } from "@/components/combat/combat-multiattack-branch-modal";
import { CombatEndTurnConfirmModal } from "@/components/combat/combat-end-turn-confirm-modal";
import { CombatEndTurnPanel } from "@/components/combat/combat-end-turn-panel";
import { CombatMovePanel } from "@/components/combat/combat-move-panel";
import { CombatBoardFullscreen } from "@/components/combat/combat-board-fullscreen";
import { CombatLosOverlay } from "@/components/combat/combat-los-overlay";
import { CombatMeasureOverlay } from "@/components/combat/combat-measure-overlay";
import { CombatMovementOverlay } from "@/components/combat/combat-movement-overlay";
import { CombatCollisionOverlay } from "@/components/combat/combat-collision-overlay";
import { CombatHelpTargetModal } from "@/components/combat/combat-help-target-modal";
import { CombatStabilizeTargetModal } from "@/components/combat/combat-stabilize-target-modal";
import { StabilizeActionModal } from "@/components/combat/stabilize-action-modal";
import { CombatDashConfirmModal } from "@/components/combat/combat-dash-confirm-modal";
import { CombatShellDefenseConfirmModal } from "@/components/combat/combat-shell-defense-confirm-modal";
import { CombatHpPoolModal } from "@/components/combat/combat-hp-pool-modal";
import { CombatXpModal } from "@/components/combat/combat-xp-modal";
import { CombatOtherActionsModal } from "@/components/combat/combat-other-actions-modal";
import { CombatStatesModal } from "@/components/combat/combat-states-modal";
import { CombatSpellCastModal } from "@/components/combat/combat-spell-cast-modal";
import {
  CombatSpellPickerModal,
  type CombatSpellPickerSelection,
} from "@/components/combat/combat-spell-picker-modal";
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
  getAdjacentDyingAllyTokens,
  getCombatOptionGroupsForToken,
  getOpportunityAttackOptionsForToken,
  isAttackTargetingOption,
  isLeaveAreaOption,
  isOtherActionsOption,
  isDashActionOption,
  isDisengageActionOption,
  isEmergeFromShellOption,
  isGetUpOption,
  isHelpActionOption,
  isHpPoolCombatOptionKind,
  isEnemyStatBlockActionOption,
  isImplementedCombatOption,
  isSavingThrowsOption,
  isShellDefenseEnterOption,
  isSpellCastOption,
  isSpellcastingEntryOption,
  isStabilizeActionOption,
  isUseObjectActionOption,
  COMBAT_USE_OBJECT_OPTION_ID,
  type CombatOption,
} from "@/lib/combat/combat-options";
import {
  applyMultiattackBranchSelection,
  applyMultiattackTurnStateToCombat,
  buildInitialMultiattackRemaining,
} from "@/lib/combat/multiattack";
import { parseEnemyActions } from "@/lib/combat/enemy-action-parser";
import { leaveCombatArea } from "@/lib/combat/battle-over-actions";
import {
  markBattleAmmoPrepared,
  preparePartyBattleAmmo,
  unloadPartyBattleAmmo,
} from "@/lib/combat/battle-start-ammo";
import { getBattleOverTurnDisplay, isBattleOver } from "@/lib/combat/battle-over";
import {
  recordCombatAmmoRefill,
  recordCombatActionUsed,
  recordCombatBonusActionUsed,
  recordCombatDash,
  recordCombatDisengage,
  recordCombatGetUp,
  recordCombatEquipmentChange,
  recordCombatHelp,
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
  submitCombatSpellCast,
  submitCombatDmSaveRolls,
  submitCombatSaveRoll,
  type CharacterHpUpdate,
} from "@/lib/combat/attack-actions";
import {
  recordCombatFeatureEffectEnter,
  recordCombatFeatureEffectExit,
} from "@/lib/combat/feature-effect-actions";
import {
  buildTokenStatusContext,
  getTokenStatusEntries,
  getTokenStatusTooltip,
  isTokenIncapacitated,
  isTokenRestrictedByEffects,
  SHELL_DEFENSE_EFFECT_ID,
} from "@/lib/combat/feature-effects";
import {
  finalizeDmConditionEdit,
  getConditionsForToken,
  getDmProtectedConditionSlugs,
  syncTokenConditionsAfterHpChange,
} from "@/lib/combat/combat-conditions";
import {
  buildCrawlCombatOption,
  buildGetUpCombatOption,
  getGetUpMovementCostForToken,
  isTokenProne,
  removeProneFromCharacterData,
} from "@/lib/combat/prone-actions";
import { persistCharacterDeath } from "@/lib/combat/character-death-actions";
import { applyStabilize, hasDeadCondition, syncDeathSavesAfterDeadRemoved } from "@/lib/dnd/dying-state";
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
  buildVisionCellBands,
  getTargetingHighlights,
  getAttackRollDisadvantage,
  getAttackRollAdvantage,
  formatAttackDisadvantageLabel,
  formatAttackAdvantageLabel,
  isTokenOnGrid,
  parseAttackRangeSpec,
} from "@/lib/combat/targeting";
import {
  applyRectangleToBlockedSet,
  areBlockedCellsEqual,
  blockedCellsFromSet,
  buildBlockedCellSet,
  type BlockedCell,
} from "@/lib/combat/collision";
import {
  type DerivedAttack,
} from "@/lib/dnd/attacks";
import {
  formatDeclareCastSpellSubtitle,
  formatSpellPickerCombatTooltip,
  resolveCombatCastableSpell,
  type CombatCastableSpell,
} from "@/lib/dnd/combat-spells";
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
import { getHelpAttackAdvantage, getHelpAttackAdvantageLabel } from "@/lib/combat/help";
import { endCombatTurn } from "@/lib/combat/turn-actions";
import {
  applyActionGranted,
  applyDeathSaveRolled,
  canAdvanceTurnWithDeathSave,
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
import { parseSavedEncounterData } from "@/lib/schemas/saved-encounter";
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
  initialPartyData: PartyData;
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

/** Lower renders first (underneath); party and allies on top, then enemies, then markers. */
function tokenStackOrder(kind: CombatToken["kind"]): number {
  if (kind === "party" || kind === "ally") return 2;
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
  initialPartyData,
  characters,
  enemies,
  isDm,
  userId,
  ownedCharacterId = null,
}: CombatBoardProps) {
  const router = useRouter();
  const showDmUi = useShowDmUi(isDm);
  const enemiesBySlug = useMemo(
    () => Object.fromEntries(enemies.map((enemy) => [enemy.slug, enemy])),
    [enemies]
  );

  const liveCharacters = useRealtimeCharacters(campaignId, characters, isDm, {
    includeDmData: showDmUi,
  });
  const [localCharacters, setLocalCharacters] = useState(liveCharacters);
  const charactersById = useMemo(
    () => Object.fromEntries(localCharacters.map((character) => [character.id, character])),
    [localCharacters]
  );
  const partyData = useRealtimePartyData(campaignId, initialPartyData);
  const tokenStatusContext = useMemo(
    () => buildTokenStatusContext(localCharacters, partyData.allies),
    [localCharacters, partyData.allies]
  );
  const ownedCharacter = useMemo(
    () => (ownedCharacterId ? charactersById[ownedCharacterId] ?? null : null),
    [charactersById, ownedCharacterId]
  );

  useEffect(() => {
    setLocalCharacters(liveCharacters);
  }, [liveCharacters]);

  const liveState = useRealtimeCombatState(campaignId, initialCombatState);
  const partyDataRef = useRef(partyData);
  partyDataRef.current = partyData;
  const allies = useMemo(() => listPartyAllies(partyData), [partyData]);
  const alliesById = useMemo(
    () => Object.fromEntries(partyData.allies.map((ally) => [ally.id, ally])),
    [partyData.allies]
  );
  const resolveEnemyDataForToken = useCallback(
    (token: CombatToken | null | undefined) =>
      token ? resolveTokenEnemyData(token, enemiesBySlug, alliesById) : null,
    [alliesById, enemiesBySlug]
  );
  const [draft, setDraft] = useState(liveState);
  const [addOpen, setAddOpen] = useState(false);
  const [addPartyOpen, setAddPartyOpen] = useState(false);
  const [addAllyOpen, setAddAllyOpen] = useState(false);
  const [allyPickerRoster, setAllyPickerRoster] = useState<PartyAlly[] | null>(null);
  const [addMarkerOpen, setAddMarkerOpen] = useState(false);
  const [editMarkerOpen, setEditMarkerOpen] = useState(false);
  const [editEnemyOpen, setEditEnemyOpen] = useState(false);
  const [editAllyOpen, setEditAllyOpen] = useState(false);
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
    spellCastSlotLevel?: number;
  } | null>(null);
  const [attackSubmitDraft, setAttackSubmitDraft] = useState<{
    option: CombatOption;
    attack: DerivedAttack;
    targets: CombatToken[];
    aoeCenter: { x: number; y: number } | null;
    isOpportunityAttack?: boolean;
    attackerToken?: CombatToken;
    attackDisadvantageByTokenId?: Record<string, boolean>;
    attackAdvantageByTokenId?: Record<string, boolean>;
    spellCastSlotLevel?: number;
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
  const battleAmmoPrepInFlightRef = useRef(false);
  const prevBattleActiveRef = useRef(false);
  const [hoveredMovementCell, setHoveredMovementCell] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pendingDashDestination, setPendingDashDestination] =
    useState<ReachableDestination | null>(null);
  const [pendingDashActionConfirm, setPendingDashActionConfirm] = useState(false);
  const [pendingShellDefenseConfirm, setPendingShellDefenseConfirm] = useState(false);
  const [pendingHpPoolFeatureId, setPendingHpPoolFeatureId] = useState<string | null>(null);
  const [pendingOtherActionsConfirm, setPendingOtherActionsConfirm] = useState(false);
  const [multiattackBranchDismissed, setMultiattackBranchDismissed] = useState(false);
  const [pendingSpellCast, setPendingSpellCast] = useState<CombatOption | null>(null);
  const [pendingSpellcasting, setPendingSpellcasting] = useState<{
    castingCost: "action" | "bonus-action";
    preselectedEntry?: CombatCastableSpell;
  } | null>(null);
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
  const [deathSaveModal, setDeathSaveModal] = useState<{
    characterId: string;
    tokenId: string;
  } | null>(null);
  const pendingCombatDeathRef = useRef<{
    characterId: string;
    nextData: import("@/lib/schemas/character").CharacterData;
  } | null>(null);
  const [stabilizeTargetPicker, setStabilizeTargetPicker] = useState<{
    allies: CombatToken[];
    viaSpell: boolean;
  } | null>(null);
  const [stabilizeModal, setStabilizeModal] = useState<{
    targetToken: CombatToken;
    viaSpell: boolean;
  } | null>(null);
  const [hpAmount, setHpAmount] = useState("1");
  const [applyingHp, setApplyingHp] = useState(false);
  const [adjustingMovement, setAdjustingMovement] = useState(false);
  const [grantingAction, setGrantingAction] = useState(false);
  const [statesModalOpen, setStatesModalOpen] = useState(false);
  const [savingStates, setSavingStates] = useState(false);
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
  const [losMode, setLosMode] = useState(false);
  const [boardExpanded, setBoardExpanded] = useState(false);
  const [xpModalOpen, setXpModalOpen] = useState(false);
  const [distributingXp, setDistributingXp] = useState(false);
  const prevBattleOverRef = useRef<boolean | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const draggingTokenIdRef = useRef<string | null>(null);
  const suppressNextGridDeselectRef = useRef(false);
  const collisionPointerIdRef = useRef<number | null>(null);
  const combatStateRef = useRef<CombatState>(initialCombatState);
  const attackTargetingRef = useRef(attackTargeting);
  attackTargetingRef.current = attackTargeting;
  const dmTokenSelectionBlockedRef = useRef(false);
  const supabase = useMemo(() => createClient(), []);

  const awaitingPersistFingerprintRef = useRef<string | null>(null);
  const localLayoutDirtyRef = useRef(false);

  const dmUsesDraftBoard =
    isDm && (showDmUi || !isBattleActive(draft));
  const combatState = dmUsesDraftBoard ? draft : liveState;

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
    !movementMode &&
    !attackTargeting &&
    !draggingTokenId &&
    !startingInitiative &&
    !measureMode &&
    !losMode;

  const canUseMeasure =
    !movementMode && !attackTargeting && !draggingTokenId && !collisionEditMode;

  const canUseLos =
    !movementMode && !attackTargeting && !draggingTokenId && !collisionEditMode;

  const savedBlockedKeys = useMemo(
    () => buildBlockedCellSet(combatState.blockedCells ?? []),
    [combatState.blockedCells]
  );

  const showCollisionDragHint =
    showDmUi && !!draggingTokenId && !collisionEditMode && savedBlockedKeys.size > 0;

  const characterRosterKey = useMemo(
    () =>
      localCharacters
        .map((character) => character.id)
        .sort()
        .join(","),
    [localCharacters]
  );

  const xpModalParticipantIds = useMemo(() => {
    const registered = combatState.battleParticipantCharacterIds ?? [];
    if (registered.length > 0) return registered;
    return combatState.tokens
      .filter((token) => token.kind === "party" && token.characterId)
      .map((token) => token.characterId!);
  }, [combatState.battleParticipantCharacterIds, combatState.tokens]);

  const persist = useCallback(
    async (next: CombatState): Promise<string | null> => {
      if (!isDm) return null;
      awaitingPersistFingerprintRef.current = combatStatePersistAwaitFingerprint(next);
      setDraft(next);

      const syncedPartyData = syncAllyCombatToPartyData(partyDataRef.current, next);
      const partyDataChanged = syncedPartyData !== partyDataRef.current;

      const error = await persistCombatState(campaignId, next);
      if (error) {
        awaitingPersistFingerprintRef.current = null;
        return error;
      }

      if (partyDataChanged) {
        const supabase = createClient();
        const { error: partyError } = await supabase
          .from("campaigns")
          .update({ party_data: syncedPartyData })
          .eq("id", campaignId);
        if (partyError) {
          awaitingPersistFingerprintRef.current = null;
          return partyError.message;
        }
      }

      return null;
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
      const liveFingerprint = combatStatePersistAwaitFingerprint(liveState);
      const prevFingerprint = combatStatePersistAwaitFingerprint(prev);
      const liveLayout = combatTokenLayoutFingerprint(liveState);
      const prevLayout = combatTokenLayoutFingerprint(prev);

      if (awaited && liveFingerprint === awaited) {
        awaitingPersistFingerprintRef.current = null;
        if (prevLayout === liveLayout) {
          localLayoutDirtyRef.current = false;
        }
      }

      if (awaitingPersistFingerprintRef.current != null) {
        return mergeLiveStatePreservingDraftTokens(prev, liveState);
      }

      if (localLayoutDirtyRef.current && prevLayout !== liveLayout) {
        return mergeLiveStatePreservingDraftTokens(prev, liveState);
      }

      if (liveFingerprint === prevFingerprint) {
        if (prevLayout === liveLayout) {
          localLayoutDirtyRef.current = false;
        }
        return liveState;
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
        localLayoutDirtyRef.current = true;
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

        suppressNextGridDeselectRef.current = true;

        applyPointer(event.clientX, event.clientY);
        const next = updateTokenInState(combatStateRef.current, tokenId, lastPosition);
        localLayoutDirtyRef.current = true;
        awaitingPersistFingerprintRef.current = combatStatePersistAwaitFingerprint(next);
        setDraft(next);
        void persistRef.current(next);

        draggingTokenIdRef.current = null;
        setDraggingTokenId(null);
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
      if (isBattleActive(combatStateRef.current)) {
        if (!showDmUi) return;
        if (!losMode && dmTokenSelectionBlockedRef.current) return;
      }
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
        if (!dragStarted && (losMode || !dmTokenSelectionBlockedRef.current)) {
          setSelectedTokenId(tokenId);
        }
      }

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [beginTokenDrag, collisionEditMode, isDm, losMode, showDmUi]
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
  const presentAllyIds = useMemo(
    () =>
      new Set(
        combatState.tokens
          .filter((token) => token.kind === "ally" && token.allyId)
          .map((token) => token.allyId!)
      ),
    [combatState.tokens]
  );
  const onBoardAllyCount = useMemo(
    () => combatState.tokens.filter((token) => token.kind === "ally").length,
    [combatState.tokens]
  );
  const playerAbsentFromCombatBoard =
    !isDm &&
    (!ownedCharacterId || !presentCharacterIds.has(ownedCharacterId));

  const initiativeTokens = useMemo(() => {
    if (combatState.initiative.status !== "ready") return [];
    const tokensById = new Map(combatState.tokens.map((token) => [token.id, token]));
    const { order, results } = combatState.initiative;

    if (showDmUi) {
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
    showDmUi,
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
  const losObserverToken = useMemo(() => {
    const turnToken = getCurrentTurnToken(combatState);

    if (isDm) {
      if (selectedToken) return selectedToken;
      return turnToken;
    }

    if (ownedCharacterId) {
      const ownedToken =
        combatState.tokens.find((token) => token.characterId === ownedCharacterId) ?? null;
      if (ownedToken) return ownedToken;
    }

    return turnToken;
  }, [combatState, isDm, ownedCharacterId, selectedToken]);
  const losVisionBands = useMemo(() => {
    if (!losMode || !losObserverToken) return null;
    if (!isTokenOnGrid(losObserverToken, combatState)) return null;
    return buildVisionCellBands(losObserverToken, combatState);
  }, [combatState, losMode, losObserverToken]);
  const selectedMarker = selectedToken?.kind === "marker" ? selectedToken : null;
  const selectedEnemy = selectedToken?.kind === "enemy" ? selectedToken : null;
  const selectedAlly = selectedToken?.kind === "ally" ? selectedToken : null;
  const canEditSelectedToken =
    selectedMarker != null || selectedEnemy != null || selectedAlly != null;
  const combatantCount = useMemo(
    () => combatState.tokens.filter(isCombatantToken).length,
    [combatState.tokens]
  );

  const hpAmountValid = parsePositiveHpAmount(hpAmount) != null;

  const canStartInitiative =
    showDmUi &&
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

  const selectedActingCharacter = selectedToken?.characterId
    ? charactersById[selectedToken.characterId] ?? null
    : null;

  const statesModalContext = useMemo(() => {
    if (!selectedToken || selectedToken.kind === "marker") return null;
    const ally =
      selectedToken.kind === "ally" && selectedToken.allyId
        ? alliesById[selectedToken.allyId] ?? null
        : null;
    const enemyData = resolveEnemyDataForToken(selectedToken);
    const { currentHp } = getTokenHpDisplay(
      selectedToken,
      selectedActingCharacter,
      enemyData
    );
    const conditions = getConditionsForToken(
      selectedToken,
      selectedActingCharacter,
      ally
    );
    const exhaustionLevel =
      selectedActingCharacter?.data.exhaustionLevels.length ?? 0;
    return {
      tokenLabel: getCombatTokenDisplayLabel(selectedToken),
      conditions,
      protectedSlugs: getDmProtectedConditionSlugs(
        currentHp,
        conditions,
        exhaustionLevel
      ),
      exhaustionLevel,
    };
  }, [
    alliesById,
    resolveEnemyDataForToken,
    selectedActingCharacter,
    selectedToken,
  ]);

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
  const actingTokenEnemyData = actingToken
    ? resolveTokenEnemyData(actingToken, enemiesBySlug, alliesById)
    : null;

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
        actingTokenEnemyData,
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
  const autoApproveDm = combatState.autoApproveDm;
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
  const actingTokenIncapacitated = actingToken
    ? isTokenIncapacitated(actingToken, tokenStatusContext)
    : false;
  const actingTokenRestricted = actingToken
    ? isTokenRestrictedByEffects(actingToken)
    : false;
  const actingTokenAlly =
    actingToken?.kind === "ally" && actingToken.allyId
      ? alliesById[actingToken.allyId] ?? null
      : null;
  const actingTokenProne = actingToken
    ? isTokenProne(
        actingToken,
        tokenStatusContext,
        actingTokenCharacter,
        actingTokenAlly
      )
    : false;
  const canUseDash =
    !battleOver &&
    !dashUsed &&
    !actionUsed &&
    !actingTokenRestricted &&
    !actingTokenIncapacitated &&
    !actingTokenProne;
  const showMovePanel =
    (remainingMovementFeet > 0 || canUseDash || actingTokenProne) &&
    !actingTokenRestricted &&
    !actingTokenIncapacitated;
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
    if (isDm && !showDmUi) return;
    setSelectedTokenId((current) => current ?? defaultBattleOverActingToken.id);
  }, [battleOver, defaultBattleOverActingToken, isDm, showDmUi]);

  useEffect(() => {
    if (prevBattleOverRef.current === null) {
      prevBattleOverRef.current = battleOver;
      return;
    }

    const wasBattleOver = prevBattleOverRef.current;
    prevBattleOverRef.current = battleOver;

    if (
      showDmUi &&
      !wasBattleOver &&
      battleOver &&
      (combatState.xpPool ?? 0) > 0
    ) {
      setXpModalOpen(true);
    }
  }, [battleOver, combatState.xpPool, showDmUi]);

  useEffect(() => {
    if (isDm && !showDmUi) {
      setSelectedTokenId(null);
    }
  }, [isDm, showDmUi]);

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
      return { actions: [], multiattackActions: [], bonusActions: [] };
    }
    return getCombatOptionGroupsForToken(actingToken, {
      character: actingTokenCharacter,
      enemyData: actingTokenEnemyData,
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
    actingTokenEnemyData,
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

  const getUpOption = useMemo(() => {
    if (!actingTokenProne || !actingToken) return null;
    const costFeet = getGetUpMovementCostForToken(
      actingToken,
      actingTokenCharacter,
      actingTokenEnemyData,
      featureCatalogs.species
    );
    return buildGetUpCombatOption({
      costFeet,
      remainingMovementFeet,
    });
  }, [
    actingToken,
    actingTokenCharacter,
    actingTokenEnemyData,
    actingTokenProne,
    featureCatalogs.species,
    remainingMovementFeet,
  ]);

  const crawlOption = useMemo(() => {
    if (!actingTokenProne) return null;
    return buildCrawlCombatOption({ remainingMovementFeet });
  }, [actingTokenProne, remainingMovementFeet]);

  const movementCrawling = actingTokenProne && movementMode;

  const showSavingThrowsPanel =
    currentTurnOptionGroups.actions.length > 0 &&
    currentTurnOptionGroups.actions.every((option) => isSavingThrowsOption(option));

  const needsMultiattackBranchPicker =
    !battleOver &&
    !actionUsed &&
    userControlsCombat &&
    (actingToken?.kind === "enemy" || actingToken?.kind === "ally") &&
    (currentTurnOptionGroups.multiattackBranches?.length ?? 0) > 1 &&
    combatState.turn.multiattackBranchIndex == null;

  const showMultiattackSection =
    !battleOver && currentTurnOptionGroups.multiattackActions.length > 0;

  useEffect(() => {
    setMultiattackBranchDismissed(false);
  }, [actingToken?.id, combatState.turn.index, combatState.turn.round]);

  useEffect(() => {
    if (!isDm || battleOver || !actingToken || !actingTokenEnemyData) return;
    if (actingToken.kind !== "enemy" && actingToken.kind !== "ally") return;
    if (getCurrentTurnTokenId(combatState) !== actingToken.id) return;

    const synced = applyMultiattackTurnStateToCombat(
      combatState,
      actingToken.id,
      actingTokenEnemyData.actions
    );
    if (synced === combatState) return;

    void (async () => {
      const error = await persistCombatState(campaignId, synced);
      if (error) return;
      setDraft(synced);
    })();
  }, [
    actingToken,
    actingTokenEnemyData,
    battleOver,
    campaignId,
    combatState,
    isDm,
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
    const enemyData = resolveEnemyDataForToken(userOaAttackerToken);
    return getOpportunityAttackOptionsForToken(userOaAttackerToken, {
      character,
      enemyData,
      catalogItems,
      classCatalog,
      tokenStatusContext,
    });
  }, [
    catalogItems,
    charactersById,
    classCatalog,
    enemiesBySlug,
    tokenStatusContext,
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
  const turnEndBlockedByDeathSave = !canAdvanceTurnWithDeathSave(
    combatState,
    currentTurnCharacter?.data.combat
  );
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
    const { next, error } = await endCombatTurn(campaignId, combatState, {
      isDm,
      currentTurnCombat: currentTurnCharacter?.data.combat,
    });
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

  function clearLosMode() {
    setLosMode(false);
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

  function openStabilizeTargetFlow(
    allies: CombatToken[],
    viaSpell: boolean
  ) {
    if (allies.length === 0) {
      showAlert("No dying allies within 5 feet.");
      return;
    }
    if (allies.length === 1) {
      setStabilizeModal({ targetToken: allies[0]!, viaSpell });
      return;
    }
    setStabilizeTargetPicker({ allies, viaSpell });
  }

  async function handleApplyDeathSave(
    nextCombat: import("@/lib/schemas/character").CharacterData["combat"]
  ): Promise<boolean> {
    const modal = deathSaveModal;
    const tokenId = modal?.tokenId ?? actingToken?.id;
    const characterId = modal?.characterId ?? actingTokenCharacter?.id;
    const character = characterId
      ? localCharacters.find((entry) => entry.id === characterId) ??
        (actingTokenCharacter?.id === characterId ? actingTokenCharacter : null)
      : actingTokenCharacter;
    if (!tokenId || !character) return false;

    const nextData = { ...character.data, combat: nextCombat };

    const saveResult = await saveCharacterData(
      character.id,
      nextData,
      undefined,
      { isDm, originalData: character.data }
    );
    if (saveResult.error) {
      showAlert(saveResult.error);
      return false;
    }

    setLocalCharacters((current) =>
      current.map((entry) =>
        entry.id === character.id ? { ...entry, data: nextData } : entry
      )
    );

    if (hasDeadCondition(nextCombat)) {
      pendingCombatDeathRef.current = { characterId: character.id, nextData };
    }

    let nextState = updateTokenInState(combatStateRef.current, tokenId, {
      currentHp: nextCombat.currentHp,
    });
    nextState = applyDeathSaveRolled(nextState);
    const persistError = await persist(nextState);
    if (persistError) {
      showAlert(persistError);
      return false;
    }

    return true;
  }

  async function handleDeathSaveModalClose() {
    const modal = deathSaveModal;
    const pendingDeath = pendingCombatDeathRef.current;
    pendingCombatDeathRef.current = null;
    setDeathSaveModal(null);

    if (!modal || !pendingDeath || pendingDeath.characterId !== modal.characterId) return;

    const { nextCombatState, error } = await persistCharacterDeath({
      campaignId,
      characterId: modal.characterId,
      nextData: pendingDeath.nextData,
      combatState: combatStateRef.current,
      isDm,
      originalData: pendingDeath.nextData,
      persistCombat: isDm ? persist : undefined,
    });
    if (error) {
      showAlert(error);
      return;
    }
    if (isDm) {
      setDraft(nextCombatState);
    }
  }

  function handleDeathSaveModalCancel() {
    pendingCombatDeathRef.current = null;
    setDeathSaveModal(null);
  }

  async function handleConfirmStabilize(targetToken: CombatToken, viaSpell: boolean) {
    if (!actingToken || !actingTokenCharacter || !targetToken.characterId) return;

    const targetCharacter = charactersById[targetToken.characterId];
    if (!targetCharacter) return;

    const nextCombat = applyStabilize(targetCharacter.data.combat);
    const saveResult = await saveCharacterData(
      targetCharacter.id,
      { ...targetCharacter.data, combat: nextCombat },
      undefined,
      { isDm, originalData: targetCharacter.data }
    );
    if (saveResult.error) {
      showAlert(saveResult.error);
      return;
    }

    setLocalCharacters((current) =>
      current.map((entry) =>
        entry.id === targetCharacter.id
          ? { ...entry, data: { ...entry.data, combat: nextCombat } }
          : entry
      )
    );

    const { next, error } = await recordCombatActionUsed(campaignId, combatState, {
      isDm,
    });
    if (error) {
      showAlert(error);
      return;
    }
    if (isDm) {
      setDraft(next);
    }

    setStabilizeModal(null);
    setStabilizeTargetPicker(null);
    showAlert(
      viaSpell
        ? `${getCombatTokenDisplayLabel(targetToken)} is stabilized (Spare the Dying).`
        : `${getCombatTokenDisplayLabel(targetToken)} is stabilized.`
    );
  }

  async function handleConfirmHelp(ally: CombatToken) {
    if (!actingToken) return;

    const { next, error } = await recordCombatHelp(campaignId, combatState, {
      isDm,
      beneficiaryTokenId: ally.id,
    });
    if (error) {
      showAlert(error);
      return;
    }
    if (isDm) {
      setDraft(next);
    }

    setHelpTargetPickerAllies(null);
    showAlert(
      `${getCombatTokenDisplayLabel(actingToken)} helps ${getCombatTokenDisplayLabel(ally)}.`
    );
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
    if (movementMode || measureMode || losMode || turnTokenHasPendingAction) return;

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
      clearLosMode();
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

    if (isStabilizeActionOption(option)) {
      if (!actingToken || battleOver || actionUsed) return;
      openStabilizeTargetFlow(
        getAdjacentDyingAllyTokens(actingToken, combatState, localCharacters),
        false
      );
      return;
    }

    if (isSavingThrowsOption(option)) {
      if (!userControlsCombat || !actingTokenCharacter || !actingToken || battleOver) return;
      setDeathSaveModal({
        characterId: actingTokenCharacter.id,
        tokenId: actingToken.id,
      });
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

    if (isGetUpOption(option)) {
      if (!userControlsCombat || !actingToken || battleOver) return;
      const costFeet = option.getUp?.costFeet;
      if (costFeet == null) return;
      const { next, partyData: nextPartyData, error } = await recordCombatGetUp(
        campaignId,
        combatState,
        {
          isDm,
          tokenId: actingToken.id,
          costFeet,
          speedFt: currentSpeedFt,
          dashUsed,
          character: actingTokenCharacter,
          ally: actingTokenAlly,
          partyData,
        }
      );
      if (error) {
        showAlert(error);
        return;
      }
      if (isDm) {
        setDraft(next);
      }
      if (actingTokenCharacter) {
        const nextConditions = removeProneFromCharacterData(actingTokenCharacter);
        setLocalCharacters((current) =>
          current.map((character) =>
            character.id === actingTokenCharacter.id
              ? {
                  ...character,
                  data: {
                    ...character.data,
                    combat: {
                      ...character.data.combat,
                      conditions: nextConditions,
                    },
                  },
                }
              : character
          )
        );
      }
      if (nextPartyData && nextPartyData !== partyData) {
        await refreshCampaignPartyData(campaignId);
      }
      return;
    }

    if (isDashActionOption(option)) {
      if (battleOver || dashUsed || actionUsed) return;
      setPendingDashActionConfirm(true);
      return;
    }

    if (isEnemyStatBlockActionOption(option)) {
      if (!userControlsCombat || battleOver || actionUsed) return;
      const { next, error } = await recordCombatActionUsed(campaignId, combatState, {
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

    if (isShellDefenseEnterOption(option)) {
      if (!actingToken || battleOver || actionUsed) return;
      setPendingShellDefenseConfirm(true);
      return;
    }

    if (isHpPoolCombatOptionKind(option)) {
      if (!actingToken || !actingTokenCharacter || battleOver || actionUsed) return;
      setPendingHpPoolFeatureId(option.mechanicalFeatureId ?? null);
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

    if (isSpellcastingEntryOption(option)) {
      if (battleOver || actionUsed) return;
      setPendingSpellcasting({ castingCost: "action" });
      return;
    }

    if (isSpellCastOption(option)) {
      if (battleOver) return;
      if (option.spellCast?.castingCost === "bonus-action" && bonusActionUsed) return;
      if (option.spellCast?.castingCost === "action" && actionUsed) return;

      if (
        option.spellCast?.spellId === "spare-the-dying" &&
        actingToken
      ) {
        openStabilizeTargetFlow(
          getAdjacentDyingAllyTokens(actingToken, combatState, localCharacters),
          true
        );
        return;
      }

      const spellCast = option.spellCast;
      if (spellCast && spellCast.level > 0 && actingTokenCharacter) {
        const entry = resolveCombatCastableSpell(actingTokenCharacter.data, spellCast);
        if (!entry) return;
        setPendingSpellcasting({
          castingCost: spellCast.castingCost,
          preselectedEntry: entry,
        });
        return;
      }

      setPendingSpellCast(option);
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
      clearLosMode();
      clearObjectInteractionMode();
      clearAttackFlow();

      if (attack.range.trim().toLowerCase() === "self-space") {
        const targets = buildTargetList(
          actingToken,
          combatState,
          attack,
          null,
          null,
          charactersById,
          enemiesBySlug
        );
        if (targets.length === 0) {
          showAlert("No valid targets in this space.");
          return;
        }
        setAttackSubmitDraft({
          option,
          attack,
          targets,
          aoeCenter: null,
          attackerToken: actingToken,
          attackDisadvantageByTokenId: buildAttackDisadvantageMap(
            actingToken,
            attack,
            targets
          ),
          attackAdvantageByTokenId: buildAttackAdvantageMap(actingToken, attack, targets),
        });
        return;
      }

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

  function handleToggleLosMode() {
    if (!losMode && !canUseLos) return;
    if (losMode) {
      clearLosMode();
      return;
    }
    setLosMode(true);
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
  dmTokenSelectionBlockedRef.current = Boolean(
    (isDm && !showDmUi && battleActive) ||
      attackTargeting ||
      movementMode ||
      objectInteractionMode ||
      measureMode ||
      turnTokenHasPendingAction ||
      provokingMovePending ||
      pendingOpportunityAttackMove
  );
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
        getAttackRollDisadvantage(attacker, target, combatState, attack, tokenStatusContext),
      ])
    );
  }

  function buildAttackAdvantageMap(
    attacker: CombatToken | null | undefined,
    attack: DerivedAttack,
    targets: CombatToken[]
  ): Record<string, boolean> {
    if (!attacker) return {};
    return Object.fromEntries(
      targets.map((target) => [
        target.id,
        getHelpAttackAdvantage(attacker, target, combatState) ||
          getAttackRollAdvantage(attacker, target, combatState, attack, tokenStatusContext),
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
    const attackerEnemyData = resolveEnemyDataForToken(attacker);
    const attack = findDerivedAttackByOptionId(
      pending.optionId,
      attacker,
      character,
      catalogItems,
      classCatalog,
      attackerEnemyData
    );
    if (!attack) return "Disadvantage on attack roll";

    return (
      formatAttackDisadvantageLabel(attacker, targetToken, combatState, attack, tokenStatusContext) ??
      "Disadvantage on attack roll"
    );
  }

  function resolvePendingAdvantageLabel(
    pending: PendingAttack,
    targetTokenId: string
  ): string | null {
    const target = pending.targets.find((entry) => entry.tokenId === targetTokenId);
    if (!target?.attackAdvantage) return null;

    const attacker = combatState.tokens.find((token) => token.id === pending.attackerTokenId);
    const targetToken = combatState.tokens.find((token) => token.id === targetTokenId);
    if (!attacker || !targetToken) return "Advantage on attack roll";

    const character = attacker.characterId
      ? charactersById[attacker.characterId] ?? null
      : null;
    const attackerEnemyData = resolveEnemyDataForToken(attacker);
    const attack = findDerivedAttackByOptionId(
      pending.optionId,
      attacker,
      character,
      catalogItems,
      classCatalog,
      attackerEnemyData
    );
    if (!attack) return "Advantage on attack roll";

    return (
      getHelpAttackAdvantageLabel(attacker, targetToken, combatState) ??
      formatAttackAdvantageLabel(attacker, targetToken, attack, tokenStatusContext) ??
      "Advantage on attack roll"
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
      attackAdvantageByTokenId: buildAttackAdvantageMap(attacker, attackTargeting.attack, targets),
      spellCastSlotLevel: attackTargeting.spellCastSlotLevel,
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
              ...(update.conditions != null ? { conditions: update.conditions } : {}),
              ...(update.deathSaves != null ? { deathSaves: update.deathSaves } : {}),
            },
            ...(update.inventoryItems != null
              ? {
                  inventory: {
                    ...character.data.inventory,
                    items: update.inventoryItems,
                  },
                }
              : {}),
            ...(update.spellSlots != null
              ? {
                  spells: {
                    ...character.data.spells,
                    slots: update.spellSlots,
                  },
                }
              : {}),
          },
        };
      })
    );
  }

  async function persistPartyAmmoUnload(charactersToUnload: ParsedCharacter[]) {
    const updates = unloadPartyBattleAmmo(charactersToUnload, catalogItems);
    if (updates.size === 0) return;

    for (const [characterId, inventoryItems] of updates) {
      const character = charactersToUnload.find((entry) => entry.id === characterId);
      if (!character) continue;
      const { error } = await saveCharacterData(
        characterId,
        {
          ...character.data,
          inventory: {
            ...character.data.inventory,
            items: inventoryItems,
          },
        },
        undefined,
        { isDm, originalData: character.data }
      );
      if (error) {
        showAlert(error);
        return;
      }
    }

    setLocalCharacters((current) =>
      current.map((character) => {
        const inventoryItems = updates.get(character.id);
        if (!inventoryItems) return character;
        return {
          ...character,
          data: {
            ...character.data,
            inventory: {
              ...character.data.inventory,
              items: inventoryItems,
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
      alliesById,
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
      attackAdvantageByTokenId: buildAttackAdvantageMap(userOaAttackerToken, attack, [provokingToken]),
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
      enemiesBySlug,
      alliesById,
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
      isDm,
      enemiesBySlug,
      alliesById
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
      isDm,
      enemiesBySlug,
      alliesById
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
      void resolveCombatAttack(
        campaignId,
        combatState,
        pending,
        charactersById,
        isDm,
        enemiesBySlug,
        alliesById
      )
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
    alliesById,
    autoApprove,
    autoApproveDm,
    campaignId,
    charactersById,
    combatState,
    enemiesBySlug,
    isDm,
    resolvingAttackId,
  ]);

  useEffect(() => {
    if (!isDm || !battleActive || combatState.battleAmmoPrepared) return;
    if (battleAmmoPrepInFlightRef.current) return;

    battleAmmoPrepInFlightRef.current = true;
    void (async () => {
      try {
        const updates = preparePartyBattleAmmo(localCharacters, combatState, catalogItems);

        for (const [characterId, inventoryItems] of updates) {
          const character = localCharacters.find((entry) => entry.id === characterId);
          if (!character) continue;
          const { error } = await saveCharacterData(
            characterId,
            {
              ...character.data,
              inventory: {
                ...character.data.inventory,
                items: inventoryItems,
              },
            },
            undefined,
            { isDm: true, originalData: character.data }
          );
          if (error) {
            showAlert(error);
            return;
          }
        }

        const next = markBattleAmmoPrepared(combatState);
        const persistError = await persistCombatState(campaignId, next);
        if (persistError) {
          showAlert(persistError);
          return;
        }
        setDraft(next);

        if (updates.size > 0) {
          applyCharacterHpUpdates(
            next,
            [...updates.entries()].map(([characterId, inventoryItems]) => {
              const character = localCharacters.find((entry) => entry.id === characterId);
              return {
                characterId,
                currentHp: character?.data.combat.currentHp ?? 0,
                tempHp: character?.data.combat.tempHp ?? 0,
                inventoryItems,
              };
            })
          );
        }
      } finally {
        battleAmmoPrepInFlightRef.current = false;
      }
    })();
  }, [
    battleActive,
    campaignId,
    catalogItems,
    combatState,
    isDm,
    localCharacters,
  ]);

  useEffect(() => {
    if (!isDm) return;

    const wasActive = prevBattleActiveRef.current;
    prevBattleActiveRef.current = battleActive;

    if (wasActive && !battleActive) {
      void persistPartyAmmoUnload(localCharacters);
    }
  }, [battleActive, catalogItems, isDm, localCharacters]);

  function handleToggleAutoApprove(checked: boolean) {
    if (checked === autoApprove) return;
    void persist({ ...combatState, autoApprove: checked });
  }

  function handleToggleAutoApproveDm(checked: boolean) {
    if (checked === autoApproveDm) return;
    void persist({ ...combatState, autoApproveDm: checked });
  }

  function handleToggleMovementMode() {
    if (
      attackTargeting ||
      objectInteractionMode ||
      measureMode ||
      losMode ||
      turnTokenHasPendingAction ||
      provokingMovePending ||
      pendingOpportunityAttackMove
    ) {
      return;
    }
    setMovementMode((value) => {
      if (!value) clearLosMode();
      return !value;
    });
    setHoveredMovementCell(null);
  }

  const movementDestinations = useMemo(() => {
    if (!actingToken || !movementMode || !userControlsCombat) return [];
    return computeReachableDestinations(actingToken, combatState, {
      speedFt: currentSpeedFt,
      usedFeet: movementUsedFeet,
      dashUsed,
      actionUsed,
      allowDash: !movementCrawling,
      crawling: movementCrawling,
    });
  }, [
    actingToken,
    battleOver,
    combatState,
    currentSpeedFt,
    dashUsed,
    actionUsed,
    movementCrawling,
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
        if (losMode) {
          clearLosMode();
          return;
        }
        clearAttackFlow();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [losMode, measureMode]);

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
        disengageUsed,
        tokenStatusContext
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

  async function handleSelectMultiattackBranch(branchIndex: number) {
    const branches = currentTurnOptionGroups.multiattackBranches;
    if (!branches || !actingTokenEnemyData || !actingToken) return;
    const parsedActions = parseEnemyActions(actingTokenEnemyData.actions);
    const initialRemaining = buildInitialMultiattackRemaining(
      branches[branchIndex],
      parsedActions
    );
    const next = applyMultiattackBranchSelection(
      combatState,
      actingToken.id,
      branchIndex,
      initialRemaining
    );
    if (isDm) {
      const error = await persistCombatState(campaignId, next);
      if (error) {
        showAlert(error);
        return;
      }
      setDraft(next);
    }
    setMultiattackBranchDismissed(false);
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

  async function handleConfirmHpPool(input: {
    target: HpPoolCombatTarget;
    mode: HpPoolMode;
    healAmount: number;
  }) {
    if (!actingToken || !actingTokenCharacter || !pendingHpPoolFeatureId) return;

    const targetToken = input.target.token;
    const targetCharacter = input.target.character;

    const result = applyHpPoolFeature(
      actingTokenCharacter.data,
      targetCharacter.data,
      pendingHpPoolFeatureId,
      input.mode,
      input.healAmount,
      featureCatalogs,
      { selfTarget: targetCharacter.id === actingTokenCharacter.id }
    );
    if (!result) {
      showAlert("Healing pool could not be applied.");
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

    const actorSave = await saveCharacterData(
      actingTokenCharacter.id,
      result.actorData,
      undefined,
      { isDm, originalData: actingTokenCharacter.data }
    );
    if (actorSave.error) {
      showAlert(actorSave.error);
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
          return { ...entry, data: result.actorData };
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

    setPendingHpPoolFeatureId(null);
  }

  function handleSpellPickerConfirm(selection: CombatSpellPickerSelection) {
    if (!actingTokenCharacter || !pendingSpellcasting) return;

    const { entry, castSlotLevel, materialSelections } = selection;
    const castingCost = pendingSpellcasting.castingCost;
    setPendingSpellcasting(null);

    setPendingSpellCast({
      id: `spell-cast:${entry.spell.id}`,
      name: entry.spell.name,
      subtitle: formatDeclareCastSpellSubtitle(entry.spell, entry.slug),
      tooltip: formatSpellPickerCombatTooltip(entry, actingTokenCharacter.data),
      kind: castingCost === "bonus-action" ? "bonus-action" : "action",
      spellCast: {
        spellId: entry.slug,
        characterSpellId: entry.spell.id,
        level: entry.spell.level,
        castSlotLevel,
        castingCost,
        materialSelections,
      },
    });
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

  async function handleConfirmSpellCast(materialSelections: Array<{ groupIndex: number; inventoryItemId: string }>) {
    if (!pendingSpellCast?.spellCast || !actingToken) return;

    if (hasPendingAttackForAttacker(combatState, actingToken.id)) {
      showAlert("You already have an action pending.");
      return;
    }

    setSubmittingAttack(true);
    const combatOption: CombatOption = {
      ...pendingSpellCast,
      spellCast: {
        ...pendingSpellCast.spellCast,
        materialSelections,
      },
    };
    const { next, error, characterUpdates } = await submitCombatSpellCast(
      campaignId,
      combatState,
      {
        userId,
        isDm,
        attacker: actingToken,
        combatOption,
        charactersById,
        enemiesBySlug,
        catalogItems,
      }
    );
    setSubmittingAttack(false);
    setPendingSpellCast(null);
    if (error) {
      showAlert(error);
      return;
    }
    if (isDm) {
      setDraft(next);
      applyCharacterHpUpdates(next, characterUpdates);
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
    const enemyData = resolveEnemyDataForToken(token);
    const { currentHp, maxHp } = getTokenHpDisplay(token, character, enemyData);
    const partyNextCombat =
      token.kind === "party" && character
        ? applyCombatHpDelta(character.data.combat, delta, maxHp)
        : null;
    const nextHp = partyNextCombat?.currentHp ?? applyHpDelta(currentHp, maxHp, delta);
    const damageDelta = delta < 0 ? -delta : 0;
    const patched = patchTokenHpFromDamage(
      token,
      nextHp,
      (token.damageTaken ?? 0) + damageDelta
    );
    const enemyNextConditions =
      token.kind === "enemy"
        ? syncTokenConditionsAfterHpChange(currentHp, nextHp, token.conditions ?? [])
        : undefined;

    let next = updateTokenInState(combatState, token.id, {
      currentHp: patched.currentHp,
      maxHp,
      damageTaken: patched.damageTaken,
      ...(patched.hidden != null ? { hidden: patched.hidden } : {}),
      ...(enemyNextConditions != null ? { conditions: enemyNextConditions } : {}),
    });

    if (token.kind === "enemy" && !(token.hidden ?? false) && (patched.hidden ?? false)) {
      next = updateInitiativeAfterVisibilityChange(next, token.id, false, true);
    }

    next = creditXpForDefeatedEnemies(next, enemiesBySlug);

    setApplyingHp(true);

    const persistError = await persist(next);
    if (persistError) {
      setApplyingHp(false);
      showAlert(persistError);
      return;
    }

    if (token.kind === "party" && character && partyNextCombat) {
      const nextCombat = partyNextCombat;
      const saveResult = await saveCharacterData(
        character.id,
        { ...character.data, combat: nextCombat },
        undefined,
        { isDm: true, originalData: character.data }
      );
      if (saveResult.error) {
        setApplyingHp(false);
        showAlert(saveResult.error);
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

  async function handleSaveTokenStates(proposed: string[]) {
    if (!selectedToken || selectedToken.kind === "marker" || !statesModalContext) return;

    const token = selectedToken;
    const character = selectedActingCharacter;
    const ally =
      token.kind === "ally" && token.allyId ? alliesById[token.allyId] ?? null : null;
    const enemyData = resolveEnemyDataForToken(token);
    const { currentHp } = getTokenHpDisplay(token, character, enemyData);
    const currentConditions = statesModalContext.conditions;
    const exhaustionLevel = statesModalContext.exhaustionLevel;
    const nextConditions = finalizeDmConditionEdit(
      proposed,
      currentHp,
      currentConditions,
      exhaustionLevel
    );

    setSavingStates(true);

    if (token.kind === "party" && character) {
      const nextCombat = syncDeathSavesAfterDeadRemoved(character.data.combat, {
        ...character.data.combat,
        conditions: nextConditions,
      });
      const saveResult = await saveCharacterData(
        character.id,
        { ...character.data, combat: nextCombat },
        undefined,
        { isDm: true, originalData: character.data }
      );
      if (saveResult.error) {
        setSavingStates(false);
        showAlert(saveResult.error);
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
    } else if (token.kind === "ally" && token.allyId) {
      const nextPartyData: PartyData = {
        ...partyData,
        allies: partyData.allies.map((entry) =>
          entry.id === token.allyId
            ? { ...entry, conditions: nextConditions }
            : entry
        ),
      };
      const supabase = createClient();
      const { error } = await supabase
        .from("campaigns")
        .update({ party_data: nextPartyData })
        .eq("id", campaignId);
      if (error) {
        setSavingStates(false);
        showAlert(error.message);
        return;
      }
      await refreshCampaignPartyData(campaignId);
    } else if (token.kind === "enemy") {
      const next = updateTokenInState(combatState, token.id, {
        conditions: nextConditions,
      });
      const persistError = await persist(next);
      if (persistError) {
        setSavingStates(false);
        showAlert(persistError);
        return;
      }
    } else {
      setSavingStates(false);
      return;
    }

    setSavingStates(false);
    setStatesModalOpen(false);
  }

  async function handleDistributeXp(selectedCharacterIds: string[], allyCount: number) {
    const pool = combatState.xpPool ?? 0;
    if (pool <= 0 || selectedCharacterIds.length === 0) return;

    const recipients = selectedCharacterIds
      .map((id) => localCharacters.find((character) => character.id === id))
      .filter((character): character is ParsedCharacter => character != null)
      .map((character) => ({
        id: character.id,
        currentXp: character.data.basicInfo.xp ?? 0,
      }));

    if (recipients.length === 0) return;

    const awards = distributeXpPool(pool, recipients, allyCount);
    if (awards.size === 0) {
      showAlert("Could not calculate XP distribution.");
      return;
    }

    setDistributingXp(true);

    const updatedById = new Map<string, ParsedCharacter>();

    for (const recipient of recipients) {
      const award = awards.get(recipient.id) ?? 0;
      if (award <= 0) continue;

      const character = localCharacters.find((entry) => entry.id === recipient.id);
      if (!character) continue;

      const nextXp = (character.data.basicInfo.xp ?? 0) + award;
      const mergedData = {
        ...character.data,
        basicInfo: {
          ...character.data.basicInfo,
          xp: nextXp,
        },
      };
      const nextData = {
        ...mergedData,
        inspiration: clampInspiration(character.data.inspiration ?? 0, mergedData),
      };

      const saveResult = await saveCharacterData(
        character.id,
        nextData,
        undefined,
        { isDm: true, originalData: character.data }
      );
      if (saveResult.error) {
        setDistributingXp(false);
        showAlert(saveResult.error);
        return;
      }

      updatedById.set(character.id, { ...character, data: nextData });
    }

    setLocalCharacters((current) =>
      current.map((character) => updatedById.get(character.id) ?? character)
    );

    const cleared = clearXpPool(combatState);
    const persistError = await persist(cleared);
    setDistributingXp(false);

    if (persistError) {
      showAlert(persistError);
      return;
    }

    setXpModalOpen(false);
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
    if (
      !canAdjustTurnMovement ||
      (!actionUsed && !bonusActionUsed && !freeObjectInteractionUsed)
    ) {
      return;
    }

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

  async function handleConfirmAmmoRefill() {
    if (!objectInteractionMode || !userControlsCombat || !actingToken || !actingTokenCharacter) {
      return;
    }

    setSubmittingEquipmentChange(true);
    const { next, error, characterId, inventoryItems } = await recordCombatAmmoRefill(
      campaignId,
      combatState,
      {
        isDm,
        actorTokenId: actingToken.id,
        character: actingTokenCharacter,
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
    if (
      !losMode &&
      (attackTargeting || movementMode || measureMode || draggingTokenId || collisionEditMode)
    ) {
      return;
    }
    event.stopPropagation();

    const token = combatState.tokens.find((entry) => entry.id === tokenId);
    if (!token) return;

    if (losMode && showDmUi) {
      setSelectedTokenId(tokenId);
      return;
    }

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
      if (showDmUi) {
        setCharacterSlotTokenId(tokenId);
        return;
      }
      if (canPlayerClaimPlaceholder(token, ownedCharacter, presentCharacterIds)) {
        setCharacterSlotTokenId(tokenId);
      }
      return;
    }

    if (battleOver) {
      if (isDm && !showDmUi) return;
      const character = token.characterId ? charactersById[token.characterId] ?? null : null;
      if (canUserActForToken(userId, isDm, token, character)) {
        setSelectedTokenId(tokenId);
      }
      return;
    }
  }

  const handleCollisionPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!collisionEditMode || !showDmUi) return;
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
    clearLosMode();
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
      userId,
      alliesById
    );
    await persist(state);
    await promptPlayerInitiativeRolls(charactersNeedingPlayerRolls);
  }

  async function handleOpenAddAllyDialog() {
    const fresh = await refreshCampaignPartyData(campaignId);
    setAllyPickerRoster(listPartyAllies(fresh));
    setAddAllyOpen(true);
  }

  async function handleAddAllies(selected: typeof allies) {
    const previous = combatState;
    const withTokens = addAlliesToState(previous, selected);
    const added = getAddedCombatantTokens(previous, withTokens);
    const { state, charactersNeedingPlayerRolls } = integrateNewCombatantsInitiative(
      withTokens,
      added,
      characters,
      enemiesBySlug,
      userId,
      alliesById
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
      await removeCombatImageIfUnreferenced(supabase, previousPath);
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

  async function handleEditAlly(values: AllyTokenDialogValues) {
    if (!selectedAlly) return;

    const next = updateTokenInState(combatState, selectedAlly.id, {
      displayName: values.displayName || undefined,
    });

    const persistError = await persist(next);
    if (persistError) {
      showAlert(persistError);
      return;
    }
    setEditAllyOpen(false);
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
      userId,
      alliesById
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
          localCharacters.map((character) => character.id)
        );
        await persistPartyAmmoUnload(localCharacters);
        const next = resetCombatBoard(combatStateRef.current, localCharacters);
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
    const previousEncounter = overwriteConfirmEncounter;

    const { payload: clonedPayload, error: cloneError } =
      await cloneEncounterPayloadImages(supabase, targetId, payload);

    if (cloneError) {
      setSavingEncounter(false);
      showAlert(cloneError);
      return;
    }

    const { error } = await supabase
      .from("encounters")
      .update({
        name,
        background_path: clonedPayload.backgroundPath,
        grid_width: clonedPayload.gridWidth,
        grid_height: clonedPayload.gridHeight,
        tile_feet: clonedPayload.tileFeet,
        blocked_cells: clonedPayload.blockedCells,
        data: clonedPayload.data,
        total_cr: clonedPayload.totalCr,
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

    if (previousEncounter) {
      await cleanupEncounterOwnedImages(
        supabase,
        targetId,
        previousEncounter.background_path,
        parseSavedEncounterData(previousEncounter.data)
      );
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

    if (error) {
      setSavingEncounter(false);
      setSaveEncounterNameOpen(false);
      setOverwriteConfirmEncounter(null);
      setPendingSaveName(null);
      showAlert(error.message);
      return;
    }

    const { payload: clonedPayload, error: cloneError } =
      await cloneEncounterPayloadImages(supabase, data.id, payload);

    if (cloneError) {
      setSavingEncounter(false);
      setSaveEncounterNameOpen(false);
      setOverwriteConfirmEncounter(null);
      setPendingSaveName(null);
      showAlert(cloneError);
      await linkBoardToEncounter(data.name, data.id);
      return;
    }

    if (
      clonedPayload.backgroundPath !== payload.backgroundPath ||
      JSON.stringify(clonedPayload.data.markers) !==
        JSON.stringify(payload.data.markers)
    ) {
      const { error: updateError } = await supabase
        .from("encounters")
        .update({
          background_path: clonedPayload.backgroundPath,
          data: clonedPayload.data,
        })
        .eq("id", data.id);

      if (updateError) {
        setSavingEncounter(false);
        setSaveEncounterNameOpen(false);
        setOverwriteConfirmEncounter(null);
        setPendingSaveName(null);
        showAlert(updateError.message);
        await linkBoardToEncounter(data.name, data.id);
        return;
      }
    }

    setSavingEncounter(false);
    setSaveEncounterNameOpen(false);
    setOverwriteConfirmEncounter(null);
    setPendingSaveName(null);
    await linkBoardToEncounter(data.name, data.id);
  }

  function handleSaveEncounterClick() {
    if (!showDmUi || !preBattleSetup) return;
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

    let next = startInitiativeCollection(combatState, characters, enemiesBySlug, userId, alliesById);
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
    if (error) {
      showAlert(error);
      return;
    }
    if (!path) return;

    const previousPath = combatState.backgroundPath;
    const next = { ...combatState, backgroundPath: path };
    await persist(next);

    if (previousPath && previousPath !== path) {
      await removeCombatImageIfUnreferenced(supabase, previousPath);
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
        await removeCombatImageIfUnreferenced(supabase, previousPath);
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
    if (isHiddenEnemy(token) && !showDmUi) return null;

    const portraitUrl = resolveTokenPortraitUrl(supabase, token);
    const displayLabel = getCombatTokenDisplayLabel(token);
    const isSelected = selectedTokenId === token.id && (!isDm || showDmUi);
    const tokenEnemyData = resolveEnemyDataForToken(token);
    const character = token.characterId ? charactersById[token.characterId] : null;
    const isHiddenForDm = isHiddenEnemy(token) && showDmUi;
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
    const effectiveAc = getTokenAc(token, character, tokenEnemyData);
    const statusEntries = getTokenStatusEntries(token, tokenStatusContext);
    const allyHpDisplay =
      token.kind === "ally" ? getTokenHpDisplay(token, null, tokenEnemyData) : null;
    const rosterAlly = token.allyId ? alliesById[token.allyId] : null;
    const allyRaceClassLine = rosterAlly ? getAllyRaceClassLine(rosterAlly) : "";
    const isExpanded =
      isHovered &&
      ((token.kind === "enemy" && (showDmUi ? tokenEnemyData != null : true)) ||
        token.kind === "ally" ||
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
                {statusEntries.map((entry) => {
                  const statusTooltip = getTokenStatusTooltip(entry.slug);
                  const chip = (
                    <span className="combat-token-status-chip">{entry.label}</span>
                  );
                  return statusTooltip ? (
                    <Tooltip key={entry.slug} content={statusTooltip}>
                      {chip}
                    </Tooltip>
                  ) : (
                    <span key={entry.slug}>{chip}</span>
                  );
                })}
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
            {isExpanded && token.kind === "ally" ? (
              <>
                {allyRaceClassLine ? (
                  <span className="combat-token-label-detail">{allyRaceClassLine}</span>
                ) : null}
                {tokenEnemyData ? (
                  <span className="combat-token-label-detail">
                    AC {effectiveAc}
                    {tokenEnemyData.armorClass.note
                      ? ` (${tokenEnemyData.armorClass.note})`
                      : ""}
                  </span>
                ) : null}
                {statusEntries.map((entry) => {
                  const statusTooltip = getTokenStatusTooltip(entry.slug);
                  const chip = (
                    <span className="combat-token-status-chip">{entry.label}</span>
                  );
                  return statusTooltip ? (
                    <Tooltip key={entry.slug} content={statusTooltip}>
                      {chip}
                    </Tooltip>
                  ) : (
                    <span key={entry.slug}>{chip}</span>
                  );
                })}
                <span className="combat-token-label-detail">
                  HP {allyHpDisplay?.currentHp ?? 0}/{allyHpDisplay?.maxHp ?? 0}
                </span>
                {tokenEnemyData ? (
                  <span className="combat-token-label-detail">
                    Speed{" "}
                    {getTokenSpeedFt(token, null, tokenEnemyData, tokenSpeedOptions)} ft
                  </span>
                ) : null}
              </>
            ) : null}
            {isExpanded && !showDmUi && token.kind === "enemy" && enemyDamageTaken > 0 ? (
              <span className="combat-token-label-detail">
                Damage taken: {enemyDamageTaken}
              </span>
            ) : null}
            {isExpanded && showDmUi && token.kind === "enemy" && tokenEnemyData ? (
              <>
                <span className="combat-token-label-detail">
                  AC {tokenEnemyData.armorClass.value}
                  {tokenEnemyData.armorClass.note ? ` (${tokenEnemyData.armorClass.note})` : ""}
                </span>
                <span className="combat-token-label-detail">
                  HP {token.currentHp ?? tokenEnemyData.hitPoints.average}/
                  {token.maxHp ?? tokenEnemyData.hitPoints.average}
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
        className={`combat-grid${fullscreen ? " combat-grid-fullscreen" : ""}${draggingTokenId ? " combat-grid-dragging" : ""}${movementMode ? " combat-grid-movement-mode" : ""}${attackTargeting ? " combat-grid-targeting-mode" : ""}${objectInteractionMode ? " combat-grid-object-interaction-mode" : ""}${collisionEditMode ? " combat-grid-collision-mode" : ""}${measureMode ? " combat-grid-measure-mode" : ""}${losMode ? " combat-grid-los-mode" : ""}`}
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
        {collisionEditMode && showDmUi ? (
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
        {losMode && losVisionBands ? (
          <CombatLosOverlay
            gridWidth={combatState.gridWidth}
            gridHeight={combatState.gridHeight}
            visibleBands={losVisionBands}
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

  const deathSaveModalCharacter = deathSaveModal
    ? localCharacters.find((entry) => entry.id === deathSaveModal.characterId) ?? null
    : null;

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
            const isHiddenForDm = isHiddenEnemy(token) && showDmUi;
            const labelLetter =
              token.kind === "enemy" ? getEnemyTokenLabelLetter(token) : null;
            const turnTooltip =
              showDmUi && initiativeResult
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
                  {showDmUi ? (
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
                  {showDmUi ? (
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
                  <div className="combat-board-view-actions-row">
                    <button
                      type="button"
                      className="candy-btn combat-expand-btn"
                      onClick={() => setBoardExpanded(true)}
                    >
                      Expand
                    </button>
                    <button
                      type="button"
                      className={`candy-btn combat-los-btn${losMode ? " candy-btn-active" : ""}`}
                      disabled={!losMode && !canUseLos}
                      onClick={handleToggleLosMode}
                    >
                      LOS
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
                  {showDmUi ? (
                    <div className="combat-board-view-actions-row">
                      <label
                        className={`candy-btn combat-auto-approve-toggle${autoApprove ? " candy-btn-active" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={autoApprove}
                          onChange={(event) => handleToggleAutoApprove(event.target.checked)}
                          aria-label="Auto-approve player actions"
                        />
                        <span>Auto-approve players</span>
                      </label>
                      <label
                        className={`candy-btn combat-auto-approve-toggle${autoApproveDm ? " candy-btn-active" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={autoApproveDm}
                          onChange={(event) => handleToggleAutoApproveDm(event.target.checked)}
                          aria-label="Auto-approve DM actions"
                        />
                        <span>Auto-approve DM</span>
                      </label>
                    </div>
                  ) : null}
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
                            proneMode={actingTokenProne}
                            remainingFeet={remainingMovementFeet}
                            speedFeet={currentSpeedFt}
                            dashAvailableFeet={dashPreviewFeet}
                            dashUsed={dashUsed}
                            showDash={!battleOver && !dashUsed}
                            movementMode={movementMode}
                            disabled={
                              !!attackTargeting ||
                              objectInteractionMode ||
                              turnTokenHasPendingAction ||
                              enemyTurnBlockedByOpportunityAttacks ||
                              provokingMovePending ||
                              !!pendingOpportunityAttackMove
                            }
                            dashDisabled={!canUseDash}
                            onToggleMovementMode={handleToggleMovementMode}
                            onSelectDash={() => {
                              if (battleOver || dashUsed || actionUsed) return;
                              setPendingDashActionConfirm(true);
                            }}
                            crawlOption={crawlOption}
                            getUpOption={getUpOption}
                            onSelectGetUp={() => {
                              if (getUpOption) handleSelectCombatOption(getUpOption);
                            }}
                          />
                        ) : null}
                        {currentTurnOptionGroups.actions.length > 0 ? (
                          showSavingThrowsPanel ? (
                            <CombatSavingThrowsPanel
                              key={actingToken?.id ?? "no-acting-token"}
                              options={currentTurnOptionGroups.actions}
                              onSelectOption={handleSelectCombatOption}
                              selectedOptionId={selectedActionOptionId}
                              pendingOptionId={pendingOptionId}
                              selectionLocked={turnActionsLocked}
                            />
                          ) : (
                            <CombatActionPanel
                              key={actingToken?.id ?? "no-acting-token"}
                              options={currentTurnOptionGroups.actions}
                              onSelectOption={handleSelectCombatOption}
                              selectedOptionId={selectedActionOptionId}
                              pendingOptionId={pendingOptionId}
                              selectionLocked={turnActionsLocked}
                            />
                          )
                        ) : null}
                        {objectInteractionMode && freeObjectInteractionUsed && !actionUsed ? (
                          <p className="combat-object-interaction-hint">
                            This pickup will use your action.
                          </p>
                        ) : null}
                        {showMultiattackSection ? (
                          <CombatMultiattackPanel
                            options={currentTurnOptionGroups.multiattackActions}
                            preamble={currentTurnOptionGroups.multiattackPreamble}
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
                              turnEndBlockedByPendingAttacks ||
                              turnEndBlockedByDeathSave
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

            {showDmUi ? (
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
                  <button
                    type="button"
                    className="candy-btn"
                    onClick={() => void handleOpenAddAllyDialog()}
                  >
                    Add ally
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
                    onClick={() => setXpModalOpen(true)}
                  >
                    XP
                  </button>
                  <button
                    type="button"
                    className="candy-btn"
                    onClick={() => {
                      if (selectedMarker) setEditMarkerOpen(true);
                      else if (selectedEnemy) setEditEnemyOpen(true);
                      else if (selectedAlly) setEditAllyOpen(true);
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
                            (!actionUsed &&
                              !bonusActionUsed &&
                              !freeObjectInteractionUsed)
                          }
                          onClick={() => void handleGrantTurnAction()}
                        >
                          {grantingAction ? "…" : "Grant action"}
                        </button>
                        <button
                          type="button"
                          className="candy-btn"
                          disabled={
                            !selectedToken ||
                            selectedToken.kind === "marker" ||
                            savingStates
                          }
                          onClick={() => setStatesModalOpen(true)}
                        >
                          States
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {showDmUi && battleActive ? (
              <div
                className={`combat-dm-approval-banner${
                  dmApprovalTrayAttacks.length > 0
                    ? " combat-dm-approval-banner--active"
                    : selectedToken
                      ? ` ${tokenColorClass(selectedToken.kind)}`
                      : ""
                }`}
                role={dmApprovalTrayAttacks.length > 0 ? "status" : undefined}
                aria-live={dmApprovalTrayAttacks.length > 0 ? "polite" : undefined}
                aria-label={
                  dmApprovalTrayAttacks.length > 0
                    ? undefined
                    : selectedToken
                      ? `Selected: ${getCombatTokenDisplayLabel(selectedToken)}`
                      : undefined
                }
              >
                {dmApprovalTrayAttacks.length > 0
                  ? "AWAITING DM APPROVAL"
                  : selectedToken
                    ? getCombatTokenDisplayLabel(selectedToken)
                    : null}
              </div>
            ) : null}

            <div className="combat-grid-shell">
              {!boardExpanded ? renderCombatGrid(false) : null}
            </div>
            {showDmUi && battleActive && dmApprovalTrayAttacks.length > 0 ? (
              <CombatDmApprovalTray
                pendingAttacks={dmApprovalTrayAttacks}
                tokens={combatState.tokens}
                charactersById={charactersById}
                enemiesBySlug={enemiesBySlug}
                classCatalog={classCatalog}
                resolveDisadvantageLabel={resolvePendingDisadvantageLabel}
                resolveAdvantageLabel={resolvePendingAdvantageLabel}
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
      <AddAllyDialog
        open={addAllyOpen}
        onOpenChange={(open) => {
          setAddAllyOpen(open);
          if (!open) setAllyPickerRoster(null);
        }}
        allies={allyPickerRoster ?? allies}
        presentAllyIds={presentAllyIds}
        onConfirm={handleAddAllies}
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
      <AllyTokenDialog
        open={editAllyOpen}
        onOpenChange={setEditAllyOpen}
        defaultLabel={selectedAlly?.label ?? ""}
        rosterName={
          selectedAlly?.allyId
            ? alliesById[selectedAlly.allyId]?.name ?? selectedAlly.name
            : selectedAlly?.name ?? ""
        }
        initialDisplayName={selectedAlly?.displayName ?? ""}
        onSubmit={(values) => void handleEditAlly(values)}
      />
      {attackSubmitDraft ? (
        <CombatAttackSubmitModal
          attack={attackSubmitDraft.attack}
          optionName={attackSubmitDraft.option.name}
          targets={attackSubmitDraft.targets}
          attackerToken={attackSubmitDraft.attackerToken}
          attackerCharacter={
            attackSubmitDraft.attackerToken?.characterId
              ? charactersById[attackSubmitDraft.attackerToken.characterId]?.data
              : undefined
          }
          combatState={combatState}
          attackDisadvantageByTokenId={attackSubmitDraft.attackDisadvantageByTokenId ?? {}}
          attackAdvantageByTokenId={attackSubmitDraft.attackAdvantageByTokenId ?? {}}
          charactersById={charactersById}
          enemiesBySlug={enemiesBySlug}
          catalogItems={catalogItems}
          classCatalog={classCatalog}
          damageTakenByTokenId={damageTakenByTokenId}
          showDmUi={showDmUi}
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
          onSelect={(ally) => void handleConfirmHelp(ally)}
          onCancel={() => setHelpTargetPickerAllies(null)}
        />
      ) : null}
      {stabilizeTargetPicker ? (
        <CombatStabilizeTargetModal
          allies={stabilizeTargetPicker.allies}
          resolvePortraitUrl={(token) => resolveTokenPortraitUrl(supabase, token)}
          onSelect={(ally) => {
            setStabilizeTargetPicker(null);
            setStabilizeModal({
              targetToken: ally,
              viaSpell: stabilizeTargetPicker.viaSpell,
            });
          }}
          onCancel={() => setStabilizeTargetPicker(null)}
        />
      ) : null}
      {stabilizeModal && actingTokenCharacter ? (
        <StabilizeActionModal
          actorData={actingTokenCharacter.data}
          targetLabel={getCombatTokenDisplayLabel(stabilizeModal.targetToken)}
          hasHealersKit={actingTokenCharacter.data.inventory.items.some(
            (item) => item.itemId === "healers-kit" && item.quantity > 0
          )}
          viaSpell={stabilizeModal.viaSpell}
          onCancel={() => setStabilizeModal(null)}
          onStabilize={() =>
            void handleConfirmStabilize(
              stabilizeModal.targetToken,
              stabilizeModal.viaSpell
            )
          }
        />
      ) : null}
      {deathSaveModal && deathSaveModalCharacter
        ? createPortal(
            <DeathSaveRollModal
              data={deathSaveModalCharacter.data}
              onCancel={handleDeathSaveModalCancel}
              onClose={() => void handleDeathSaveModalClose()}
              onApply={(combat) => handleApplyDeathSave(combat)}
            />,
            document.body
          )
        : null}
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
          onConfirmRefill={() => void handleConfirmAmmoRefill()}
          onCancel={() => setEquipmentChangeOpen(false)}
        />
      ) : null}
      {pendingDashDestination ? (
        <CombatDashConfirmModal
          movementGainedFeet={currentSpeedFt}
          forDestination
          onConfirm={() => void handleConfirmDashMove()}
          onCancel={() => setPendingDashDestination(null)}
        />
      ) : null}
      {pendingDashActionConfirm ? (
        <CombatDashConfirmModal
          movementGainedFeet={currentSpeedFt}
          onConfirm={() => void handleConfirmDashAction()}
          onCancel={() => setPendingDashActionConfirm(false)}
        />
      ) : null}
      {needsMultiattackBranchPicker && !multiattackBranchDismissed ? (
        <CombatMultiattackBranchModal
          branches={currentTurnOptionGroups.multiattackBranches ?? []}
          preamble={currentTurnOptionGroups.multiattackPreamble}
          onSelectBranch={(branchIndex) => void handleSelectMultiattackBranch(branchIndex)}
          onCancel={() => setMultiattackBranchDismissed(true)}
        />
      ) : null}
      {pendingShellDefenseConfirm ? (
        <CombatShellDefenseConfirmModal
          onConfirm={() => void handleConfirmShellDefense()}
          onCancel={() => setPendingShellDefenseConfirm(false)}
        />
      ) : null}
      {pendingHpPoolFeatureId && actingToken && actingTokenCharacter ? (
        <CombatHpPoolModal
          featureId={pendingHpPoolFeatureId}
          actorToken={actingToken}
          actorCharacter={actingTokenCharacter}
          combatState={combatState}
          partyCharacters={localCharacters}
          featureCatalogs={featureCatalogs}
          onConfirm={handleConfirmHpPool}
          onClose={() => setPendingHpPoolFeatureId(null)}
        />
      ) : null}
      {pendingOtherActionsConfirm ? (
        <CombatOtherActionsModal
          onCancel={() => setPendingOtherActionsConfirm(false)}
          onUse={() => void handleConfirmOtherActions()}
        />
      ) : null}
      {statesModalOpen && statesModalContext ? (
        <CombatStatesModal
          tokenLabel={statesModalContext.tokenLabel}
          conditions={statesModalContext.conditions}
          protectedSlugs={statesModalContext.protectedSlugs}
          saving={savingStates}
          onCancel={() => setStatesModalOpen(false)}
          onSave={(nextConditions) => void handleSaveTokenStates(nextConditions)}
        />
      ) : null}
      {pendingSpellcasting && actingTokenCharacter ? (
        <CombatSpellPickerModal
          character={actingTokenCharacter.data}
          catalogItems={catalogItems}
          castingCost={pendingSpellcasting.castingCost}
          preselectedEntry={pendingSpellcasting.preselectedEntry}
          onCancel={() => setPendingSpellcasting(null)}
          onConfirm={handleSpellPickerConfirm}
        />
      ) : null}
      {pendingSpellCast && actingTokenCharacter ? (
        <CombatSpellCastModal
          option={pendingSpellCast}
          character={actingTokenCharacter.data}
          catalogItems={catalogItems}
          onCancel={() => setPendingSpellCast(null)}
          onConfirm={(materialSelections) => void handleConfirmSpellCast(materialSelections)}
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
      {characterSlotToken && isCharacterPlaceholder(characterSlotToken) && showDmUi ? (
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
      !showDmUi &&
      ownedCharacter ? (
        <CharacterSlotClaimModal
          characterName={ownedCharacter.name}
          claiming={assigningCharacterSlot}
          onConfirm={() => void handleClaimCharacterSlot()}
          onCancel={() => setCharacterSlotTokenId(null)}
        />
      ) : null}
      {showDmUi ? (
        <CombatXpModal
          key={xpModalOpen ? "open" : "closed"}
          open={xpModalOpen}
          xpPool={combatState.xpPool ?? 0}
          characters={localCharacters}
          participantCharacterIds={xpModalParticipantIds}
          defaultAllyCount={onBoardAllyCount}
          distributing={distributingXp}
          onClose={() => setXpModalOpen(false)}
          onDistribute={(selectedCharacterIds, allyCount) =>
            void handleDistributeXp(selectedCharacterIds, allyCount)
          }
        />
      ) : null}
    </div>
  );
}
