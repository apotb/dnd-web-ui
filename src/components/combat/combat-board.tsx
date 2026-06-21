"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addEnemyToState,
  clearEnemiesFromState,
  removeEnemyFromState,
  syncPartyTokens,
  updateGridInState,
  updateTokenInState,
  type EnemyRecord,
} from "@/lib/combat/state-utils";
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

interface CombatBoardProps {
  campaignId: string;
  initialCombatState: CombatState;
  characters: ParsedCharacter[];
  enemies: EnemyRecord[];
  isDm: boolean;
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
}: CombatBoardProps) {
  const enemiesBySlug = useMemo(
    () => Object.fromEntries(enemies.map((enemy) => [enemy.slug, enemy])),
    [enemies]
  );

  const charactersById = useMemo(
    () => Object.fromEntries(characters.map((character) => [character.id, character])),
    [characters]
  );

  const liveState = useRealtimeCombatState(campaignId, initialCombatState);
  const [draft, setDraft] = useState(liveState);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const draggingTokenIdRef = useRef<string | null>(null);
  const combatStateRef = useRef<CombatState>(initialCombatState);
  const supabase = useMemo(() => createClient(), []);

  const combatState = isDm ? draft : liveState;

  combatStateRef.current = combatState;

  const backgroundUrl = useMemo(
    () => resolveCombatImageUrl(supabase, combatState.backgroundPath),
    [combatState.backgroundPath, supabase]
  );

  const persist = useCallback(
    async (next: CombatState) => {
      if (!isDm) return;
      setDraft(next);
      await persistCombatState(campaignId, next);
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

  useEffect(() => {
    if (!isDm) return;
    if (draggingTokenIdRef.current) return;
    setDraft(liveState);
  }, [isDm, liveState]);

  useEffect(() => {
    if (!isDm) return;
    setDraft((prev) => syncPartyTokens(prev, characters));
  }, [characters, isDm]);

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

  const selectedToken = selectedTokenId
    ? combatState.tokens.find((token) => token.id === selectedTokenId) ?? null
    : null;

  async function handleAddEnemy(enemy: EnemyRecord) {
    const next = addEnemyToState(combatState, enemy);
    await persist(next);
    setAddOpen(false);
  }

  async function handleRemoveSelected() {
    if (!selectedToken || selectedToken.kind !== "enemy") return;
    if (!window.confirm(`Remove ${selectedToken.label} from the board?`)) return;
    const next = removeEnemyFromState(combatState, selectedToken.id);
    await persist(next);
    setSelectedTokenId(null);
  }

  async function handleClearEnemies() {
    if (
      !window.confirm(
        "Remove all enemies from the board?\n\nParty tokens will stay in place."
      )
    ) {
      return;
    }
    const next = clearEnemiesFromState(combatState, characters);
    await persist(next);
    setSelectedTokenId(null);
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
    const isExpanded =
      isHovered &&
      ((isDm && enemy) || (token.kind === "party" && character != null));

    const isDragging = draggingTokenId === token.id;

    const style = {
      gridColumn: `${token.x + 1} / span ${token.width}`,
      gridRow: `${token.y + 1} / span ${token.height}`,
    };

    return (
      <div
        key={token.id}
        className={`combat-token combat-token-on-grid ${tokenColorClass(token.kind)}${isDm ? " combat-token-dm" : ""}${isSelected ? " combat-token-selected" : ""}${isExpanded ? " combat-token-expanded" : ""}${isDragging ? " combat-token-dragging" : ""}`}
        style={style}
        onPointerDown={(event) => handleTokenPointerDown(token.id, event)}
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
                  HP {character.data.combat.currentHp}/{character.data.combat.maxHp}
                </span>
                <span className="combat-token-label-detail">
                  Speed {character.data.combat.speed} ft
                </span>
              </>
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

  return (
    <div className="combat-stage">
      <div className="combat-layout">
        <div className="combat-turn-column" aria-hidden="true" />

        <div className="combat-main">
          <div className="combat-board-area">
            <div className="combat-toolbar">
              <div>
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
              {isDm ? (
                <div className="combat-toolbar-actions">
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
                  <button type="button" className="candy-btn" onClick={() => setAddOpen(true)}>
                    Add enemy
                  </button>
                  <button
                    type="button"
                    className="candy-btn"
                    onClick={handleRemoveSelected}
                    disabled={!selectedToken || selectedToken.kind !== "enemy"}
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    className="candy-btn candy-btn-danger"
                    onClick={handleClearEnemies}
                  >
                    Reset
                  </button>
                </div>
              ) : null}
            </div>

            <div className="combat-grid-shell">
              <div
                ref={gridRef}
                className={`combat-grid${draggingTokenId ? " combat-grid-dragging" : ""}`}
                style={{
                  ["--grid-width" as string]: combatState.gridWidth,
                  ["--grid-height" as string]: combatState.gridHeight,
                }}
                onPointerMove={(event) => {
                  updateHoverFromPointer(event.clientX, event.clientY);
                }}
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
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddEnemyDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        enemies={enemies}
        onSelect={handleAddEnemy}
      />
    </div>
  );
}
