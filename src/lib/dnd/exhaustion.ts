import type { HarptosDate } from "@/lib/dnd/harptos-calendar";
import type {
  CharacterData,
  ExhaustionLevel,
  ExhaustionReason,
} from "@/lib/schemas/character";

export type ExhaustionEffectKind =
  | "ability_check_disadvantage"
  | "speed_halved"
  | "attack_save_disadvantage"
  | "max_hp_halved"
  | "speed_zero"
  | "death";

export interface ExhaustionLevelDefinition {
  level: number;
  kind: ExhaustionEffectKind;
  description: string;
}

export const EXHAUSTION_LEVEL_DEFINITIONS: ExhaustionLevelDefinition[] = [
  {
    level: 1,
    kind: "ability_check_disadvantage",
    description: "Disadvantage on ability checks",
  },
  {
    level: 2,
    kind: "speed_halved",
    description: "Speed halved",
  },
  {
    level: 3,
    kind: "attack_save_disadvantage",
    description: "Disadvantage on attack rolls and saving throws",
  },
  {
    level: 4,
    kind: "max_hp_halved",
    description: "Hit point maximum halved",
  },
  {
    level: 5,
    kind: "speed_zero",
    description: "Speed reduced to 0",
  },
  {
    level: 6,
    kind: "death",
    description: "Death",
  },
];

export const EXHAUSTION_EFFECTS: Record<number, string> = Object.fromEntries(
  EXHAUSTION_LEVEL_DEFINITIONS.map((def) => [def.level, def.description])
);

export const EXHAUSTION_DEATH_MESSAGES: Record<ExhaustionReason, string> = {
  Starvation: "You have died from starvation.",
  Dehydration: "You have died from dehydration.",
};

export const MAX_EXHAUSTION = EXHAUSTION_LEVEL_DEFINITIONS.length;

export interface ExhaustionModifiers {
  level: number;
  abilityCheckDisadvantage: boolean;
  attackSaveDisadvantage: boolean;
  speedMultiplier: number;
  maxHpMultiplier: number;
  isDead: boolean;
  deathReason: ExhaustionReason | null;
  activeDefinitions: ExhaustionLevelDefinition[];
}

export function getExhaustionEffectText(level: number): string {
  return (
    EXHAUSTION_LEVEL_DEFINITIONS.find((def) => def.level === level)
      ?.description ?? "Unknown effect"
  );
}

export function getExhaustionCount(data: CharacterData): number {
  return data.exhaustionLevels.length;
}

export function getExhaustionModifiers(data: CharacterData): ExhaustionModifiers {
  const level = getExhaustionCount(data);
  const activeDefinitions = EXHAUSTION_LEVEL_DEFINITIONS.filter(
    (def) => def.level <= level
  );
  const kinds = new Set(activeDefinitions.map((def) => def.kind));

  let speedMultiplier = 1;
  if (kinds.has("speed_zero")) speedMultiplier = 0;
  else if (kinds.has("speed_halved")) speedMultiplier = 0.5;

  let maxHpMultiplier = 1;
  if (kinds.has("death")) maxHpMultiplier = 0;
  else if (kinds.has("max_hp_halved")) maxHpMultiplier = 0.5;

  const deathReason =
    level >= MAX_EXHAUSTION
      ? (data.exhaustionLevels[MAX_EXHAUSTION - 1]?.reason ?? null)
      : null;

  return {
    level,
    abilityCheckDisadvantage: kinds.has("ability_check_disadvantage"),
    attackSaveDisadvantage: kinds.has("attack_save_disadvantage"),
    speedMultiplier,
    maxHpMultiplier,
    isDead: kinds.has("death"),
    deathReason,
    activeDefinitions,
  };
}

export function getExhaustionAbilityCheckSheetNote(
  data: CharacterData
): string | null {
  if (!getExhaustionModifiers(data).abilityCheckDisadvantage) return null;
  return "Exhaustion: disadvantage on ability checks";
}

