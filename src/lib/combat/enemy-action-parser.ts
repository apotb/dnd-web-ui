import type { DerivedAttack } from "@/lib/dnd/attacks";
import type { EnemyNamedBlock } from "@/lib/schemas/enemy";

export type EnemyActionKind =
  | "weapon-melee"
  | "weapon-ranged"
  | "weapon-dual"
  | "save"
  | "multiattack"
  | "other";

export interface ParsedEnemyAction {
  kind: EnemyActionKind;
  action: EnemyNamedBlock;
  index: number;
  /** Set when kind is weapon-* or save. */
  attack?: DerivedAttack;
  /** For dual-mode weapons, separate melee and ranged variants. */
  dualAttacks?: { melee: DerivedAttack; ranged: DerivedAttack };
}

const ABILITY_SAVE_MAP: Record<string, string> = {
  strength: "Str",
  dexterity: "Dex",
  constitution: "Con",
  intelligence: "Int",
  wisdom: "Wis",
  charisma: "Cha",
};

function normalizeWeaponName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^its\s+/, "")
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

export function normalizeEnemyWeaponKey(name: string): string {
  return normalizeWeaponName(name);
}

export function isMultiattackAction(action: EnemyNamedBlock): boolean {
  if (/^multiattack$/i.test(action.name.trim())) return true;
  return /\bmakes?\s+(?:the following\s+)?attacks?\b/i.test(action.description.trim());
}

function parseHitDamage(text: string): { damageDice: string; damageType: string } | null {
  const hitMatch = text.match(
    /Hit:\s*\d+\s*\(([^)]+)\)\s+(\w+)\s+damage/i
  );
  if (hitMatch) {
    return { damageDice: hitMatch[1].trim(), damageType: hitMatch[2].trim().toLowerCase() };
  }
  const takesMatch = text.match(
    /takes?\s+\d+\s*\(([^)]+)\)\s+(\w+)\s+damage/i
  );
  if (takesMatch) {
    return { damageDice: takesMatch[1].trim(), damageType: takesMatch[2].trim().toLowerCase() };
  }
  const takingMatch = text.match(
    /taking\s+\d+\s*\(([^)]+)\)\s+(\w+)\s+damage/i
  );
  if (takingMatch) {
    return { damageDice: takingMatch[1].trim(), damageType: takingMatch[2].trim().toLowerCase() };
  }
  return null;
}

