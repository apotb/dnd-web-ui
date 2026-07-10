import { syncCombatDerivedStats } from "@/lib/character/combat-derivation";
import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import { syncFeatureGrants } from "@/lib/character/feature-grant-sync";
import { resolveCharacterClass } from "@/lib/character/class-derivation";
import { getFeatAbilityBonusConfig } from "@/lib/dnd/feat-ability-bonuses";
import {
  computeLevelUpDieGain,
  computeLevelUpHpIncrease,
  getLevelUpSteps,
  validateLevelUpDraft,
  type LevelUpDraft,
} from "@/lib/dnd/level-up";
import { getFeat } from "@/lib/dnd/phb/feats";
import { getRangerPicksFromChoices } from "@/lib/dnd/phb/ranger-feature-slots";
import { getSpell } from "@/lib/dnd/phb/spells";
import { ABILITY_KEYS } from "@/lib/dnd/phb/point-buy";
import { syncSpellcastingFromClass } from "@/lib/dnd/spellcasting";
import { isManagedGrantSpell } from "@/lib/character/spell-sources";
import { getCharacterLevel } from "@/lib/dnd/xp";
import type {
  AbilityKey,
  AbilityScoreBreakdown,
  CharacterData,
  Spell,
} from "@/lib/schemas/character";

