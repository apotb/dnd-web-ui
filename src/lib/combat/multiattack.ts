import {
  isMultiattackAction,
  matchWeaponNameToAction,
  normalizeEnemyWeaponKey,
  parseEnemyActions,
  type ParsedEnemyAction,
} from "@/lib/combat/enemy-action-parser";
import type { EnemyNamedBlock } from "@/lib/schemas/enemy";
import type { CombatState, CombatTurn } from "@/lib/schemas/combat-state";

export type MultiattackTurnFields = Pick<
  CombatTurn,
  | "actionUsed"
  | "multiattackBranchIndex"
  | "multiattackRemaining"
  | "multiattackTokenId"
>;

function shouldInitializeMultiattackRemaining(
  turn: MultiattackTurnFields,
  tokenId: string | null | undefined
): boolean {
  if (tokenId) {
    if ((turn.multiattackTokenId ?? null) !== tokenId) {
      return true;
    }
    if (!turn.actionUsed) {
      return Object.keys(turn.multiattackRemaining ?? {}).length === 0;
    }
    return false;
  }

  return !turn.actionUsed;
}

export interface MultiattackBranch {
  label: string;
  weaponLimits: Record<string, number>;
  categoryFilter?: "melee" | "ranged";
}

export interface MultiattackSpec {
  branches: MultiattackBranch[];
  preamble?: string;
}

function parseWeaponCountPhrase(text: string): Record<string, number> {
  const limits: Record<string, number> = {};
  const patterns = [
    /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+with\s+(?:its\s+)?(\w+)/gi,
    /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:\w+\s+)*attacks?\s+with\s+(?:its\s+)?(\w+)/gi,
  ];
  const wordToNum: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const rawCount = match[1].toLowerCase();
      const count =
        wordToNum[rawCount] ?? (Number.isFinite(parseInt(rawCount, 10)) ? parseInt(rawCount, 10) : 0);
      const weapon = match[2].toLowerCase().replace(/s$/, "");
      if (count > 0 && weapon && weapon !== "melee" && weapon !== "ranged") {
        limits[weapon] = (limits[weapon] ?? 0) + count;
      }
    }
  }
  return limits;
}

function parseCategoryCount(text: string): { melee?: number; ranged?: number } {
  const result: { melee?: number; ranged?: number } = {};
  const wordToNum: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  const meleeMatch = text.match(
    /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+melee\s+attacks?/i
  );
  if (meleeMatch) {
    const raw = meleeMatch[1].toLowerCase();
    result.melee = wordToNum[raw] ?? parseInt(raw, 10);
  }

  const rangedMatch = text.match(
    /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+ranged\s+attacks?/i
  );
  if (rangedMatch) {
    const raw = rangedMatch[1].toLowerCase();
    result.ranged = wordToNum[raw] ?? parseInt(raw, 10);
  }

  return result;
}

function resolveWeaponLimits(
  rawLimits: Record<string, number>,
  parsedActions: ParsedEnemyAction[]
): Record<string, number> {
  const resolved: Record<string, number> = {};
  for (const [phrase, count] of Object.entries(rawLimits)) {
    const matched = matchWeaponNameToAction(phrase, parsedActions);
    if (matched) {
      const key = normalizeEnemyWeaponKey(matched.action.name);
      resolved[key] = (resolved[key] ?? 0) + count;
    } else {
      resolved[normalizeEnemyWeaponKey(phrase)] = count;
    }
  }
  return resolved;
}

function parseBranchClause(
  clause: string,
  parsedActions: ParsedEnemyAction[]
): MultiattackBranch {
  const trimmed = clause.trim();
  const label = trimmed.replace(/\.$/, "");

  const categoryCounts = parseCategoryCount(trimmed);
  const rawWeaponLimits = parseWeaponCountPhrase(trimmed);

  if (categoryCounts.melee != null && Object.keys(rawWeaponLimits).length === 0) {
    return {
      label,
      weaponLimits: {},
      categoryFilter: "melee",
    };
  }

  if (categoryCounts.ranged != null && Object.keys(rawWeaponLimits).length === 0) {
    return {
      label,
      weaponLimits: {},
      categoryFilter: "ranged",
    };
  }

  if (Object.keys(rawWeaponLimits).length > 0) {
    return {
      label,
      weaponLimits: resolveWeaponLimits(rawWeaponLimits, parsedActions),
      ...(categoryCounts.ranged != null ? { categoryFilter: "ranged" as const } : {}),
    };
  }

  return { label, weaponLimits: {} };
}

