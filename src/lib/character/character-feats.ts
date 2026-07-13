import { clearMagicInitiateChoices } from "@/lib/character/feature-grant-sync";
import { getFeatAbilityBonusConfig } from "@/lib/dnd/feat-ability-bonuses";
import { getFeat } from "@/lib/dnd/phb/feats";
import { ABILITY_KEYS } from "@/lib/dnd/phb/point-buy";
import type {
  AbilityKey,
  AbilityScoreBreakdown,
  CharacterData,
} from "@/lib/schemas/character";

export type SheetFeatSource = "species" | "level" | "dm";

export interface SheetFeatEntry {
  key: string;
  featId: string;
  source: SheetFeatSource;
  level?: number;
}

function applyAbilityBonus(
  data: CharacterData,
  ability: AbilityKey,
  amount: number,
  sourceLabel: string
): CharacterData {
  const currentScore = data.abilityScores[ability];
  const nextScore = Math.min(20, currentScore + amount);
  const actualGain = nextScore - currentScore;
  if (actualGain <= 0) return data;

  const existingBreakdown = data.abilityScoreBreakdown?.[ability];
  const base = existingBreakdown?.base ?? currentScore;
  const racial = existingBreakdown?.racial ?? 0;
  const other = (existingBreakdown?.other ?? 0) + actualGain;
  const sources = [
    ...(existingBreakdown?.sources ?? [{ label: "Base", value: base }]),
    { label: sourceLabel, value: actualGain },
  ];

  const breakdown = {
    ...(data.abilityScoreBreakdown ?? {}),
    [ability]: { base, racial, other, sources },
  } as AbilityScoreBreakdown;

  return {
    ...data,
    abilityScores: {
      ...data.abilityScores,
      [ability]: nextScore,
    },
    abilityScoreBreakdown: breakdown,
  };
}

function reverseAbilityBonusByLabel(
  data: CharacterData,
  sourceLabel: string
): CharacterData {
  let next = data;
  for (const ability of ABILITY_KEYS) {
    const breakdown = next.abilityScoreBreakdown?.[ability];
    if (!breakdown) continue;
    const source = breakdown.sources?.find((s) => s.label === sourceLabel);
    if (!source || source.value <= 0) continue;

    const amount = source.value;
    const currentScore = next.abilityScores[ability];
    const nextScore = currentScore - amount;
    const remainingSources = (breakdown.sources ?? []).filter(
      (s) => s.label !== sourceLabel
    );
    const other = Math.max(0, (breakdown.other ?? 0) - amount);

    const nextBreakdown = {
      ...(next.abilityScoreBreakdown ?? {}),
      [ability]: {
        ...breakdown,
        other,
        sources: remainingSources,
      },
    } as AbilityScoreBreakdown;

    next = {
      ...next,
      abilityScores: {
        ...next.abilityScores,
        [ability]: nextScore,
      },
      abilityScoreBreakdown: nextBreakdown,
    };
  }
  return next;
}

function applyFeatAbilityBonuses(
  data: CharacterData,
  featId: string,
  sourceLabel: string,
  choiceIndex?: number
): CharacterData {
  const config = getFeatAbilityBonusConfig(featId);
  if (!config) return data;

  if (config.mode === "fixed" && config.fixed) {
    let next = data;
    for (const key of ABILITY_KEYS) {
      const bonus = config.fixed[key];
      if (bonus) next = applyAbilityBonus(next, key, bonus, sourceLabel);
    }
    return next;
  }

  if (config.mode === "choice" && config.choices) {
    const index = choiceIndex ?? 0;
    const choice = config.choices[index];
    if (!choice) return data;
    let next = data;
    for (const key of ABILITY_KEYS) {
      const bonus = choice[key];
      if (bonus) next = applyAbilityBonus(next, key, bonus, sourceLabel);
    }
    return next;
  }

  return data;
}

function featAbilitySourceLabel(
  entry: SheetFeatEntry,
  featId: string
): string {
  const featName = getFeat(featId)?.name ?? featId;
  if (entry.source === "level" && entry.level != null) {
    return `Level ${entry.level} Feat (${featName})`;
  }
  if (entry.source === "dm") {
    return `DM Grant (${featName})`;
  }
  return `Species Feat (${featName})`;
}

export function getCharacterSheetFeats(data: CharacterData): SheetFeatEntry[] {
  const entries: SheetFeatEntry[] = [];

  const variant = data.featureChoices?.variantHumanFeat;
  if (variant) {
    entries.push({
      key: "species",
      featId: variant,
      source: "species",
    });
  }

  const levelEntries = Object.entries(data.levelUpFeats ?? {})
    .filter(([, featId]) => featId)
    .map(([level, featId]) => ({
      level: Number(level),
      featId,
    }))
    .filter((e) => Number.isFinite(e.level))
    .sort((a, b) => a.level - b.level);

  for (const { level, featId } of levelEntries) {
    entries.push({
      key: `level:${level}`,
      featId,
      source: "level",
      level,
    });
  }

  (data.dmGrantedFeats ?? []).forEach((featId, index) => {
    if (!featId) return;
    entries.push({
      key: `dm:${index}`,
      featId,
      source: "dm",
    });
  });

  return entries;
}