function spellFromSlug(slug: string): Spell {
  const phb = getSpell(slug);
  return {
    id: crypto.randomUUID(),
    spellId: slug,
    name: phb?.name ?? slug,
    level: phb?.level ?? 0,
    prepared: false,
    notes: "",
  };
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

function applyAsiDraft(
  data: CharacterData,
  draft: Extract<LevelUpDraft["asiOrFeat"], { mode: "asi" }>,
  targetLevel: number
): CharacterData {
  const label = `Level ${targetLevel} ASI`;
  if (draft.style === "double" && draft.doubleAbility) {
    return applyAbilityBonus(data, draft.doubleAbility, 2, label);
  }
  if (draft.splitAbilities) {
    let next = data;
    for (const ability of draft.splitAbilities) {
      next = applyAbilityBonus(next, ability, 1, label);
    }
    return next;
  }
  return data;
}

function applyFeatAbilityBonuses(
  data: CharacterData,
  featId: string,
  choiceIndex: number | undefined,
  targetLevel: number
): CharacterData {
  const config = getFeatAbilityBonusConfig(featId);
  if (!config) return data;

  const label = `Level ${targetLevel} Feat (${getFeat(featId)?.name ?? featId})`;

  if (config.mode === "fixed" && config.fixed) {
    let next = data;
    for (const key of ABILITY_KEYS) {
      const bonus = config.fixed[key];
      if (bonus) next = applyAbilityBonus(next, key, bonus, label);
    }
    return next;
  }

  if (config.mode === "choice" && config.choices && choiceIndex != null) {
    const choice = config.choices[choiceIndex];
    if (!choice) return data;
    let next = data;
    for (const key of ABILITY_KEYS) {
      const bonus = choice[key];
      if (bonus) next = applyAbilityBonus(next, key, bonus, label);
    }
    return next;
  }

  return data;
}

function applyFeatDraft(
  data: CharacterData,
  draft: Extract<LevelUpDraft["asiOrFeat"], { mode: "feat" }>,
  targetLevel: number
): CharacterData {
  let next: CharacterData = {
    ...data,
    levelUpFeats: {
      ...(data.levelUpFeats ?? {}),
      [String(targetLevel)]: draft.featId,
    },
  };

  next = applyFeatAbilityBonuses(
    next,
    draft.featId,
    draft.featAbilityChoiceIndex,
    targetLevel
  );

  if (draft.featId === "magic-initiate") {
    next = {
      ...next,
      featureChoices: {
        ...(next.featureChoices ?? {}),
        magicInitiateClass:
          (draft.magicInitiateClass as CharacterData["featureChoices"]["magicInitiateClass"]) ??
          "",
        magicInitiateCantripIds: draft.magicInitiateCantripIds ?? [],
        magicInitiateSpellId: draft.magicInitiateSpellId ?? "",
      },
    };
  }

  return next;
}

export function applyLevelUp(
  data: CharacterData,
  draft: LevelUpDraft,
  catalogs: FeatureCatalogs = {}
): CharacterData {
  const targetLevel = getCharacterLevel(data) + 1;
  const validationError = validateLevelUpDraft(data, catalogs, targetLevel, draft);
  if (validationError) {
    throw new Error(validationError);
  }

  const steps = getLevelUpSteps(data, catalogs, targetLevel, draft);
  let next: CharacterData = { ...data };
  let hpGainedThisLevel = 0;

  for (const step of steps) {
    if (step.kind === "hp" && draft.hp) {
      const dieGain =
        draft.hp.gain ||
        computeLevelUpDieGain(
          step.hitDie,
          draft.hp.method,
          draft.hp.rollResult
        );
      hpGainedThisLevel = computeLevelUpHpIncrease(
        step.hitDie,
        step.conMod,
        draft.hp.method,
        draft.hp.rollResult
      );
      const gains = [...(next.combat.levelUpHpGains ?? []), dieGain];
      next = {
        ...next,
        combat: {
          ...next.combat,
          levelUpHpGains: gains,
          hpGainsDieOnly: true,
        },
      };
    }

    if (step.kind === "subclass" && draft.subclassName) {
      next = {
        ...next,
        basicInfo: {
          ...next.basicInfo,
          subclass: draft.subclassName,
        },
      };
    }

    if (step.kind === "subclassChoices" && draft.featureChoices) {
      next = {
        ...next,
        featureChoices: {
          ...(next.featureChoices ?? {}),
          ...draft.featureChoices,
        },
      };
    }

    if (step.kind === "fightingStyle" && draft.fightingStyle) {
      next = {
        ...next,
        featureChoices: {
          ...(next.featureChoices ?? {}),
          fightingStyle: draft.fightingStyle,
        },
      };
    }

    if (step.kind === "rangerPicks" && draft.featureChoices) {
      const mergedChoices = {
        ...(next.featureChoices ?? {}),
        ...draft.featureChoices,
      };
      const { enemyPicks, terrains } = getRangerPicksFromChoices(
        mergedChoices,
        targetLevel
      );
      next = {
        ...next,
        featureChoices: {
          ...mergedChoices,
          favoredEnemyPicks: enemyPicks,
          favoredTerrains: terrains,
          favoredEnemy: enemyPicks[0]?.enemy ?? "",
          favoredHumanoidSpecies: enemyPicks[0]?.humanoidSpecies ?? [],
          favoredTerrain: terrains[0] ?? "",
        },
      };
    }

    if (step.kind === "cantrips" && draft.cantripIds?.length) {
      const newSpells = draft.cantripIds.map(spellFromSlug);
      next = {
        ...next,
        spells: {
          ...next.spells,
          known: [...next.spells.known, ...newSpells],
        },
      };
    }

    if (step.kind === "spellsKnown" && draft.spellIds?.length) {
      const newSpells = draft.spellIds.map(spellFromSlug);
      next = {
        ...next,
        spells: {
          ...next.spells,
          known: [...next.spells.known, ...newSpells],
        },
      };
    }

    if (
      step.kind === "swapKnownSpell" &&
      draft.spellSwap?.replaceSlug &&
      draft.spellSwap?.newSlug
    ) {
      const { replaceSlug, newSlug } = draft.spellSwap;
      const phb = getSpell(newSlug);
      next = {
        ...next,
        spells: {
          ...next.spells,
          known: next.spells.known.map((spell) =>
            spell.spellId === replaceSlug &&
            spell.level > 0 &&
            !isManagedGrantSpell(spell)
              ? {
                  ...spell,
                  spellId: newSlug,
                  name: phb?.name ?? newSlug,
                  level: phb?.level ?? spell.level,
                  prepared: true,
                  notes: phb?.school ?? spell.notes,
                }
              : spell
          ),
        },
      };
    }

    if (step.kind === "prepareSpells" && draft.preparedSpellIds?.length) {
      const existingSlugs = new Set(
        next.spells.known
          .filter((spell) => spell.level > 0 && spell.spellId)
          .map((spell) => spell.spellId as string)
      );
      const newSpells = draft.preparedSpellIds
        .filter((slug) => !existingSlugs.has(slug))
        .map((slug) => ({
          ...spellFromSlug(slug),
          prepared: true,
        }));
      next = {
        ...next,
        spells: {
          ...next.spells,
          known: [...next.spells.known, ...newSpells],
        },
      };
    }

    if (step.kind === "wizardSpellbook" && draft.wizardSpellIds?.length) {
      const newSpells = draft.wizardSpellIds.map(spellFromSlug);
      next = {
        ...next,
        spells: {
          ...next.spells,
          known: [...next.spells.known, ...newSpells],
        },
      };
    }

    if (step.kind === "asiOrFeat" && draft.asiOrFeat) {
      if (draft.asiOrFeat.mode === "asi") {
        next = applyAsiDraft(next, draft.asiOrFeat, targetLevel);
      } else {
        next = applyFeatDraft(next, draft.asiOrFeat, targetLevel);
      }
    }
  }

  next = {
    ...next,
    basicInfo: {
      ...next.basicInfo,
      level: targetLevel,
    },
  };

  const cls = resolveCharacterClass(next, catalogs.classes);
  if (cls?.spellcasting) {
    next = {
      ...next,
      spells: syncSpellcastingFromClass(next, cls, targetLevel),
    };
  }

  next = syncFeatureGrants(next, catalogs);
  next = syncCombatDerivedStats(next, catalogs.classes);

  if (hpGainedThisLevel > 0) {
    next = {
      ...next,
      combat: {
        ...next.combat,
        currentHp: Math.min(
          next.combat.maxHp,
          next.combat.currentHp + hpGainedThisLevel
        ),
      },
    };
  }

  return next;
}