export function parseMultiattackDescription(
  description: string,
  parsedActions: ParsedEnemyAction[]
): MultiattackSpec {
  let text = description.trim();
  let preamble: string | undefined;

  const thenMatch = text.match(/^(.+?\.\s*)?It then makes\s+(.+)$/i);
  if (thenMatch) {
    const before = thenMatch[1]?.trim();
    if (before && /\bcan use\b/i.test(before)) {
      preamble = before.replace(/\.$/, "");
    }
    text = `The creature makes ${thenMatch[2]}`;
  }

  const branchParts = text.split(/\.\s*(?:Or|Alternatively)\s+/i);
  const branches = branchParts.map((clause) => parseBranchClause(clause, parsedActions));

  return { branches, preamble };
}

export function findMultiattackAction(
  actions: EnemyNamedBlock[]
): { action: EnemyNamedBlock; index: number } | null {
  const idx = actions.findIndex((a) => isMultiattackAction(a));
  if (idx < 0) return null;
  return { action: actions[idx], index: idx };
}

export function getMultiattackSpec(enemyActions: EnemyNamedBlock[]): MultiattackSpec | null {
  const found = findMultiattackAction(enemyActions);
  if (!found) return null;
  const parsedActions = parseEnemyActions(enemyActions);
  return parseMultiattackDescription(found.action.description, parsedActions);
}

export function buildInitialMultiattackRemaining(
  branch: MultiattackBranch,
  parsedActions: ParsedEnemyAction[]
): Record<string, number> {
  if (Object.keys(branch.weaponLimits).length > 0) {
    return { ...branch.weaponLimits };
  }

  if (branch.categoryFilter === "melee") {
    const meleeWeapons = parsedActions.filter(
      (p) => p.kind === "weapon-melee" || p.kind === "weapon-dual"
    );
    const total =
      branch.label.match(/(\d+|one|two|three|four|five)\s+melee/i)?.[1] ?? "2";
    const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    const count = wordToNum[total.toLowerCase()] ?? (parseInt(total, 10) || 2);
    if (meleeWeapons.length === 1) {
      const key = normalizeEnemyWeaponKey(meleeWeapons[0].action.name);
      return { [key]: count };
    }
    return { __melee__: count };
  }

  if (branch.categoryFilter === "ranged") {
    const rangedWeapons = parsedActions.filter((p) => p.kind === "weapon-ranged");
    const total =
      branch.label.match(/(\d+|one|two|three|four|five)\s+ranged/i)?.[1] ?? "2";
    const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    const count = wordToNum[total.toLowerCase()] ?? (parseInt(total, 10) || 2);
    if (rangedWeapons.length === 1) {
      const key = normalizeEnemyWeaponKey(rangedWeapons[0].action.name);
      return { [key]: count };
    }
    return { __ranged__: count };
  }

  return {};
}

export function totalMultiattackRemaining(remaining: Record<string, number>): number {
  return Object.values(remaining).reduce((sum, n) => sum + n, 0);
}

export function decrementMultiattackRemaining(
  remaining: Record<string, number>,
  weaponName: string
): Record<string, number> {
  const key = normalizeEnemyWeaponKey(weaponName);
  const next = { ...remaining };

  if (next[key] != null && next[key] > 0) {
    next[key] -= 1;
    if (next[key] <= 0) delete next[key];
    return next;
  }

  if (next.__melee__ != null && next.__melee__ > 0) {
    next.__melee__ -= 1;
    if (next.__melee__ <= 0) delete next.__melee__;
    return next;
  }

  if (next.__ranged__ != null && next.__ranged__ > 0) {
    next.__ranged__ -= 1;
    if (next.__ranged__ <= 0) delete next.__ranged__;
    return next;
  }

  return next;
}

export function getMultiattackRemainingForWeapon(
  remaining: Record<string, number>,
  weaponName: string,
  parsed: ParsedEnemyAction
): number {
  const key = normalizeEnemyWeaponKey(weaponName);
  if (remaining[key] != null) return remaining[key];

  if (parsed.kind === "weapon-melee" || parsed.kind === "weapon-dual") {
    return remaining.__melee__ ?? 0;
  }
  if (parsed.kind === "weapon-ranged") {
    return remaining.__ranged__ ?? 0;
  }
  return 0;
}

