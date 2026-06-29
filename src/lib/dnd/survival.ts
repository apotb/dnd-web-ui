import { abilityModifier, formatModifier } from "@/lib/dnd/calculations";
import {
  addExhaustionLevels,
  getExhaustionCount,
} from "@/lib/dnd/exhaustion";
import { sameHarptosDate, type HarptosDate } from "@/lib/dnd/harptos-calendar";
import { isFedForDate } from "@/lib/dnd/supplies";
import type { CharacterData } from "@/lib/schemas/character";
import type { WorldData } from "@/lib/schemas/world";

export const DEFAULT_DAILY_WATER_GALLONS = 1;
export const DEHYDRATION_SAVE_DC = 15;
export const WATERSKIN_GALLONS = 0.5;

export function getMaxDaysWithoutFood(conMod: number): number {
  return 3 + conMod;
}

export function getRequiredWaterGallons(_worldData?: WorldData): number {
  // Hot weather (2 gal) can be wired in later via worldData.
  return DEFAULT_DAILY_WATER_GALLONS;
}

export function getConModifier(data: CharacterData): number {
  return abilityModifier(data.abilityScores.con);
}

export function getDehydrationSaveFailureLevelsForExhaustion(
  exhaustionBeforeCheck: number
): number {
  return exhaustionBeforeCheck >= 1 ? 2 : 1;
}

function applyEndOfDayFoodSurvival(
  data: CharacterData,
  endingDate: HarptosDate,
  worldData: WorldData
): CharacterData {
  if (!worldData.dailySuppliesActive) return data;

  let next = { ...data };

  if (!isFedForDate(next, endingDate)) {
    next = {
      ...next,
      supplies: {
        ...next.supplies,
        daysWithoutFood: next.supplies.daysWithoutFood + 1,
      },
    };

    const conMod = getConModifier(next);
    const maxDays = getMaxDaysWithoutFood(conMod);
    if (next.supplies.daysWithoutFood > maxDays) {
      next = addExhaustionLevels(next, 1, "Starvation", endingDate);
    }
  }

  return next;
}

export function previewExhaustionBeforeDehydration(
  data: CharacterData,
  endingDate: HarptosDate,
  worldData: WorldData
): number {
  const afterFood = applyEndOfDayFoodSurvival(data, endingDate, worldData);
  return getExhaustionCount(afterFood);
}

export function needsDehydrationSaveForWaterGallons(
  gallonsDrunk: number,
  worldData: WorldData
): boolean {
  const requiredGallons = getRequiredWaterGallons(worldData);
  const halfRequired = requiredGallons / 2;
  return gallonsDrunk >= halfRequired && gallonsDrunk < requiredGallons;
}

export interface ProcessEndOfDaySurvivalOptions {
  /** When set, resolves half-water dehydration immediately instead of leaving pending. */
  dehydrationSaveRollTotal?: number;
}

export function processEndOfDaySurvival(
  data: CharacterData,
  endingDate: HarptosDate,
  worldData: WorldData,
  options?: ProcessEndOfDaySurvivalOptions
): CharacterData {
  if (!worldData.dailySuppliesActive) return data;

  let next = applyEndOfDayFoodSurvival(data, endingDate, worldData);

  const requiredGallons = getRequiredWaterGallons(worldData);
  const halfRequired = requiredGallons / 2;
  const gallonsDrunk = next.supplies.waterGallonsToday;
  const exhaustionBeforeDehydration = getExhaustionCount(next);

  if (gallonsDrunk >= requiredGallons) {
    // Fully hydrated — no dehydration check.
  } else if (gallonsDrunk >= halfRequired) {
    if (options?.dehydrationSaveRollTotal !== undefined) {
      next = {
        ...next,
        supplies: {
          ...next.supplies,
          pendingDehydrationSave: {
            date: endingDate,
            dc: DEHYDRATION_SAVE_DC,
            exhaustionBeforeCheck: exhaustionBeforeDehydration,
          },
        },
      };
      next = resolveDehydrationSave(next, options.dehydrationSaveRollTotal);
    } else {
      next = {
        ...next,
        supplies: {
          ...next.supplies,
          pendingDehydrationSave: {
            date: endingDate,
            dc: DEHYDRATION_SAVE_DC,
            exhaustionBeforeCheck: exhaustionBeforeDehydration,
          },
        },
      };
    }
  } else {
    const levelsToAdd = exhaustionBeforeDehydration >= 1 ? 2 : 1;
    next = addExhaustionLevels(next, levelsToAdd, "Dehydration", endingDate);
  }

  next = {
    ...next,
    supplies: {
      ...next.supplies,
      waterGallonsToday: 0,
      wateredDate: null,
    },
  };

  return next;
}

export function getDehydrationSaveFailureExhaustionLevels(
  data: CharacterData
): number {
  const pending = data.supplies.pendingDehydrationSave;
  if (!pending) return 0;
  return getDehydrationSaveFailureLevelsForExhaustion(
    pending.exhaustionBeforeCheck
  );
}

export function resolveDehydrationSave(
  data: CharacterData,
  rollTotal: number
): CharacterData {
  const pending = data.supplies.pendingDehydrationSave;
  if (!pending) return data;

  const passed = rollTotal >= pending.dc;
  let next: CharacterData = {
    ...data,
    supplies: {
      ...data.supplies,
      pendingDehydrationSave: null,
    },
  };

  if (!passed) {
    const levelsToAdd = getDehydrationSaveFailureExhaustionLevels(data);
    next = addExhaustionLevels(
      next,
      levelsToAdd,
      "Dehydration",
      pending.date ?? undefined
    );
  }

  return next;
}

export function getStarvationTooltipLines(data: CharacterData): string[] {
  const conMod = getConModifier(data);
  const maxDays = getMaxDaysWithoutFood(conMod);
  const daysWithout = data.supplies.daysWithoutFood;

  const lines = [
    `Max days without food: ${maxDays} (CON: ${formatModifier(conMod)})`,
  ];
  if (daysWithout > 0) {
    lines.push(`Days without food: ${daysWithout}`);
  } else {
    lines.push("Days without food: 0");
  }
  return lines;
}

export function getFoodNotificationInfo(data: CharacterData) {
  const conMod = getConModifier(data);
  const maxDaysWithoutFood = getMaxDaysWithoutFood(conMod);
  const daysWithoutFood = data.supplies.daysWithoutFood;
  const starvationRisk = daysWithoutFood >= maxDaysWithoutFood;

  return {
    daysWithoutFood,
    maxDaysWithoutFood,
    starvationRisk,
  };
}

export function formatGallons(gallons: number): string {
  const rounded = Math.round(gallons * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function getWaterNotificationInfo(
  data: CharacterData,
  worldData: WorldData
) {
  const requiredGallons = getRequiredWaterGallons(worldData);
  const consumedGallons = data.supplies.waterGallonsToday;
  const halfRequired = requiredGallons / 2;

  return {
    consumedGallons,
    requiredGallons,
    halfRequired,
    needsHalfMessage: consumedGallons < requiredGallons,
    dehydrationRisk: consumedGallons < halfRequired,
  };
}

export function isPendingDehydrationSaveForDate(
  data: CharacterData,
  date: HarptosDate
): boolean {
  const pending = data.supplies.pendingDehydrationSave;
  if (!pending?.date) return !!pending;
  return sameHarptosDate(pending.date, date);
}
