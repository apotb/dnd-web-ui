import { z } from "zod";
import {
  DEFAULT_GRID_SIZE,
  DEFAULT_TILE_FEET,
  MAX_GRID_SIZE,
  MAX_TILE_FEET,
  MIN_GRID_SIZE,
  MIN_TILE_FEET,
} from "@/lib/schemas/combat-grid";

export const TOKEN_KINDS = ["party", "enemy", "ally", "marker"] as const;
export type TokenKind = (typeof TOKEN_KINDS)[number];

export const initiativeTokenResultSchema = z.object({
  total: z.number().int(),
  roll: z.number().int().min(1).max(20),
  modifier: z.number().int(),
  dexMod: z.number().int(),
});

export const combatInitiativeSchema = z.object({
  status: z.enum(["none", "collecting", "ready"]).default("none"),
  results: z.record(z.string(), initiativeTokenResultSchema).default({}),
  order: z.array(z.string()).default([]),
});

export const combatTurnSchema = z.object({
  active: z.boolean().default(false),
  index: z.number().int().min(0).default(0),
  round: z.number().int().min(1).default(1),
  movementUsedFeet: z.number().int().min(0).default(0),
  dashUsed: z.boolean().default(false),
  /** Main-hand weapon attack used this turn; unlocks off-hand two-weapon fighting. */
  actionUsedForTwoWeapon: z.boolean().default(false),
  /** Standard action consumed this turn. */
  actionUsed: z.boolean().default(false),
  /** Bonus action consumed this turn. */
  bonusActionUsed: z.boolean().default(false),
  /** Disengage action used this turn; movement does not provoke opportunity attacks. */
  disengageUsed: z.boolean().default(false),
  /** Free object interaction consumed this turn (first pickup is free). */
  freeObjectInteractionUsed: z.boolean().default(false),
});

export const pendingAttackTargetSchema = z.object({
  tokenId: z.string(),
  label: z.string(),
  ac: z.number().int().optional(),
  currentHp: z.number().int().optional(),
  maxHp: z.number().int().optional(),
  damageTakenBefore: z.number().int().min(0).default(0),
  requiresSave: z.boolean().default(false),
  saveSubmitted: z.boolean().default(false),
  needsDmSave: z.boolean().default(false),
  attackRoll: z.number().int().min(1).max(20).nullable().optional(),
  attackRoll2: z.number().int().min(1).max(20).nullable().optional(),
  attackDisadvantage: z.boolean().default(false),
  attackTotal: z.number().int().nullable().optional(),
  hit: z.boolean().nullable().optional(),
  critical: z.boolean().nullable().optional(),
  damageText: z.string().optional(),
  damageRolls: z.array(z.number().int().min(1)).optional(),
  damageAmount: z.number().int().min(0).nullable().optional(),
  saveRoll: z.number().int().min(1).max(20).nullable().optional(),
  saveTotal: z.number().int().nullable().optional(),
  saveSucceeded: z.boolean().nullable().optional(),
  finalDamage: z.number().int().min(0).nullable().optional(),
});

export const pendingAttackSchema = z.object({
  id: z.string(),
  attackerTokenId: z.string(),
  optionId: z.string(),
  optionName: z.string(),
  actionCost: z.enum(["action", "bonus-action", "reaction"]),
  isOpportunityAttack: z.boolean().default(false),
  skipDmReview: z.boolean().default(false),
  rollType: z.enum(["attack", "save", "auto"]),
  attackBonus: z.number().int().optional(),
  saveDc: z.number().int().optional(),
  saveAbility: z.string().optional(),
  damageType: z.string().optional(),
  damageDice: z.string().optional(),
  isMainHandWeapon: z.boolean().default(false),
  isAoe: z.boolean().default(false),
  ammunitionInventoryItemId: z.string().optional(),
  ammunitionItemName: z.string().optional(),
  ammunitionQuantity: z.number().int().min(1).optional(),
  thrownInventoryItemId: z.string().optional(),
  thrownItemName: z.string().optional(),
  thrownItemId: z.string().optional(),
  thrownRemaining: z.number().int().min(1).optional(),
  aoeCenter: z.object({ x: z.number().int(), y: z.number().int() }).optional(),
  aoeShape: z.enum(["radius", "cone", "cube"]).optional(),
  status: z.enum(["awaiting-saves", "awaiting-dm-review"]),
  targets: z.array(pendingAttackTargetSchema),
  narration: z.string().default(""),
});