export function getMultiattackMaxForWeapon(
  branch: MultiattackBranch,
  parsed: ParsedEnemyAction,
  parsedActions: ParsedEnemyAction[]
): number {
  const key = normalizeEnemyWeaponKey(parsed.action.name);
  if (branch.weaponLimits[key] != null) {
    return branch.weaponLimits[key];
  }

  const initial = buildInitialMultiattackRemaining(branch, parsedActions);
  if (initial[key] != null) return initial[key];
  if (
    (parsed.kind === "weapon-melee" || parsed.kind === "weapon-dual") &&
    initial.__melee__ != null
  ) {
    return initial.__melee__;
  }
  if (
    (parsed.kind === "weapon-ranged" || parsed.kind === "weapon-dual") &&
    initial.__ranged__ != null
  ) {
    return initial.__ranged__;
  }
  return 0;
}

export function ensureMultiattackTurnState(
  turn: MultiattackTurnFields,
  enemyActions: EnemyNamedBlock[],
  tokenId?: string | null
): MultiattackTurnFields {
  const spec = getMultiattackSpec(enemyActions);
  if (!spec) {
    return {
      actionUsed: turn.actionUsed,
      multiattackBranchIndex: turn.multiattackBranchIndex,
      multiattackRemaining: turn.multiattackRemaining ?? {},
      multiattackTokenId: turn.multiattackTokenId ?? null,
    };
  }

  const branchIndex =
    turn.multiattackBranchIndex ?? (spec.branches.length === 1 ? 0 : null);
  if (branchIndex == null) {
    return {
      actionUsed: turn.actionUsed,
      multiattackBranchIndex: turn.multiattackBranchIndex,
      multiattackRemaining: turn.multiattackRemaining ?? {},
      multiattackTokenId: turn.multiattackTokenId ?? null,
    };
  }

  const branch = spec.branches[branchIndex];
  if (!branch) {
    return {
      actionUsed: turn.actionUsed,
      multiattackBranchIndex: turn.multiattackBranchIndex,
      multiattackRemaining: turn.multiattackRemaining ?? {},
      multiattackTokenId: turn.multiattackTokenId ?? null,
    };
  }

  const parsedActions = parseEnemyActions(enemyActions);
  const shouldInitialize = shouldInitializeMultiattackRemaining(turn, tokenId);
  const multiattackRemaining = shouldInitialize
    ? buildInitialMultiattackRemaining(branch, parsedActions)
    : (turn.multiattackRemaining ?? {});

  return {
    actionUsed: turn.actionUsed,
    multiattackBranchIndex: branchIndex,
    multiattackRemaining,
    multiattackTokenId:
      shouldInitialize && tokenId
        ? tokenId
        : (turn.multiattackTokenId ?? null),
  };
}

export function applyMultiattackTurnStateToCombat(
  state: CombatState,
  tokenId: string,
  enemyActions: EnemyNamedBlock[]
): CombatState {
  const resolved = ensureMultiattackTurnState(state.turn, enemyActions, tokenId);
  const current = state.turn;
  if (
    resolved.multiattackBranchIndex === (current.multiattackBranchIndex ?? null) &&
    resolved.multiattackTokenId === (current.multiattackTokenId ?? null) &&
    JSON.stringify(resolved.multiattackRemaining) ===
      JSON.stringify(current.multiattackRemaining ?? {})
  ) {
    return state;
  }

  return {
    ...state,
    turn: {
      ...current,
      ...resolved,
    },
  };
}

export function applyMultiattackBranchSelection(
  state: CombatState,
  tokenId: string,
  branchIndex: number,
  initialRemaining: Record<string, number>
): CombatState {
  return {
    ...state,
    turn: {
      ...state.turn,
      multiattackBranchIndex: branchIndex,
      multiattackRemaining: initialRemaining,
      multiattackTokenId: tokenId,
    },
  };
}

export function isWeaponInMultiattackBranch(
  parsed: ParsedEnemyAction,
  branch: MultiattackBranch
): boolean {
  if (Object.keys(branch.weaponLimits).length > 0) {
    const key = normalizeEnemyWeaponKey(parsed.action.name);
    return branch.weaponLimits[key] != null;
  }
  if (branch.categoryFilter === "melee") {
    return parsed.kind === "weapon-melee" || parsed.kind === "weapon-dual";
  }
  if (branch.categoryFilter === "ranged") {
    return parsed.kind === "weapon-ranged" || parsed.kind === "weapon-dual";
  }
  return false;
}
