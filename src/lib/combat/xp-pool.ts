import { getEnemyXpValue } from "@/lib/dnd/enemy-xp";
import type { EnemyRecord } from "@/lib/combat/state-utils";
import type { CombatState } from "@/lib/schemas/combat-state";

export interface XpRecipient {
  id: string;
  currentXp: number;
}

function isDefeatedEnemy(token: CombatState["tokens"][number]): boolean {
  if (token.kind !== "enemy" || !token.enemySlug) return false;
  const hp = token.currentHp ?? token.maxHp ?? 0;
  return hp <= 0;
}

/** Credit XP for newly defeated enemy tokens (once per token). */
export function creditXpForDefeatedEnemies(
  state: CombatState,
  enemiesBySlug: Record<string, Pick<EnemyRecord, "data">>
): CombatState {
  let xpPool = state.xpPool ?? 0;
  let tokensChanged = false;

  const tokens = state.tokens.map((token) => {
    if (!isDefeatedEnemy(token) || token.xpContributed) return token;

    const enemyData = enemiesBySlug[token.enemySlug!]?.data;
    if (!enemyData) return token;

    const xpValue = getEnemyXpValue(enemyData);
    if (xpValue > 0) {
      xpPool += xpValue;
    }

    tokensChanged = true;
    return { ...token, xpContributed: true };
  });

  if (!tokensChanged && xpPool === (state.xpPool ?? 0)) {
    return state;
  }

  return { ...state, tokens, xpPool };
}

export function clearXpPool(state: CombatState): CombatState {
  if ((state.xpPool ?? 0) === 0) return state;
  return { ...state, xpPool: 0 };
}

function shuffleWithRandom<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function orderRecipientsForRemainder(
  recipients: XpRecipient[],
  random: () => number
): XpRecipient[] {
  const groups = new Map<number, XpRecipient[]>();
  for (const recipient of recipients) {
    const list = groups.get(recipient.currentXp) ?? [];
    list.push(recipient);
    groups.set(recipient.currentXp, list);
  }

  const ordered: XpRecipient[] = [];
  for (const xp of [...groups.keys()].sort((a, b) => a - b)) {
    ordered.push(...shuffleWithRandom(groups.get(xp)!, random));
  }
  return ordered;
}

/** Split partyTotal across recipients; lower currentXp gets +1 from remainder; ties random. */
function splitPartyTotal(
  partyTotal: number,
  recipients: XpRecipient[],
  random: () => number
): Map<string, number> {
  const result = new Map<string, number>();
  if (recipients.length === 0 || partyTotal <= 0) return result;

  const base = Math.floor(partyTotal / recipients.length);
  const remainder = partyTotal % recipients.length;
  const ordered = orderRecipientsForRemainder(recipients, random);

  for (let i = 0; i < ordered.length; i++) {
    const extra = i < remainder ? 1 : 0;
    result.set(ordered[i].id, base + extra);
  }

  return result;
}

export function distributeXpPool(
  totalXp: number,
  recipients: XpRecipient[],
  allyCount: number,
  random: () => number = Math.random
): Map<string, number> {
  const partyCount = recipients.length;
  const totalShares = partyCount + Math.max(0, allyCount);

  if (partyCount === 0 || totalShares === 0 || totalXp <= 0) {
    return new Map();
  }

  const partyTotal = Math.floor((totalXp * partyCount) / totalShares);
  return splitPartyTotal(partyTotal, recipients, random);
}

/** Preview min/max per recipient without tie-breaking randomness. */
export function previewXpDistribution(
  totalXp: number,
  partyCount: number,
  allyCount: number
): { partyTotal: number; minEach: number; maxEach: number } | null {
  const totalShares = partyCount + Math.max(0, allyCount);
  if (partyCount === 0 || totalShares === 0 || totalXp <= 0) return null;

  const partyTotal = Math.floor((totalXp * partyCount) / totalShares);
  const base = Math.floor(partyTotal / partyCount);
  const remainder = partyTotal % partyCount;

  return {
    partyTotal,
    minEach: base,
    maxEach: base + (remainder > 0 ? 1 : 0),
  };
}