export const combatTokenSchema = z.object({
  id: z.string(),
  kind: z.enum(TOKEN_KINDS),
  name: z.string().default(""),
  label: z.string().default(""),
  /** When set, shown instead of the auto-generated label (e.g. "Thug A"). */
  displayName: z.string().optional(),
  tooltip: z.string().default(""),
  enemySlug: z.string().optional(),
  characterId: z.string().optional(),
  portraitPath: z.string().nullable().default(null),
  droppedByCharacterId: z.string().optional(),
  droppedItemId: z.string().optional(),
  droppedInventoryItemId: z.string().optional(),
  x: z.number().int().min(0).default(0),
  y: z.number().int().min(0).default(0),
  width: z.number().int().min(1).default(1),
  height: z.number().int().min(1).default(1),
  placed: z.boolean().default(false),
  currentHp: z.number().int().optional(),
  maxHp: z.number().int().optional(),
  damageTaken: z.number().int().min(0).default(0),
  /** When true, marker tokens block movement pathfinding (ignored for other kinds). */
  hasCollision: z.boolean().default(false),
  /** When true, marker acts as an interactable object. */
  isObject: z.boolean().default(false),
  /** When true, adjacent characters can pick up pickupItemId from this marker. */
  itemPickup: z.boolean().default(false),
  /** Catalog item slug granted on pickup. */
  pickupItemId: z.string().optional(),
  /** Quantity added to inventory on pickup. */
  pickupQuantity: z.number().int().min(1).default(1),
  /** When true, enemy tokens are invisible to players until revealed. */
  hidden: z.boolean().default(false),
});

export const pendingOpportunityAttacksSchema = z.object({
  provokingTokenId: z.string(),
  pendingAttackerTokenIds: z.array(z.string()),
  /** Present when movement is deferred until OAs resolve; omitted on legacy states. */
  destination: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .nullish(),
  costFeet: z.number().nullish(),
  dashConsumed: z.boolean().nullish(),
});

export const DEFAULT_BOARD_TITLE = "Combat";

export const blockedCellSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
});

export const combatStateSchema = z.object({
  gridWidth: z.number().int().min(MIN_GRID_SIZE).max(MAX_GRID_SIZE).default(DEFAULT_GRID_SIZE),
  gridHeight: z.number().int().min(MIN_GRID_SIZE).max(MAX_GRID_SIZE).default(DEFAULT_GRID_SIZE),
  tileFeet: z.number().int().min(MIN_TILE_FEET).max(MAX_TILE_FEET).default(DEFAULT_TILE_FEET),
  backgroundPath: z.string().nullable().default(null),
  blockedCells: z.array(blockedCellSchema).default([]),
  tokens: z.array(combatTokenSchema).default([]),
  excludedPartyCharacterIds: z.array(z.string()).default([]),
  initiative: combatInitiativeSchema.default({ status: "none", results: {}, order: [] }),
  turn: combatTurnSchema.default({
    active: false,
    index: 0,
    round: 1,
    movementUsedFeet: 0,
    dashUsed: false,
    actionUsedForTwoWeapon: false,
    actionUsed: false,
    bonusActionUsed: false,
    disengageUsed: false,
    freeObjectInteractionUsed: false,
  }),
  pendingAttacks: z.array(pendingAttackSchema).default([]),
  pendingOpportunityAttacks: pendingOpportunityAttacksSchema.nullable().default(null),
  boardTitle: z.string().default(DEFAULT_BOARD_TITLE),
  savedEncounterId: z.string().uuid().nullable().default(null),
});

