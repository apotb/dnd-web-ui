import { z } from "zod";
import {
  DEFAULT_GRID_SIZE,
  DEFAULT_TILE_FEET,
  MAX_GRID_SIZE,
  MAX_TILE_FEET,
  MIN_GRID_SIZE,
  MIN_TILE_FEET,
} from "@/lib/schemas/combat-grid";

export const TOKEN_KINDS = ["party", "enemy", "ally"] as const;
export type TokenKind = (typeof TOKEN_KINDS)[number];

export const combatTokenSchema = z.object({
  id: z.string(),
  kind: z.enum(TOKEN_KINDS),
  name: z.string().default(""),
  label: z.string().default(""),
  enemySlug: z.string().optional(),
  characterId: z.string().optional(),
  portraitPath: z.string().nullable().default(null),
  x: z.number().int().min(0).default(0),
  y: z.number().int().min(0).default(0),
  width: z.number().int().min(1).default(1),
  height: z.number().int().min(1).default(1),
  placed: z.boolean().default(false),
  currentHp: z.number().int().optional(),
  maxHp: z.number().int().optional(),
});

export const combatStateSchema = z.object({
  gridWidth: z.number().int().min(MIN_GRID_SIZE).max(MAX_GRID_SIZE).default(DEFAULT_GRID_SIZE),
  gridHeight: z.number().int().min(MIN_GRID_SIZE).max(MAX_GRID_SIZE).default(DEFAULT_GRID_SIZE),
  tileFeet: z.number().int().min(MIN_TILE_FEET).max(MAX_TILE_FEET).default(DEFAULT_TILE_FEET),
  backgroundPath: z.string().nullable().default(null),
  tokens: z.array(combatTokenSchema).default([]),
});

export type CombatToken = z.infer<typeof combatTokenSchema>;
export type CombatState = z.infer<typeof combatStateSchema>;

export function parseCombatState(input: unknown): CombatState {
  const parsed = combatStateSchema.parse(input ?? {});

  return {
    ...parsed,
    tokens: parsed.tokens.map((token) => clampTokenToGrid(token, parsed)),
  };
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