export function getAllCharacterFeatIds(data: CharacterData): string[] {
  const ids = getCharacterSheetFeats(data).map((e) => e.featId);
  return [...new Set(ids)];
}

export function hasMagicInitiateFeat(data: CharacterData): boolean {
  return getAllCharacterFeatIds(data).includes("magic-initiate");
}

export function hasAthleteFeat(data: CharacterData): boolean {
  return getAllCharacterFeatIds(data).includes("athlete");
}

export function sheetFeatSourceLabel(entry: SheetFeatEntry): string {
  switch (entry.source) {
    case "species":
      return "Species";
    case "level":
      return entry.level != null ? `Level ${entry.level}` : "Level-up";
    case "dm":
      return "DM Grant";
  }
}

export function findSheetFeatEntry(
  data: CharacterData,
  key: string
): SheetFeatEntry | undefined {
  return getCharacterSheetFeats(data).find((e) => e.key === key);
}

function maybeClearMagicInitiate(data: CharacterData): CharacterData {
  if (hasMagicInitiateFeat(data)) return data;
  return {
    ...data,
    featureChoices: clearMagicInitiateChoices(data.featureChoices ?? {}, data),
  };
}

export function addDmGrantedFeat(
  data: CharacterData,
  featId: string,
  choiceIndex?: number
): CharacterData {
  if (!featId) return data;
  const featName = getFeat(featId)?.name ?? featId;
  const sourceLabel = `DM Grant (${featName})`;

  let next: CharacterData = {
    ...data,
    dmGrantedFeats: [...(data.dmGrantedFeats ?? []), featId],
  };
  next = applyFeatAbilityBonuses(next, featId, sourceLabel, choiceIndex);
  return next;
}

export function removeCharacterFeat(
  data: CharacterData,
  key: string
): CharacterData {
  const entry = findSheetFeatEntry(data, key);
  if (!entry) return data;

  const sourceLabel = featAbilitySourceLabel(entry, entry.featId);
  let next = reverseAbilityBonusByLabel(data, sourceLabel);

  if (entry.source === "species") {
    next = {
      ...next,
      featureChoices: clearMagicInitiateChoices(
        {
          ...(next.featureChoices ?? {}),
          variantHumanFeat: "",
        },
        next
      ),
    };
  } else if (entry.source === "level" && entry.level != null) {
    const levelUpFeats = { ...(next.levelUpFeats ?? {}) };
    delete levelUpFeats[String(entry.level)];
    next = { ...next, levelUpFeats };
  } else if (entry.source === "dm") {
    const index = Number(key.replace(/^dm:/, ""));
    if (Number.isFinite(index)) {
      const dmGrantedFeats = [...(next.dmGrantedFeats ?? [])];
      dmGrantedFeats.splice(index, 1);
      next = { ...next, dmGrantedFeats };
    }
  }

  return maybeClearMagicInitiate(next);
}

export function changeCharacterFeat(
  data: CharacterData,
  key: string,
  newFeatId: string,
  choiceIndex?: number
): CharacterData {
  if (!newFeatId) {
    return removeCharacterFeat(data, key);
  }

  const entry = findSheetFeatEntry(data, key);
  if (!entry) return data;
  if (entry.featId === newFeatId) return data;

  const oldLabel = featAbilitySourceLabel(entry, entry.featId);
  let next = reverseAbilityBonusByLabel(data, oldLabel);

  if (entry.source === "species") {
    let featureChoices = {
      ...(next.featureChoices ?? {}),
      variantHumanFeat: newFeatId,
    };
    if (entry.featId === "magic-initiate" && newFeatId !== "magic-initiate") {
      featureChoices = clearMagicInitiateChoices(featureChoices);
    }
    next = { ...next, featureChoices };
  } else if (entry.source === "level" && entry.level != null) {
    next = {
      ...next,
      levelUpFeats: {
        ...(next.levelUpFeats ?? {}),
        [String(entry.level)]: newFeatId,
      },
    };
    if (entry.featId === "magic-initiate" && newFeatId !== "magic-initiate") {
    next = {
      ...next,
      featureChoices: clearMagicInitiateChoices(next.featureChoices ?? {}, next),
    };
    }
  } else if (entry.source === "dm") {
    const index = Number(key.replace(/^dm:/, ""));
    if (Number.isFinite(index)) {
      const dmGrantedFeats = [...(next.dmGrantedFeats ?? [])];
      dmGrantedFeats[index] = newFeatId;
      next = { ...next, dmGrantedFeats };
    }
    if (entry.featId === "magic-initiate" && newFeatId !== "magic-initiate") {
    next = {
      ...next,
      featureChoices: clearMagicInitiateChoices(next.featureChoices ?? {}, next),
    };
    }
  }

  const newLabel = featAbilitySourceLabel({ ...entry, featId: newFeatId }, newFeatId);
  next = applyFeatAbilityBonuses(next, newFeatId, newLabel, choiceIndex);
  return maybeClearMagicInitiate(next);
}