export type BlockedCell = z.infer<typeof blockedCellSchema>;
export type CombatToken = z.infer<typeof combatTokenSchema>;
export type PendingOpportunityAttacks = z.infer<typeof pendingOpportunityAttacksSchema>;
export type PendingAttackTarget = z.infer<typeof pendingAttackTargetSchema>;
export type PendingAttack = z.infer<typeof pendingAttackSchema>;
export type CombatInitiative = z.infer<typeof combatInitiativeSchema>;
export type CombatTurn = z.infer<typeof combatTurnSchema>;
export type InitiativeTokenResult = z.infer<typeof initiativeTokenResultSchema>;
export type CombatState = z.infer<typeof combatStateSchema>;

export function isCombatantToken(token: CombatToken): boolean {
  return token.kind !== "marker";
}

export function isHiddenEnemy(token: CombatToken): boolean {
  return token.kind === "enemy" && token.hidden === true;
}

/** Combatants that participate in the visible turn order. */
export function isTokenInTurnOrder(token: CombatToken): boolean {
  return isCombatantToken(token) && !isHiddenEnemy(token);
}

const DEFAULT_TURN: CombatTurn = {
  active: false,
  index: 0,
  round: 1,
  movementUsedFeet: 0,
  dashUsed: false,
  actionUsedForTwoWeapon: false,
  actionUsed: false,
  bonusActionUsed: false,
  disengageUsed: false,
  freeObjectInteractionUsed: false,
};

export function normalizeCombatTurn(state: CombatState): CombatState {
  const order = state.initiative.order;
  if (state.initiative.status !== "ready" || order.length === 0) {
    return { ...state, turn: DEFAULT_TURN };
  }

  if (!state.turn.active) {
    return {
      ...state,
      turn: {
        active: true,
        index: 0,
        round: 1,
        movementUsedFeet: 0,
        dashUsed: false,
        actionUsedForTwoWeapon: false,
        actionUsed: false,
        bonusActionUsed: false,
        disengageUsed: false,
        freeObjectInteractionUsed: false,
      },
    };
  }

  const index = Math.min(Math.max(0, state.turn.index), order.length - 1);
  return {
    ...state,
    turn: {
      active: true,
      index,
      round: Math.max(1, state.turn.round),
      movementUsedFeet: Math.max(0, state.turn.movementUsedFeet ?? 0),
      dashUsed: state.turn.dashUsed ?? false,
      actionUsedForTwoWeapon: state.turn.actionUsedForTwoWeapon ?? false,
      actionUsed: state.turn.actionUsed ?? false,
      bonusActionUsed: state.turn.bonusActionUsed ?? false,
      disengageUsed: state.turn.disengageUsed ?? false,
      freeObjectInteractionUsed: state.turn.freeObjectInteractionUsed ?? false,
    },
    pendingAttacks: state.pendingAttacks ?? [],
    pendingOpportunityAttacks: state.pendingOpportunityAttacks ?? null,
  };
}

function migrateCombatStateInput(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const raw = { ...(input as Record<string, unknown>) };
  if (!Array.isArray(raw.pendingAttacks)) {
    const legacy = raw.pendingAttack;
    raw.pendingAttacks =
      legacy != null && typeof legacy === "object" ? [legacy] : [];
  }
  delete raw.pendingAttack;
  return raw;
}

export function parseCombatState(input: unknown): CombatState {
  const parsed = combatStateSchema.parse(migrateCombatStateInput(input ?? {}));

  return normalizeCombatTurn({
    ...parsed,
    blockedCells: parsed.blockedCells.filter(
      (cell) => cell.x < parsed.gridWidth && cell.y < parsed.gridHeight
    ),
    tokens: parsed.tokens.map((token) => clampTokenToGrid(token, parsed)),
  });
}

function clampTokenToGrid(token: CombatToken, state: CombatState): CombatToken {
  const maxX = Math.max(0, state.gridWidth - token.width);
  const maxY = Math.max(0, state.gridHeight - token.height);
  return {
    ...token,
    x: Math.min(Math.max(0, token.x), maxX),
    y: Math.min(Math.max(0, token.y), maxY),
  };
}