function parseAttackBonus(text: string): number | null {
  const match = text.match(/([+-]\d+)\s+to hit/i);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function parseReachFt(text: string): number {
  const match = text.match(/reach\s+(\d+)\s*ft/i);
  return match ? parseInt(match[1], 10) : 5;
}

function parseRangeBand(text: string): string | null {
  const match = text.match(/range\s+(\d+)\s*\/\s*(\d+)\s*ft/i);
  if (!match) return null;
  return `${match[1]}/${match[2]} ft`;
}

function parseSaveAbility(text: string): string | null {
  const match = text.match(
    /DC\s+\d+\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i
  );
  if (!match) return null;
  return ABILITY_SAVE_MAP[match[1].toLowerCase()] ?? match[1].slice(0, 3);
}

function parseSaveDc(text: string): number | null {
  const match = text.match(/DC\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function parseSaveRange(text: string): string {
  const coneMatch = text.match(/(\d+)-foot cone/i);
  if (coneMatch) return `${coneMatch[1]}-ft cone`;

  const radiusMatch = text.match(/(\d+)-foot radius/i);
  if (radiusMatch) return `${radiusMatch[1]}-ft radius`;

  const cubeMatch = text.match(/(\d+)-foot cube/i);
  if (cubeMatch) return `${cubeMatch[1]}-ft cube`;

  const lineMatch = text.match(/(\d+)-foot line/i);
  if (lineMatch) return `${lineMatch[1]}-ft line`;

  const withinMatch = text.match(/within\s+(\d+)\s+feet/i);
  if (withinMatch) return `${withinMatch[1]} ft`;

  const rangeFt = text.match(/range\s+(\d+)\s*ft/i);
  if (rangeFt) return `${rangeFt[1]} ft`;

  const selfSpace = /\beach creature in (?:the )?(?:\w+'s )?space\b/i.test(text);
  if (selfSpace) return "self-space";

  return "self-space";
}

function parseSaveHalfDamage(text: string): boolean {
  if (/half as much damage on a successful/i.test(text)) return true;
  if (/takes half as much damage/i.test(text)) return true;
  if (/half damage on a successful/i.test(text)) return true;
  return false;
}

function buildEnemyDerivedAttack(
  action: EnemyNamedBlock,
  index: number,
  fields: Omit<DerivedAttack, "id" | "name" | "notes">
): DerivedAttack {
  return {
    id: `enemy:${index}:${action.name}`,
    name: action.name.trim() || "Attack",
    notes: action.description.trim(),
    ...fields,
  };
}

function parseWeaponAttack(
  action: EnemyNamedBlock,
  index: number,
  description: string
): ParsedEnemyAction | null {
  const isDual = /\bMelee or Ranged Weapon Attack:/i.test(description);
  const isMelee = /\bMelee Weapon Attack:/i.test(description) || isDual;
  const isRanged = /\bRanged Weapon Attack:/i.test(description);

  if (!isMelee && !isRanged) return null;

  const attackBonus = parseAttackBonus(description);
  if (attackBonus == null) return null;

  const damage = parseHitDamage(description);
  if (!damage) return null;

  if (isDual) {
    const reachFt = parseReachFt(description);
    const rangeBand = parseRangeBand(description) ?? "20/60 ft";
    const base = {
      attackBonus,
      damageDice: damage.damageDice,
      damageType: damage.damageType,
      source: "enemy" as const,
      rollType: "attack" as const,
    };
    const melee = buildEnemyDerivedAttack(action, index, {
      ...base,
      range: `${reachFt} ft`,
    });
    const ranged: DerivedAttack = {
      ...buildEnemyDerivedAttack(action, index, {
        ...base,
        range: rangeBand,
      }),
      id: `enemy:${index}:${action.name}:ranged`,
      name: `${action.name.trim()} (ranged)`,
    };
    return {
      kind: "weapon-dual",
      action,
      index,
      attack: melee,
      dualAttacks: { melee, ranged },
    };
  }

  if (isRanged && !/\bMelee Weapon Attack:/i.test(description)) {
    const rangeBand = parseRangeBand(description) ?? "60/120 ft";
    return {
      kind: "weapon-ranged",
      action,
      index,
      attack: buildEnemyDerivedAttack(action, index, {
        attackBonus,
        damageDice: damage.damageDice,
        damageType: damage.damageType,
        range: rangeBand,
        source: "enemy",
        rollType: "attack",
      }),
    };
  }

  const reachFt = parseReachFt(description);
  return {
    kind: "weapon-melee",
    action,
    index,
    attack: buildEnemyDerivedAttack(action, index, {
      attackBonus,
      damageDice: damage.damageDice,
      damageType: damage.damageType,
      range: `${reachFt} ft`,
      source: "enemy",
      rollType: "attack",
    }),
  };
}

function parseSaveAction(
  action: EnemyNamedBlock,
  index: number,
  description: string
): ParsedEnemyAction | null {
  const saveDc = parseSaveDc(description);
  const saveAbility = parseSaveAbility(description);
  if (saveDc == null || !saveAbility) return null;

  const damage = parseHitDamage(description);
  const range = parseSaveRange(description);

  return {
    kind: "save",
    action,
    index,
    attack: buildEnemyDerivedAttack(action, index, {
      attackBonus: 0,
      damageDice: damage?.damageDice ?? "",
      damageType: damage?.damageType ?? "",
      range,
      source: "enemy",
      rollType: "save",
      saveDc,
      saveAbility,
      saveHalfDamageOnSuccess: parseSaveHalfDamage(description),
    }),
  };
}

export function classifyEnemyAction(
  action: EnemyNamedBlock,
  index: number
): ParsedEnemyAction {
  if (isMultiattackAction(action)) {
    return { kind: "multiattack", action, index };
  }

  const description = action.description.trim();

  const weapon = parseWeaponAttack(action, index, description);
  if (weapon) return weapon;

  const save = parseSaveAction(action, index, description);
  if (save) return save;

  return { kind: "other", action, index };
}

export function parseEnemyActions(actions: EnemyNamedBlock[]): ParsedEnemyAction[] {
  return actions.map((action, index) => classifyEnemyAction(action, index));
}

export function enemyActionToDerivedAttack(
  action: EnemyNamedBlock,
  index: number,
  mode?: "melee" | "ranged"
): DerivedAttack | null {
  const parsed = classifyEnemyAction(action, index);
  if (parsed.kind === "weapon-dual" && parsed.dualAttacks) {
    return mode === "ranged" ? parsed.dualAttacks.ranged : parsed.dualAttacks.melee;
  }
  return parsed.attack ?? null;
}

export function isEnemyWeaponAction(parsed: ParsedEnemyAction): boolean {
  return (
    parsed.kind === "weapon-melee" ||
    parsed.kind === "weapon-ranged" ||
    parsed.kind === "weapon-dual"
  );
}

export function isEnemyMeleeParsedAction(parsed: ParsedEnemyAction): boolean {
  if (parsed.kind === "weapon-melee") return true;
  if (parsed.kind === "weapon-dual") return true;
  return false;
}

export function getParsedWeaponAttacks(
  parsedActions: ParsedEnemyAction[]
): ParsedEnemyAction[] {
  return parsedActions.filter(isEnemyWeaponAction);
}

export function matchWeaponNameToAction(
  weaponPhrase: string,
  parsedActions: ParsedEnemyAction[]
): ParsedEnemyAction | null {
  const key = normalizeWeaponName(weaponPhrase);
  for (const parsed of parsedActions) {
    if (!isEnemyWeaponAction(parsed)) continue;
    const actionKey = normalizeWeaponName(parsed.action.name);
    if (actionKey === key || actionKey.includes(key) || key.includes(actionKey)) {
      return parsed;
    }
  }
  return null;
}