export function getExhaustionAttackSaveSheetNote(
  data: CharacterData
): string | null {
  if (!getExhaustionModifiers(data).attackSaveDisadvantage) return null;
  return "Exhaustion: disadvantage on attack rolls and saving throws";
}

export function getExhaustionSpeedSheetNote(
  baseSpeedFt: number,
  data: CharacterData
): string | null {
  const mods = getExhaustionModifiers(data);
  if (mods.speedMultiplier === 0) return "Exhaustion: Max 0 ft";
  if (mods.speedMultiplier === 0.5) {
    const reduced = baseSpeedFt - Math.floor(baseSpeedFt / 2);
    return reduced > 0 ? `Exhaustion: -${reduced} speed` : null;
  }
  return null;
}

export function getExhaustionMaxHpSheetNote(
  baseMaxHp: number,
  data: CharacterData
): string | null {
  const mods = getExhaustionModifiers(data);
  if (mods.maxHpMultiplier === 0) {
    return baseMaxHp > 0 ? `Exhaustion: -${baseMaxHp}` : null;
  }
  if (mods.maxHpMultiplier === 0.5) {
    const removed = baseMaxHp - Math.floor(baseMaxHp / 2);
    return removed > 0 ? `Exhaustion: -${removed}` : null;
  }
  return null;
}

export function appendExhaustionSheetNote(
  tooltip: string | null | undefined,
  note: string | null
): string | null {
  if (!note) return tooltip ?? null;
  if (!tooltip) return note;
  return `${tooltip}\n${note}`;
}

export function applyExhaustionToSpeed(
  baseSpeedFt: number,
  data: CharacterData
): number {
  const { speedMultiplier } = getExhaustionModifiers(data);
  if (speedMultiplier === 0) return 0;
  if (speedMultiplier === 0.5) return Math.floor(baseSpeedFt / 2);
  return baseSpeedFt;
}

export function getExhaustionDeathMessage(data: CharacterData): string | null {
  const mods = getExhaustionModifiers(data);
  if (!mods.isDead || !mods.deathReason) return null;
  return (
    EXHAUSTION_DEATH_MESSAGES[mods.deathReason] ??
    `You have died from ${mods.deathReason.toLowerCase()}.`
  );
}

export function syncCombatExhaustion(data: CharacterData): CharacterData {
  const level = getExhaustionCount(data);
  return {
    ...data,
    combat: {
      ...data.combat,
      exhaustion: level,
    },
  };
}

export function addExhaustionLevels(
  data: CharacterData,
  count: number,
  reason: ExhaustionReason,
  gainedDate?: HarptosDate
): CharacterData {
  if (count <= 0) return data;

  const nextLevels = [...data.exhaustionLevels];
  for (let i = 0; i < count; i++) {
    if (nextLevels.length >= MAX_EXHAUSTION) break;
    const levelNumber = nextLevels.length + 1;
    nextLevels.push({
      id: crypto.randomUUID(),
      reason,
      effect: getExhaustionEffectText(levelNumber),
      gainedDate: gainedDate ?? null,
    });
  }

  return syncCombatExhaustion({
    ...data,
    exhaustionLevels: nextLevels,
  });
}

export function removeOneExhaustionLevel(data: CharacterData): CharacterData {
  if (data.exhaustionLevels.length === 0) return data;
  return syncCombatExhaustion({
    ...data,
    exhaustionLevels: data.exhaustionLevels.slice(0, -1),
  });
}

export function formatExhaustionLevelSummary(level: ExhaustionLevel): string {
  return `${level.reason}: ${level.effect}`;
}

export function formatExhaustionTooltipLines(
  levels: ExhaustionLevel[]
): string[] {
  if (levels.length === 0) {
    return ["No exhaustion levels"];
  }

  const lines: string[] = [];
  levels.forEach((level, index) => {
    if (index > 0) {
      lines.push("");
    }
    lines.push(`Level ${index + 1}: ${level.reason}`);
    lines.push(level.effect);
  });
  return lines;
}
