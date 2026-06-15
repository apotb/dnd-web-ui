"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CharacterData, AbilityKey, SkillKey, ActionCost } from "@/lib/schemas/character";
import { choicePlaceholder, type FeatureChoiceKey } from "@/lib/character/feature-choices";
import {
  ABILITY_FULL_LABELS,
  ABILITY_LABELS,
  SKILL_ABILITY_MAP,
  SKILL_LABELS,
  abilityModifier,
  formatModifier,
  getAbilityModifiers,
  getPassivePerception,
  getProficiencyBonus,
  getSavingThrowTotal,
  getSkillTotal,
  getSpellAttackBonus,
  getSpellSaveDc,
} from "@/lib/dnd/calculations";
import { levelFromXp, xpProgress } from "@/lib/dnd/xp";
import {
  getMaxCastableSpellLevel,
  groupKnownSpellsByLevel,
} from "@/lib/dnd/spell-display";
import {
  canAddCantrip,
  canAddLeveledSpell,
  canPrepareAnother,
  countCantrips,
  countLeveledKnown,
  countPreparedLeveled,
  formatSlotSummary,
  formatLevelPreparedSummary,
  getSpellSlotAtLevel,
  getSpellcastingLimits,
  isKnownCaster,
  isPreparedCaster,
  isWizard,
  normalizeSpellPreparedFlags,
  syncSpellcastingFromClass,
} from "@/lib/dnd/spellcasting";
import type { Item } from "@/lib/schemas/item";
import { categoryLabel, formatItemTooltip, getWeaponProperties, RARITY_COLOR, rarityLabel } from "@/lib/schemas/item";
import { ItemPicker } from "@/components/items/item-picker";
import { SpellPicker } from "@/components/spells/spell-picker";
import { SpellGlossaryMeta } from "@/components/spells/spell-glossary-meta";
import { HumanoidSpeciesPicker } from "@/components/character-creator/humanoid-species-picker";
import { TWO_HUMANOID_SPECIES_OPTION } from "@/lib/dnd/phb/favored-enemy-humanoids";
import { getItemsBySlugsClient } from "@/lib/items/catalog-client";
import {
  getSpellsBySlugsClient,
  fetchCatalogBackgroundsClient,
  fetchCatalogClassesClient,
  fetchCatalogSpeciesClient,
  type CatalogSpellRow,
} from "@/lib/content/catalog-client";
import {
  findBackgroundByName,
  findClassByName,
  findSpeciesByDisplayName,
  findSubclassByName,
  formatBackgroundTooltip,
  formatClassTooltip,
  formatSpeciesTooltip,
  formatSubclassTooltip,
  speciesSubtitleLabel,
} from "@/lib/content/catalog-tooltip";
import { getAllAttacks, type DerivedAttack } from "@/lib/dnd/attacks";
import {
  ACTION_COST_LABELS,
  ACTION_COST_ORDER,
  actionSourceBadgeLabel,
  getAllCharacterActions,
  groupActionsByCost,
} from "@/lib/dnd/character-actions";
import {
  deriveGrantedFeatures,
  featureSourceLabel,
  isConfigurableGrantedFeature,
  isGrantConfigurableFeature,
  type ConfigurableGrantedFeature,
  type GrantedFeature,
} from "@/lib/character/feature-derivation";
import {
  clearMagicInitiateChoices,
  syncFeatureGrants,
} from "@/lib/character/feature-grant-sync";
import { optionLabel } from "@/lib/ui/select-display";
import { GrantFeatureRow } from "@/components/character/grant-feature-row";
import {
  isClassSavingThrowProficient,
  resolveCharacterClass,
} from "@/lib/character/class-derivation";
import {
  formatProficiencySources,
  getArmorProficienciesWithSources,
  getToolProficienciesWithSources,
  getWeaponProficienciesWithSources,
  type ProficiencyEntry,
} from "@/lib/character/proficiency-sources";
import {
  formatSkillProficiencyTooltip,
  getGrantedSkillSet,
  getSkillSourcesMap,
  isGrantedSkill,
  isSkillProficient,
} from "@/lib/character/skill-sources";
import { getLanguagesWithSources } from "@/lib/character/language-sources";
import {
  calculateAcBreakdown,
  formatAcTooltip,
} from "@/lib/character/ac-derivation";
import { isEquippableItem, setItemEquipped, setWeaponWield, getItemEquipSlot, getEffectiveWieldMain, getEffectiveWieldOff, canWieldOffHand, isLightWeapon } from "@/lib/character/equip-rules";
import type { PhbBackground, PhbClass, PhbSpecies } from "@/lib/dnd/phb/types";

interface CharacterSheetProps {
  data: CharacterData;
  isDm: boolean;
  editable?: boolean;
  /** Equip/attune inventory items without full sheet edit mode. */
  canToggleEquipment?: boolean;
  onChange?: (data: CharacterData) => void;
  editHref?: string;
  /** Class catalog for deriving saving throws and other class-granted rules. */
  classes?: PhbClass[];
}

function GrantedFeatureRow({ feature }: { feature: GrantedFeature }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{feature.name}</p>
        <Badge variant="outline" className="text-xs shrink-0">
          {featureSourceLabel(feature.source)}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {feature.description}
      </p>
      {feature.uses && (
        <p className="text-xs">
          Uses: {feature.uses.current}/{feature.uses.max} ({feature.restReset}{" "}
          rest)
        </p>
      )}
    </div>
  );
}

function ConfigurableFeatureRow({
  feature,
  editable,
  onChoiceChange,
  favoredHumanoidSpecies,
  onFavoredHumanoidSpeciesChange,
}: {
  feature: ConfigurableGrantedFeature;
  editable?: boolean;
  onChoiceChange?: (key: FeatureChoiceKey, value: string) => void;
  favoredHumanoidSpecies?: string[];
  onFavoredHumanoidSpeciesChange?: (ids: string[]) => void;
}) {
  return (
    <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{feature.name}</p>
        <Badge variant="outline" className="text-xs shrink-0">
          {featureSourceLabel(feature.source)}
        </Badge>
      </div>
      {editable && onChoiceChange ? (
        <div className="space-y-2">
          <Select
            value={feature.choiceValue || undefined}
            onValueChange={(value) => onChoiceChange(feature.choiceKey, value ?? "")}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={choicePlaceholder(feature.choiceKey)}>
                {optionLabel(feature.choiceOptions, feature.choiceValue)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {feature.choiceOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {feature.choiceKey === "favoredEnemy" &&
          feature.choiceValue === TWO_HUMANOID_SPECIES_OPTION &&
          onFavoredHumanoidSpeciesChange ? (
            <HumanoidSpeciesPicker
              selected={favoredHumanoidSpecies ?? []}
              onChange={onFavoredHumanoidSpeciesChange}
              variant="sheet"
            />
          ) : null}
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {feature.description}
      </p>
    </div>
  );
}

function ProficiencyOverviewList({
  label,
  entries,
}: {
  label: string;
  entries: ProficiencyEntry[];
}) {
  if (!entries.length) return null;
  return (
    <p className="text-sm text-muted-foreground">
      {label}:{" "}
      {entries.map((entry, index) => (
        <span key={entry.name}>
          {index > 0 ? ", " : null}
          {entry.sources.length > 0 ? (
            <Tooltip content={formatProficiencySources(entry.sources)}>
              <span className="cursor-default decoration-dotted underline underline-offset-2">
                {entry.name}
              </span>
            </Tooltip>
          ) : (
            entry.name
          )}
        </span>
      ))}
    </p>
  );
}

function Field({
  label,
  value,
  editable,
  onChange,
  type = "text",
  tooltip,
}: {
  label: string;
  value: string | number;
  editable?: boolean;
  onChange?: (v: string) => void;
  type?: "text" | "number";
  tooltip?: string | null;
}) {
  const display =
    editable && onChange ? (
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    ) : (
      <p className="text-sm font-medium">{value || "—"}</p>
    );

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {tooltip && !editable ? (
        <Tooltip content={tooltip}>
          <div className="cursor-default">{display}</div>
        </Tooltip>
      ) : (
        display
      )}
    </div>
  );
}

export function CharacterSheet({
  data,
  isDm,
  editable = false,
  canToggleEquipment = false,
  onChange,
  editHref,
  classes,
}: CharacterSheetProps) {
  const canMutate = editable || canToggleEquipment;

  const update = (patch: Partial<CharacterData>) => {
    if (!canMutate || !onChange) return;
    onChange({ ...data, ...patch });
  };

  const updateBasic = (patch: Partial<CharacterData["basicInfo"]>) => {
    update({ basicInfo: { ...data.basicInfo, ...patch } });
  };

  const updateCustomAbilityMod = (key: AbilityKey, newCustomMod: number) => {
    const safeMod = Number.isFinite(newCustomMod) ? Math.trunc(newCustomMod) : 0;
    const oldRaw = data.customAbilityMods?.[key];
    const oldCustomMod = Number.isFinite(oldRaw) ? oldRaw! : 0;
    const baseScore = data.abilityScores[key] - oldCustomMod;
    const newScore = baseScore + safeMod;

    const oldBreakdown = data.abilityScoreBreakdown?.[key];
    const filteredSources = (oldBreakdown?.sources ?? []).filter(
      (s) => s.label !== "Custom"
    );
    const newSources =
      safeMod !== 0
        ? [...filteredSources, { label: "Custom", value: safeMod }]
        : filteredSources;

    const newBreakdown = oldBreakdown
      ? { ...oldBreakdown, sources: newSources }
      : { base: baseScore, racial: 0, other: 0, sources: newSources };

    const nextMods = { ...data.customAbilityMods } as Partial<
      Record<AbilityKey, number>
    >;
    if (safeMod === 0) {
      delete nextMods[key];
    } else {
      nextMods[key] = safeMod;
    }

    update({
      abilityScores: { ...data.abilityScores, [key]: newScore },
      customAbilityMods:
        Object.keys(nextMods).length > 0
          ? (nextMods as Record<AbilityKey, number>)
          : undefined,
      abilityScoreBreakdown: {
        ...(data.abilityScoreBreakdown as Record<AbilityKey, typeof newBreakdown> | undefined),
        [key]: newBreakdown,
      } as CharacterData["abilityScoreBreakdown"],
    });
  };

  const updateCombat = (patch: Partial<CharacterData["combat"]>) => {
    update({ combat: { ...data.combat, ...patch } });
  };

  const [xpDelta, setXpDelta] = useState<string>("");
  const [catalogItems, setCatalogItems] = useState<Record<string, Item>>({});
  const [catalogSpells, setCatalogSpells] = useState<Record<string, CatalogSpellRow>>({});
  const [catalogSpecies, setCatalogSpecies] = useState<PhbSpecies[]>([]);
  const [catalogBackgrounds, setCatalogBackgrounds] = useState<PhbBackground[]>([]);
  const [loadedClasses, setLoadedClasses] = useState<PhbClass[]>([]);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [spellPickerOpen, setSpellPickerOpen] = useState(false);
  const swapItemIndexRef = useRef<number | null>(null);
  const swapSpellIndexRef = useRef<number | null>(null);

  const classCatalog = classes?.length ? classes : loadedClasses;

  const mods = getAbilityModifiers(data.abilityScores);
  const profBonus = getProficiencyBonus(data);
  const resolvedClass = resolveCharacterClass(data, classCatalog);
  const level = levelFromXp(data.basicInfo.xp ?? 0);
  const xp = data.basicInfo.xp ?? 0;
  const xpBar = xpProgress(xp);

  const classDisplay =
    data.basicInfo.classes.length > 0
      ? data.basicInfo.classes.join(" / ")
      : data.basicInfo.class ?? "";

  const primaryClassName =
    data.basicInfo.classes[0] ?? data.basicInfo.class ?? resolvedClass?.name ?? "";

  const speciesTooltip = useMemo(() => {
    const match = findSpeciesByDisplayName(data.basicInfo.species, catalogSpecies);
    return match
      ? formatSpeciesTooltip(match.species, match.subspecies, data.speciesLanguageChoices)
      : null;
  }, [data.basicInfo.species, data.speciesLanguageChoices, catalogSpecies]);

  const backgroundTooltip = useMemo(() => {
    const bg = findBackgroundByName(data.basicInfo.background, catalogBackgrounds);
    return bg
      ? formatBackgroundTooltip(bg, data.backgroundLanguageChoices)
      : null;
  }, [data.basicInfo.background, data.backgroundLanguageChoices, catalogBackgrounds]);

  const classTooltip = useMemo(() => {
    const cls = findClassByName(primaryClassName, classCatalog);
    return cls ? formatClassTooltip(cls) : null;
  }, [primaryClassName, classCatalog]);

  const subclassTooltip = useMemo(() => {
    const match = findSubclassByName(
      primaryClassName,
      data.basicInfo.subclass,
      classCatalog
    );
    return match ? formatSubclassTooltip(match.subclass) : null;
  }, [primaryClassName, data.basicInfo.subclass, classCatalog]);

  const speciesClassDisplay = useMemo(() => {
    const species = speciesSubtitleLabel(data.basicInfo.species, catalogSpecies);
    const cls = classDisplay.trim();
    if (species && cls) return `${species} ${cls}`;
    return species || cls;
  }, [data.basicInfo.species, classDisplay, catalogSpecies]);

  const speciesClassTooltip = useMemo(() => {
    const parts = [speciesTooltip, classTooltip].filter(Boolean);
    return parts.length > 0 ? parts.join("\n\n") : null;
  }, [speciesTooltip, classTooltip]);

  useEffect(() => {
    fetchCatalogSpeciesClient().then(setCatalogSpecies);
    fetchCatalogBackgroundsClient().then(setCatalogBackgrounds);
    if (!classes?.length) {
      fetchCatalogClassesClient().then(setLoadedClasses);
    }
  }, [classes]);

  useEffect(() => {
    const slugs = data.inventory.items
      .filter((i) => i.itemId)
      .map((i) => i.itemId!);
    if (!slugs.length) { setCatalogItems({}); return; }
    getItemsBySlugsClient(slugs).then(setCatalogItems);
  }, [data.inventory.items]);

  useEffect(() => {
    const slugs = data.spells.known
      .filter((s) => s.spellId)
      .map((s) => s.spellId!);
    if (!slugs.length) {
      setCatalogSpells({});
      return;
    }
    getSpellsBySlugsClient(slugs).then(setCatalogSpells);
  }, [data.spells.known]);

  const classSpellListId = resolvedClass?.spellcasting?.spellListId;
  const spellLimits = useMemo(
    () =>
      resolvedClass?.spellcasting
        ? getSpellcastingLimits(resolvedClass, level, data.abilityScores)
        : null,
    [resolvedClass, level, data.abilityScores]
  );
  const slotSummary = useMemo(
    () => formatSlotSummary(data.spells.slots),
    [data.spells.slots]
  );
  const cantripCount = useMemo(
    () => countCantrips(data.spells.known),
    [data.spells.known]
  );
  const leveledKnownCount = useMemo(
    () => countLeveledKnown(data.spells.known),
    [data.spells.known]
  );
  const preparedLeveledCount = useMemo(
    () => countPreparedLeveled(data.spells.known),
    [data.spells.known]
  );
  const canManageSpellPrep = useMemo(() => {
    if (!canMutate || !resolvedClass?.spellcasting) return false;
    return isPreparedCaster(resolvedClass) && !isKnownCaster(resolvedClass);
  }, [canMutate, resolvedClass]);

  const updateBasicWithSync = (patch: Partial<CharacterData["basicInfo"]>) => {
    const nextBasic = { ...data.basicInfo, ...patch };
    const nextPatch: Partial<CharacterData> = { basicInfo: nextBasic };
    if (patch.xp !== undefined && resolvedClass?.spellcasting) {
      nextPatch.spells = syncSpellcastingFromClass(
        { ...data, basicInfo: nextBasic },
        resolvedClass,
        levelFromXp(nextBasic.xp ?? 0)
      );
    }
    update(nextPatch);
  };

  const updateSpells = (spells: CharacterData["spells"]) => {
    let next = spells;
    if (resolvedClass?.spellcasting) {
      next = syncSpellcastingFromClass({ ...data, spells }, resolvedClass, level);
    }
    update({ spells: next });
  };

  const adjustSlotUsed = (spellLevel: number, delta: number) => {
    const key = String(spellLevel);
    const slot = data.spells.slots[key];
    if (!slot) return;
    const used = Math.max(0, Math.min(slot.max, slot.used + delta));
    if (used === slot.used) return;
    updateSpells({
      ...data.spells,
      slots: {
        ...data.spells.slots,
        [key]: { ...slot, used },
      },
    });
  };
  const knownSpellSlugs = data.spells.known
    .map((s) => s.spellId)
    .filter((s): s is string => !!s);

  const maxCastableSpellLevel = useMemo(
    () => getMaxCastableSpellLevel(level, data.spells.slots),
    [level, data.spells.slots]
  );

  const knownSpellGroups = useMemo(
    () =>
      groupKnownSpellsByLevel(data.spells.known, (spell) => {
        if (spell.spellId && catalogSpells[spell.spellId]) {
          return catalogSpells[spell.spellId].level;
        }
        return spell.level;
      }),
    [data.spells.known, catalogSpells]
  );

  function spellFromCatalog(catalogSpell: CatalogSpellRow) {
    const isCantrip = catalogSpell.level === 0;
    const knownCaster = resolvedClass ? isKnownCaster(resolvedClass) : false;
    return {
      id: crypto.randomUUID(),
      spellId: catalogSpell.slug,
      name: catalogSpell.name,
      level: catalogSpell.level,
      prepared: isCantrip || knownCaster,
      notes: catalogSpell.school,
    };
  }

  function applySpellPickerSelection(catalogSpell: CatalogSpellRow) {
    const swapIndex = swapSpellIndexRef.current;
    swapSpellIndexRef.current = null;
    const entry = spellFromCatalog(catalogSpell);

    if (swapIndex === null && spellLimits) {
      if (catalogSpell.level === 0 && !canAddCantrip(data.spells.known, spellLimits.cantripsKnown)) {
        return;
      }
      if (
        catalogSpell.level > 0 &&
        !canAddLeveledSpell(data.spells.known, spellLimits)
      ) {
        return;
      }
    }

    if (swapIndex !== null) {
      const known = [...data.spells.known];
      const old = known[swapIndex];
      const keepPrepared =
        entry.level === 0 || (resolvedClass && isKnownCaster(resolvedClass))
          ? true
          : old.prepared;
      known[swapIndex] = { ...entry, id: old.id, prepared: keepPrepared };
      updateSpells({
        ...data.spells,
        known: resolvedClass
          ? normalizeSpellPreparedFlags(known, resolvedClass)
          : known,
      });
      return;
    }

    updateSpells({
      ...data.spells,
      known: [...data.spells.known, entry],
    });
  }

  const featureCatalogs = useMemo(
    () => ({
      species: catalogSpecies,
      classes: classCatalog,
      backgrounds: catalogBackgrounds,
    }),
    [catalogSpecies, classCatalog, catalogBackgrounds]
  );
  const grantedFeatures = useMemo(
    () => deriveGrantedFeatures(data, featureCatalogs),
    [data, featureCatalogs]
  );
  const weaponProficiencyEntries = useMemo(
    () => getWeaponProficienciesWithSources(data, featureCatalogs),
    [data, featureCatalogs]
  );
  const armorProficiencyEntries = useMemo(
    () => getArmorProficienciesWithSources(data, featureCatalogs),
    [data, featureCatalogs]
  );
  const toolProficiencyEntries = useMemo(
    () => getToolProficienciesWithSources(data, featureCatalogs),
    [data, featureCatalogs]
  );
  const languageEntries = useMemo(
    () => getLanguagesWithSources(data, featureCatalogs),
    [data, featureCatalogs]
  );
  const skillSourcesMap = useMemo(
    () => getSkillSourcesMap(data, featureCatalogs),
    [data, featureCatalogs]
  );
  const grantedSkillSet = useMemo(
    () => getGrantedSkillSet(data, featureCatalogs),
    [data, featureCatalogs]
  );

  const applyGrantUpdate = (patch: Partial<CharacterData>) => {
    if (!editable || !onChange) return;
    const merged = { ...data, ...patch };
    onChange(syncFeatureGrants(merged, featureCatalogs));
  };

  const updateFeatureChoice = (key: FeatureChoiceKey, value: string) => {
    if (!editable || !onChange) return;
    let nextChoices = {
      ...(data.featureChoices ?? {}),
      [key]: value,
    };
    if (key === "favoredEnemy" && value !== TWO_HUMANOID_SPECIES_OPTION) {
      nextChoices = { ...nextChoices, favoredHumanoidSpecies: [] };
    }
    if (key === "variantHumanFeat") {
      nextChoices = clearMagicInitiateChoices(nextChoices);
    }
    applyGrantUpdate({ featureChoices: nextChoices });
  };

  const updateFavoredHumanoidSpecies = (ids: string[]) => {
    if (!editable || !onChange) return;
    applyGrantUpdate({
      featureChoices: {
        ...(data.featureChoices ?? {}),
        favoredHumanoidSpecies: ids,
      },
    });
  };

  const customFeatures = data.features;
  const derivedAttacks = getAllAttacks(data, catalogItems, classCatalog);
  const characterActions = useMemo(
    () => getAllCharacterActions(data, featureCatalogs),
    [data, featureCatalogs]
  );
  const actionsByCost = useMemo(
    () => groupActionsByCost(characterActions),
    [characterActions]
  );
  const acBreakdown = useMemo(
    () => calculateAcBreakdown(data, catalogItems, classCatalog),
    [data, catalogItems, classCatalog]
  );
  const acTooltip = formatAcTooltip(acBreakdown);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">
              {data.basicInfo.name || "Unnamed Character"}
            </h1>
            {editHref && (
              <Link href={editHref} className="retro-inline-link text-sm">
                edit
              </Link>
            )}
          </div>
          <p className="text-muted-foreground">
            Level {level}
            {speciesClassDisplay ? (
              <>
                {" "}
                ·{" "}
                <Tooltip content={speciesClassTooltip}>
                  <span className="cursor-default">{speciesClassDisplay}</span>
                </Tooltip>
              </>
            ) : null}
            {data.basicInfo.playerName && (
              <> · Player: {data.basicInfo.playerName}</>
            )}
          </p>
        </div>
        <Badge variant="outline">Proficiency {formatModifier(profBonus)}</Badge>
      </div>

      <Tabs defaultValue="overview" className="sheet-tabs w-full">
        <TabsList className="flex h-auto w-full flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="abilities">Abilities/Skills</TabsTrigger>
          <TabsTrigger value="combat">Combat</TabsTrigger>
          <TabsTrigger value="attacks">Attacks/Spells</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Species"
              value={data.basicInfo.species}
              editable={false}
              tooltip={speciesTooltip}
            />
            <Field
              label="Class"
              value={classDisplay}
              editable={false}
              tooltip={classTooltip}
            />
            <Field
              label="Background"
              value={data.basicInfo.background}
              editable={false}
              tooltip={backgroundTooltip}
            />
            <Field
              label="Alignment"
              value={data.basicInfo.alignment}
              editable={false}
            />
            <Field
              label="Subclass"
              value={data.basicInfo.subclass}
              editable={false}
              tooltip={subclassTooltip}
            />
            {/* Level + XP inline */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Level</Label>
              {isDm && editable ? (
                <div className="space-y-2">
                  {/* Set total XP */}
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium w-6 shrink-0">{level}</p>
                    <Input
                      type="number"
                      min={0}
                      value={xp}
                      className="max-w-36"
                      onChange={(e) => {
                        const v = Math.max(0, parseInt(e.target.value) || 0);
                        updateBasicWithSync({ xp: v, level: levelFromXp(v) });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      {xpBar.nextLevelXp !== null
                        ? `${xpBar.progressXp.toLocaleString()} / ${xpBar.neededXp.toLocaleString()} XP to lvl ${level + 1}`
                        : "Max level"}
                    </p>
                  </div>
                  {/* Adjust XP by delta */}
                  <div className="flex items-center gap-2 pl-9">
                    <Input
                      type="number"
                      min={0}
                      placeholder="Amount"
                      value={xpDelta}
                      className="max-w-28"
                      onChange={(e) => setXpDelta(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!xpDelta || isNaN(parseInt(xpDelta))}
                      onClick={() => {
                        const delta = Math.max(0, parseInt(xpDelta) || 0);
                        const v = Math.max(0, xp + delta);
                        updateBasicWithSync({ xp: v, level: levelFromXp(v) });
                        setXpDelta("");
                      }}
                    >
                      + Add
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!xpDelta || isNaN(parseInt(xpDelta))}
                      onClick={() => {
                        const delta = Math.max(0, parseInt(xpDelta) || 0);
                        const v = Math.max(0, xp - delta);
                        updateBasicWithSync({ xp: v, level: levelFromXp(v) });
                        setXpDelta("");
                      }}
                    >
                      − Sub
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium w-6 shrink-0">{level}</p>
                  <div className="flex-1 space-y-0.5">
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-foreground rounded-full transition-all"
                        style={{ width: `${xpBar.pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {xp.toLocaleString()} XP
                      {xpBar.nextLevelXp !== null
                        ? ` · ${xpBar.progressXp.toLocaleString()} / ${xpBar.neededXp.toLocaleString()} to lvl ${level + 1}`
                        : " · Max level"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <ProficiencyOverviewList label="Languages" entries={languageEntries} />
          <ProficiencyOverviewList
            label="Tool proficiencies"
            entries={toolProficiencyEntries}
          />
          <ProficiencyOverviewList
            label="Weapon proficiencies"
            entries={weaponProficiencyEntries}
          />
          <ProficiencyOverviewList
            label="Armor proficiencies"
            entries={armorProficiencyEntries}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tooltip content={acTooltip}>
                <div className="cursor-default">
                  <Stat label="AC" value={acBreakdown.total} />
                </div>
              </Tooltip>
              <Stat
                label="HP"
                value={`${data.combat.currentHp}/${data.combat.maxHp}`}
              />
              <Stat label="Speed" value={`${data.combat.speed} ft`} />
              <Stat
                label="Passive Perception"
                value={getPassivePerception(data)}
              />
            </CardContent>
          </Card>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            {editable ? (
              <Textarea
                rows={4}
                value={data.basicInfo.publicNotes}
                onChange={(e) => updateBasic({ publicNotes: e.target.value })}
                placeholder="Character notes…"
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm">
                {data.basicInfo.publicNotes || "—"}
              </p>
            )}
          </div>
          {isDm ? (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">DM Notes</Label>
              {editable ? (
                <Textarea
                  rows={4}
                  value={data.basicInfo.dmNotes}
                  onChange={(e) => updateBasic({ dmNotes: e.target.value })}
                  placeholder="DM-only notes…"
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm">
                  {data.basicInfo.dmNotes || "—"}
                </p>
              )}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="abilities" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(ABILITY_LABELS) as AbilityKey[]).map((key) => (
              <Card key={key}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {ABILITY_FULL_LABELS[key]}
                    </p>
                    {editable ? (
                      <div className="mt-1 space-y-1">
                        <Tooltip
                          content={
                            data.abilityScoreBreakdown?.[key]
                              ? data.abilityScoreBreakdown[key].sources
                                  .map(
                                    (s) =>
                                      `${s.label}: ${s.value >= 0 ? "+" : ""}${s.value}`
                                  )
                                  .join("\n")
                              : null
                          }
                        >
                          <p className="text-2xl font-bold cursor-default">
                            {data.abilityScores[key]}
                          </p>
                        </Tooltip>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            className="w-16 h-7 text-xs"
                            placeholder="±0"
                            value={data.customAbilityMods?.[key] ?? 0}
                            onChange={(e) => {
                              const parsed = parseInt(e.target.value, 10);
                              updateCustomAbilityMod(
                                key,
                                Number.isFinite(parsed) ? parsed : 0
                              );
                            }}
                          />
                          <span className="text-xs text-muted-foreground">custom</span>
                        </div>
                      </div>
                    ) : (
                      <Tooltip
                        content={
                          data.abilityScoreBreakdown?.[key]
                            ? data.abilityScoreBreakdown[key].sources
                                .map(
                                  (s) =>
                                    `${s.label}: ${s.value >= 0 ? "+" : ""}${s.value}`
                                )
                                .join("\n")
                            : null
                        }
                      >
                        <p className="text-2xl font-bold">
                          {data.abilityScores[key]}
                        </p>
                      </Tooltip>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Mod</p>
                    <p className="text-xl font-semibold">
                      {formatModifier(mods[key])}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Tooltip
                        content={
                          isClassSavingThrowProficient(data, key, classCatalog)
                            ? resolvedClass
                              ? `${resolvedClass.name} saving throw`
                              : "Class saving throw"
                            : "Not proficient"
                        }
                      >
                        <span
                          className={[
                            "inline-block w-3 h-3 rounded-full border-2 shrink-0 cursor-default",
                            isClassSavingThrowProficient(data, key, classCatalog)
                              ? "bg-foreground border-foreground"
                              : "border-muted-foreground",
                          ].join(" ")}
                        />
                      </Tooltip>
                      <span className="text-xs">
                        Save {formatModifier(getSavingThrowTotal(data, key, classCatalog))}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {(Object.keys(SKILL_LABELS) as SkillKey[]).map((skill) => {
                const skillData = data.skills[skill] ?? {
                  proficient: false,
                  expertise: false,
                };
                const granted = isGrantedSkill(skill, skillSourcesMap);
                const proficient = isSkillProficient(data, skill, skillSourcesMap);
                const ability = SKILL_ABILITY_MAP[skill];
                const skillTooltip = (() => {
                  if (skillData.override !== undefined) {
                    return `Override: ${formatModifier(skillData.override)}`;
                  }
                  const parts = [
                    `${ABILITY_FULL_LABELS[ability]}: ${formatModifier(mods[ability])}`,
                  ];
                  if (proficient) parts.push(`Proficiency: ${formatModifier(profBonus)}`);
                  if (skillData.expertise) parts.push(`Expertise: ${formatModifier(profBonus)}`);
                  return parts.join("\n");
                })();
                const proficiencyTooltip = formatSkillProficiencyTooltip(
                  skill,
                  data,
                  skillSourcesMap
                );
                return (
                  <div
                    key={skill}
                    className="flex items-center gap-2 border-b py-2"
                  >
                    <Tooltip content={proficiencyTooltip}>
                      <span
                        className={[
                          "inline-block w-3 h-3 rounded-full border-2 shrink-0 cursor-default",
                          skillData.expertise
                            ? "bg-foreground border-foreground ring-2 ring-foreground ring-offset-[2px]"
                            : proficient
                            ? "bg-foreground border-foreground"
                            : "border-muted-foreground",
                        ].join(" ")}
                      />
                    </Tooltip>
                    {editable && (
                      <>
                        <Checkbox
                          checked={proficient}
                          disabled={granted}
                          onCheckedChange={(checked) => {
                            if (granted) return;
                            update({
                              skills: {
                                ...data.skills,
                                [skill]: {
                                  ...skillData,
                                  proficient: !!checked,
                                },
                              },
                            });
                          }}
                        />
                        <Checkbox
                          checked={skillData.expertise}
                          onCheckedChange={(checked) =>
                            update({
                              skills: {
                                ...data.skills,
                                [skill]: {
                                  ...skillData,
                                  expertise: !!checked,
                                },
                              },
                            })
                          }
                        />
                      </>
                    )}
                    <Tooltip content={skillTooltip}>
                      <div className="flex flex-1 min-w-0 cursor-default items-center justify-between gap-2">
                        <span className="text-sm truncate">
                          {SKILL_LABELS[skill]} ({ABILITY_LABELS[ability]})
                        </span>
                        <span className="font-mono text-sm shrink-0">
                          {formatModifier(
                            getSkillTotal(data, skill, { grantedSkills: grantedSkillSet })
                          )}
                        </span>
                      </div>
                    </Tooltip>
                  </div>
                );
              })}
              </div>
              {editable && (
                <p className="text-xs text-muted-foreground">
                  Dot = proficiency status (hover for source) · First checkbox = proficient, second = expertise · Feature-granted skills are locked on
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="combat" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tooltip content={acTooltip}>
              <div className="space-y-1 cursor-default">
                <Label className="text-xs text-muted-foreground">AC</Label>
                <p className="text-sm font-medium">{acBreakdown.total}</p>
              </div>
            </Tooltip>
            <Field
              label="Max HP"
              value={data.combat.maxHp}
              editable={editable}
              type="number"
              onChange={(v) => updateCombat({ maxHp: parseInt(v) || 0 })}
            />
            <Field
              label="Current HP"
              value={data.combat.currentHp}
              editable={editable}
              type="number"
              onChange={(v) => updateCombat({ currentHp: parseInt(v) || 0 })}
            />
            <Field
              label="Temp HP"
              value={data.combat.tempHp}
              editable={editable}
              type="number"
              onChange={(v) => updateCombat({ tempHp: parseInt(v) || 0 })}
            />
            <Field
              label="Initiative Bonus"
              value={data.combat.initiativeBonus}
              editable={editable}
              type="number"
              onChange={(v) =>
                updateCombat({ initiativeBonus: parseInt(v) || 0 })
              }
            />
            <Field
              label="Speed"
              value={data.combat.speed}
              editable={editable}
              type="number"
              onChange={(v) => updateCombat({ speed: parseInt(v) || 0 })}
            />
            <Field
              label="Hit Dice"
              value={data.combat.hitDice}
              editable={editable}
              onChange={(v) => updateCombat({ hitDice: v })}
            />
            <Field
              label="Exhaustion"
              value={data.combat.exhaustion}
              editable={editable}
              type="number"
              onChange={(v) =>
                updateCombat({ exhaustion: parseInt(v) || 0 })
              }
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Death Saves</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-6">
              <div>
                <Label className="text-xs">Successes</Label>
                {editable ? (
                  <Input
                    type="number"
                    min={0}
                    max={3}
                    value={data.combat.deathSaves.successes}
                    onChange={(e) =>
                      updateCombat({
                        deathSaves: {
                          ...data.combat.deathSaves,
                          successes: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                ) : (
                  <p>{data.combat.deathSaves.successes}/3</p>
                )}
              </div>
              <div>
                <Label className="text-xs">Failures</Label>
                {editable ? (
                  <Input
                    type="number"
                    min={0}
                    max={3}
                    value={data.combat.deathSaves.failures}
                    onChange={(e) =>
                      updateCombat({
                        deathSaves: {
                          ...data.combat.deathSaves,
                          failures: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                ) : (
                  <p>{data.combat.deathSaves.failures}/3</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conditions & Concentration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {data.combat.conditions.length === 0 ? (
                  <span className="text-sm text-muted-foreground">None</span>
                ) : (
                  data.combat.conditions.map((c) => (
                    <Badge key={c} variant="secondary">
                      {c}
                    </Badge>
                  ))
                )}
              </div>
              {editable && (
                <Input
                  placeholder="Conditions (comma-separated)"
                  value={data.combat.conditions.join(", ")}
                  onChange={(e) =>
                    updateCombat({
                      conditions: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={data.combat.concentration.active}
                  disabled={!editable}
                  onCheckedChange={(checked) =>
                    updateCombat({
                      concentration: {
                        ...data.combat.concentration,
                        active: !!checked,
                      },
                    })
                  }
                />
                <span className="text-sm">Concentrating on:</span>
                {editable ? (
                  <Input
                    className="max-w-xs"
                    value={data.combat.concentration.spell}
                    onChange={(e) =>
                      updateCombat({
                        concentration: {
                          ...data.combat.concentration,
                          spell: e.target.value,
                        },
                      })
                    }
                  />
                ) : (
                  <span>{data.combat.concentration.spell || "—"}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attacks" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Attacks</CardTitle>
              {editable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update({
                      attacks: [
                        ...data.attacks,
                        {
                          id: crypto.randomUUID(),
                          name: "",
                          attackBonus: 0,
                          damageDice: "",
                          damageType: "",
                          range: "",
                          notes: "",
                        },
                      ],
                    })
                  }
                >
                  Add Special Attack
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {derivedAttacks.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No attacks. Equip a weapon or add a special attack above.
                </p>
              )}
              {derivedAttacks.map((attack) => {
                if (attack.source !== "manual") {
                  return (
                    <div key={attack.id} className="rounded-md border p-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{attack.name}</p>
                          <Badge variant="outline" className="text-xs">
                            {attack.source === "weapon" ? "Weapon" : "Cantrip"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatModifier(attack.attackBonus)} to hit ·{" "}
                          {attack.damageDice} {attack.damageType}
                          {attack.range && ` · ${attack.range}`}
                        </p>
                        {attack.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5">{attack.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                }

                // Manual attack — editable
                const i = data.attacks.findIndex((a) => a.id === attack.id);
                if (i === -1) return null;
                const manualAttack = data.attacks[i];
                return (
                <div key={attack.id} className="rounded-md border p-3 space-y-2">
                  {editable ? (
                    <>
                      <Input
                        placeholder="Name"
                        value={manualAttack.name}
                        onChange={(e) => {
                          const attacks = [...data.attacks];
                          attacks[i] = { ...manualAttack, name: e.target.value };
                          update({ attacks });
                        }}
                      />
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                          type="number"
                          placeholder="Attack bonus"
                          value={manualAttack.attackBonus}
                          onChange={(e) => {
                            const attacks = [...data.attacks];
                            attacks[i] = {
                              ...manualAttack,
                              attackBonus: parseInt(e.target.value) || 0,
                            };
                            update({ attacks });
                          }}
                        />
                        <Input
                          placeholder="Damage (e.g. 1d8+3)"
                          value={manualAttack.damageDice}
                          onChange={(e) => {
                            const attacks = [...data.attacks];
                            attacks[i] = {
                              ...manualAttack,
                              damageDice: e.target.value,
                            };
                            update({ attacks });
                          }}
                        />
                        <Input
                          placeholder="Damage type"
                          value={manualAttack.damageType}
                          onChange={(e) => {
                            const attacks = [...data.attacks];
                            attacks[i] = {
                              ...manualAttack,
                              damageType: e.target.value,
                            };
                            update({ attacks });
                          }}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          update({
                            attacks: data.attacks.filter((a) => a.id !== manualAttack.id),
                          })
                        }
                      >
                        Remove
                      </Button>
                    </>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{manualAttack.name}</p>
                        <Badge variant="outline" className="text-xs">Special</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatModifier(manualAttack.attackBonus)} to hit ·{" "}
                        {manualAttack.damageDice} {manualAttack.damageType}
                        {manualAttack.range && ` · ${manualAttack.range}`}
                      </p>
                    </div>
                  )}
                </div>
                );
              })}
            </CardContent>
          </Card>

          {resolvedClass?.spellcasting && spellLimits && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Spellcasting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat
                  label="Spellcasting Ability"
                  value={
                    resolvedClass.spellcasting?.ability
                      ? ABILITY_FULL_LABELS[resolvedClass.spellcasting.ability]
                      : "—"
                  }
                />
                <Stat
                  label="Spell Save DC"
                  value={getSpellSaveDc(data) ?? "—"}
                />
                <Stat
                  label="Spell Attack"
                  value={
                    getSpellAttackBonus(data) !== null
                      ? formatModifier(getSpellAttackBonus(data)!)
                      : "—"
                  }
                />
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span className={cantripCount > spellLimits.cantripsKnown ? "text-destructive font-medium" : "text-muted-foreground"}>
                  Cantrips: {cantripCount}/{spellLimits.cantripsKnown}
                </span>
                {spellLimits.spellsKnown !== null ? (
                  <span className={leveledKnownCount > spellLimits.spellsKnown ? "text-destructive font-medium" : "text-muted-foreground"}>
                    Spells known: {leveledKnownCount}/{spellLimits.spellsKnown}
                  </span>
                ) : null}
                {spellLimits.preparedSpells !== null ? (
                  <span
                    className={
                      preparedLeveledCount > spellLimits.preparedSpells
                        ? "text-destructive font-medium"
                        : canManageSpellPrep
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                    }
                  >
                    Prepared spells: {preparedLeveledCount}/{spellLimits.preparedSpells}
                  </span>
                ) : null}
                {slotSummary.length > 0 ? (
                  <span className="text-muted-foreground">
                    Slots: {slotSummary.join(" · ")}
                  </span>
                ) : null}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Label>
                    {resolvedClass && isWizard(resolvedClass)
                      ? "Spellbook"
                      : resolvedClass && isKnownCaster(resolvedClass)
                        ? "Spells Known"
                        : "Spells"}
                  </Label>
                  {editable && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        swapSpellIndexRef.current = null;
                        setSpellPickerOpen(true);
                      }}
                    >
                      + Add Spell
                    </Button>
                  )}
                </div>
                {data.spells.known.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {editable
                      ? 'Click "+ Add Spell" to pick from the catalog.'
                      : "No spells."}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {knownSpellGroups.map((group) => {
                      const slotInfo =
                        group.level > 0
                          ? getSpellSlotAtLevel(data.spells.slots, group.level)
                          : null;
                      const levelPreparedSummary = formatLevelPreparedSummary(
                        group.spells.map(({ spell }) => spell),
                        group.level,
                        {
                          cantripsKnown: spellLimits.cantripsKnown,
                          preparedSpellLimit: spellLimits.preparedSpells,
                          usesPreparedList: spellLimits.usesPreparedList,
                          isKnownCaster: resolvedClass
                            ? isKnownCaster(resolvedClass)
                            : false,
                        }
                      );

                      return (
                      <div key={group.level} className="space-y-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {group.label}
                            {levelPreparedSummary ? (
                              <> · {levelPreparedSummary}</>
                            ) : null}
                            {slotInfo ? (
                              <>
                                {" · SLOTS: "}
                                <span
                                  className={
                                    slotInfo.remaining === 0 ? "text-destructive" : ""
                                  }
                                >
                                  {slotInfo.remaining}/{slotInfo.max}
                                </span>
                              </>
                            ) : null}
                          </p>
                          {slotInfo && canMutate ? (
                            <span className="inline-flex items-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs normal-case tracking-normal"
                                disabled={slotInfo.remaining <= 0}
                                onClick={() => adjustSlotUsed(group.level, 1)}
                              >
                                Use slot
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs normal-case tracking-normal"
                                disabled={slotInfo.used <= 0}
                                onClick={() => adjustSlotUsed(group.level, -1)}
                              >
                                Restore
                              </Button>
                            </span>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.spells.map(({ spell, index: i }) => {
                          const catalogSpell = spell.spellId
                            ? catalogSpells[spell.spellId]
                            : null;
                          const displayName = catalogSpell?.name ?? spell.name;
                          const spellTooltip = catalogSpell?.description || null;
                          const showPrepareToggle =
                            spell.level > 0 &&
                            resolvedClass &&
                            isPreparedCaster(resolvedClass) &&
                            !isKnownCaster(resolvedClass);
                          const atPrepareLimit =
                            spellLimits.preparedSpells !== null &&
                            !spell.prepared &&
                            !canPrepareAnother(data.spells.known, spellLimits.preparedSpells);

                          return (
                            <div
                              key={spell.id}
                              className="rounded-md border p-2.5 space-y-1.5 min-w-0"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                {editable ? (
                                  <Tooltip content={spellTooltip}>
                                    <button
                                      type="button"
                                      className="flex-1 text-left px-2.5 py-1.5 rounded-md border text-sm font-medium hover:bg-accent transition-colors min-w-0"
                                      onClick={() => {
                                        swapSpellIndexRef.current = i;
                                        setSpellPickerOpen(true);
                                      }}
                                    >
                                      <span className="block truncate">{displayName || "Unknown spell"}</span>
                                      {!spell.spellId && (
                                        <span className="text-xs text-muted-foreground font-normal">
                                          Custom — click to link to catalog
                                        </span>
                                      )}
                                    </button>
                                  </Tooltip>
                                ) : (
                                  <Tooltip content={spellTooltip}>
                                    <span className="font-medium text-sm cursor-default truncate">
                                      {displayName}
                                    </span>
                                  </Tooltip>
                                )}
                                {spell.level === 0 ? (
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    Prepared
                                  </Badge>
                                ) : showPrepareToggle && spell.prepared && !canManageSpellPrep ? (
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    Prepared
                                  </Badge>
                                ) : null}
                              </div>
                              {catalogSpell ? (
                                <SpellGlossaryMeta spell={catalogSpell} />
                              ) : spell.notes ? (
                                <p className="text-xs text-muted-foreground capitalize truncate">
                                  {spell.notes}
                                </p>
                              ) : null}
                              {(canManageSpellPrep && showPrepareToggle) || editable ? (
                                <div className="flex flex-wrap items-center gap-3 pt-1">
                                  {canManageSpellPrep && showPrepareToggle ? (
                                    <label
                                      className={`flex items-center gap-1.5 text-xs select-none ${
                                        atPrepareLimit ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                                      }`}
                                    >
                                      <Checkbox
                                        checked={spell.prepared}
                                        disabled={atPrepareLimit}
                                        onCheckedChange={(checked) => {
                                          if (
                                            checked &&
                                            spellLimits.preparedSpells !== null &&
                                            !canPrepareAnother(
                                              data.spells.known,
                                              spellLimits.preparedSpells
                                            )
                                          ) {
                                            return;
                                          }
                                          const known = [...data.spells.known];
                                          known[i] = { ...spell, prepared: !!checked };
                                          updateSpells({ ...data.spells, known });
                                        }}
                                      />
                                      Prepared
                                    </label>
                                  ) : null}
                                  {editable ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-xs text-destructive hover:text-destructive ml-auto"
                                      onClick={() =>
                                        updateSpells({
                                          ...data.spells,
                                          known: data.spells.known.filter((_, j) => j !== i),
                                        })
                                      }
                                    >
                                      Remove
                                    </Button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Actions</CardTitle>
              {editable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update({
                      customActions: [
                        ...(data.customActions ?? []),
                        {
                          id: crypto.randomUUID(),
                          name: "",
                          cost: "action",
                          description: "",
                        },
                      ],
                    })
                  }
                >
                  Add Custom Action
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {ACTION_COST_ORDER.map((cost) => {
                const entries = actionsByCost.get(cost) ?? [];
                if (entries.length === 0) return null;

                return (
                  <div key={cost}>
                    <h3 className="mb-2 text-sm font-semibold">
                      {ACTION_COST_LABELS[cost]}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {entries.map((action) => {
                        if (action.source !== "custom" || !editable) {
                          return (
                            <div
                              key={action.id}
                              className="rounded-md border p-3 space-y-1 min-w-0"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-sm">{action.name}</p>
                                <Badge variant="outline" className="text-xs">
                                  {actionSourceBadgeLabel(action)}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {action.description}
                              </p>
                              {action.uses ? (
                                <p className="text-xs text-muted-foreground">
                                  Uses: {action.uses.current}/{action.uses.max}
                                  {action.restReset && action.restReset !== "none"
                                    ? ` (${action.restReset} rest)`
                                    : ""}
                                </p>
                              ) : null}
                            </div>
                          );
                        }

                        const i = (data.customActions ?? []).findIndex(
                          (a) => a.id === action.id
                        );
                        if (i === -1) return null;
                        const customAction = data.customActions![i];

                        return (
                          <div
                            key={action.id}
                            className="rounded-md border p-3 space-y-2 min-w-0"
                          >
                            <Input
                              placeholder="Name"
                              value={customAction.name}
                              onChange={(e) => {
                                const customActions = [...data.customActions!];
                                customActions[i] = {
                                  ...customAction,
                                  name: e.target.value,
                                };
                                update({ customActions });
                              }}
                            />
                            <Select
                              value={customAction.cost}
                              onValueChange={(value) => {
                                const customActions = [...data.customActions!];
                                customActions[i] = {
                                  ...customAction,
                                  cost: value as ActionCost,
                                };
                                update({ customActions });
                              }}
                            >
                              <SelectTrigger className="w-full sm:w-48">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ACTION_COST_ORDER.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {ACTION_COST_LABELS[option]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Textarea
                              placeholder="Description"
                              value={customAction.description}
                              onChange={(e) => {
                                const customActions = [...data.customActions!];
                                customActions[i] = {
                                  ...customAction,
                                  description: e.target.value,
                                };
                                update({ customActions });
                              }}
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                update({
                                  customActions: data.customActions!.filter(
                                    (a) => a.id !== customAction.id
                                  ),
                                })
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {editable && resolvedClass?.spellcasting && (
          <SpellPicker
            open={spellPickerOpen}
            onClose={() => {
              setSpellPickerOpen(false);
              swapSpellIndexRef.current = null;
            }}
            onSelect={applySpellPickerSelection}
            defaultClassListId={classSpellListId}
            maxSpellLevel={maxCastableSpellLevel}
            excludeSlugs={
              swapSpellIndexRef.current !== null
                ? knownSpellSlugs.filter(
                    (slug) =>
                      slug !== data.spells.known[swapSpellIndexRef.current!]?.spellId
                  )
                : knownSpellSlugs
            }
          />
          )}
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">Currency</p>
                <div className="grid grid-cols-5 gap-2">
                  {(["cp", "sp", "ep", "gp", "pp"] as const).map((coin) => (
                    <Field
                      key={coin}
                      label={coin.toUpperCase()}
                      value={data.inventory.currency[coin]}
                      editable={editable}
                      type="number"
                      onChange={(v) =>
                        update({
                          inventory: {
                            ...data.inventory,
                            currency: {
                              ...data.inventory.currency,
                              [coin]: Math.max(0, parseInt(v, 10) || 0),
                            },
                          },
                        })
                      }
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-row items-center justify-between">
                  <p className="text-sm font-medium">Items</p>
                  {editable && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setItemPickerOpen(true)}
                    >
                      + Add Item
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {data.inventory.items.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {editable ? 'Click "+ Add Item" to pick from the catalog.' : "No items."}
                    </p>
                  )}
                  {data.inventory.items.map((item, i) => {
                    const catalogItem = item.itemId ? catalogItems[item.itemId] : null;
                    const displayName = catalogItem?.name ?? (item.name || "Unknown item");
                    const isMagic = item.magicItem || (catalogItem?.is_magic ?? false);
                    const equippable = isEquippableItem(catalogItem, item);
                    const equipSlot = getItemEquipSlot(catalogItem, item);
                    const isWeapon = equipSlot === "weapon";
                    const isWornGear = equipSlot === "armor" || equipSlot === "shield";
                    const wieldMain =
                      item.wieldMain ||
                      (getEffectiveWieldMain(item, catalogItem) && !item.wieldOff);
                    const wieldOff = getEffectiveWieldOff(item);
                    const showOffHand = isWeapon && isLightWeapon(catalogItem);
                    const offHandEnabled = canWieldOffHand(data.inventory.items, i, catalogItems);
                    const wp = catalogItem ? getWeaponProperties(catalogItem) : null;
                    const detail = wp
                      ? `${wp.damage} ${wp.damageType} · ${wp.weaponCategory} ${wp.weaponRange}`
                      : catalogItem?.category && catalogItem.category !== "other"
                      ? categoryLabel(catalogItem.category as Parameters<typeof categoryLabel>[0])
                      : null;
                    const itemTooltip = catalogItem
                      ? formatItemTooltip(catalogItem)
                      : item.notes || null;

                    return (
                      <div key={item.id} className="rounded-md border p-2.5 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {editable ? (
                              <Tooltip content={itemTooltip}>
                                <button
                                  type="button"
                                  className="text-left px-2.5 py-1.5 rounded-md border text-sm font-medium hover:bg-accent transition-colors min-w-0"
                                  onClick={() => {
                                    swapItemIndexRef.current = i;
                                    setItemPickerOpen(true);
                                  }}
                                >
                                  <span className="block truncate">{displayName}</span>
                                  {!item.itemId && (
                                    <span className="text-xs text-muted-foreground font-normal">
                                      Custom — click to link to catalog
                                    </span>
                                  )}
                                </button>
                              </Tooltip>
                            ) : (
                              <Tooltip content={itemTooltip}>
                                <span className="font-medium text-sm cursor-default">
                                  {displayName}
                                </span>
                              </Tooltip>
                            )}
                            {isWornGear && (editable || canToggleEquipment) && (
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none shrink-0">
                                <Checkbox
                                  checked={item.equipped}
                                  onCheckedChange={(checked) => {
                                    const items = setItemEquipped(
                                      data.inventory.items,
                                      i,
                                      !!checked,
                                      catalogItems
                                    );
                                    update({ inventory: { ...data.inventory, items } });
                                  }}
                                />
                                Equipped
                              </label>
                            )}
                            {isWeapon && (editable || canToggleEquipment) && (
                              <>
                                <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none shrink-0">
                                  <Checkbox
                                    checked={wieldMain}
                                    onCheckedChange={(checked) => {
                                      const items = setWeaponWield(
                                        data.inventory.items,
                                        i,
                                        "main",
                                        !!checked,
                                        catalogItems
                                      );
                                      update({ inventory: { ...data.inventory, items } });
                                    }}
                                  />
                                  Main
                                </label>
                                {showOffHand && (
                                  <label
                                    className={`flex items-center gap-1.5 text-xs select-none shrink-0 ${
                                      offHandEnabled || wieldOff
                                        ? "cursor-pointer"
                                        : "cursor-not-allowed opacity-50"
                                    }`}
                                  >
                                    <Checkbox
                                      checked={wieldOff}
                                      disabled={!offHandEnabled && !wieldOff}
                                      onCheckedChange={(checked) => {
                                        const items = setWeaponWield(
                                          data.inventory.items,
                                          i,
                                          "off",
                                          !!checked,
                                          catalogItems
                                        );
                                        update({ inventory: { ...data.inventory, items } });
                                      }}
                                    />
                                    Off-hand
                                  </label>
                                )}
                              </>
                            )}
                          </div>

                          {/* Quantity */}
                          {editable ? (
                            <Input
                              type="number"
                              className="w-16 h-8 text-sm shrink-0"
                              value={item.quantity}
                              min={0}
                              onChange={(e) => {
                                const quantity = parseInt(e.target.value) || 0;
                                let items = [...data.inventory.items];
                                items[i] = { ...item, quantity };
                                if (
                                  quantity < 2 &&
                                  items[i].wieldOff &&
                                  !canWieldOffHand(items, i, catalogItems)
                                ) {
                                  items = setWeaponWield(items, i, "off", false, catalogItems);
                                }
                                update({ inventory: { ...data.inventory, items } });
                              }}
                            />
                          ) : (
                            item.quantity !== 1 && (
                              <span className="text-sm text-muted-foreground">×{item.quantity}</span>
                            )
                          )}

                          {!item.itemId && editable && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Input
                                type="number"
                                className="w-20 h-8 text-sm"
                                min={0}
                                step="0.1"
                                placeholder="lb"
                                value={item.weightLb ?? ""}
                                aria-label="Weight in pounds"
                                onChange={(e) => {
                                  const raw = e.target.value.trim();
                                  const weightLb =
                                    raw === ""
                                      ? undefined
                                      : Math.max(0, parseFloat(raw) || 0);
                                  const items = [...data.inventory.items];
                                  items[i] = { ...item, weightLb };
                                  update({ inventory: { ...data.inventory, items } });
                                }}
                              />
                              <span className="text-xs text-muted-foreground">lb</span>
                            </div>
                          )}

                          {/* Badges */}
                          {isWornGear && item.equipped && !editable && !canToggleEquipment && (
                            <Badge className="text-xs shrink-0">Equipped</Badge>
                          )}
                          {isWeapon && wieldMain && !editable && !canToggleEquipment && (
                            <Badge className="text-xs shrink-0">Main</Badge>
                          )}
                          {isWeapon && wieldOff && !editable && !canToggleEquipment && (
                            <Badge variant="secondary" className="text-xs shrink-0">Off-hand</Badge>
                          )}
                          {isMagic && (
                            <Badge
                              variant="secondary"
                              className={`text-xs shrink-0 ${RARITY_COLOR[(catalogItem?.rarity ?? "common") as keyof typeof RARITY_COLOR]}`}
                            >
                              {catalogItem?.rarity && catalogItem.rarity !== "common"
                                ? rarityLabel(catalogItem.rarity as Parameters<typeof rarityLabel>[0])
                                : "Magic"}
                            </Badge>
                          )}
                          {catalogItem?.requires_attunement && item.attuned && (
                            <Badge variant="outline" className="text-xs shrink-0">Attuned</Badge>
                          )}
                        </div>

                        {detail && (
                          <p className="text-xs text-muted-foreground">{detail}</p>
                        )}
                        {!catalogItem && item.weightLb != null && !editable && (
                          <p className="text-xs text-muted-foreground">{item.weightLb} lb</p>
                        )}

                        {equippable &&
                          (editable || canToggleEquipment) &&
                          (catalogItem?.requires_attunement || editable) && (
                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            {catalogItem?.requires_attunement && (
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                                <Checkbox
                                  checked={item.attuned ?? false}
                                  onCheckedChange={(checked) => {
                                    const items = [...data.inventory.items];
                                    items[i] = { ...item, attuned: !!checked };
                                    update({ inventory: { ...data.inventory, items } });
                                  }}
                                />
                                Attuned
                              </label>
                            )}
                            {editable ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs text-destructive hover:text-destructive ml-auto"
                                onClick={() =>
                                  update({
                                    inventory: {
                                      ...data.inventory,
                                      items: data.inventory.items.filter((_, j) => j !== i),
                                    },
                                  })
                                }
                              >
                                Remove
                              </Button>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <ItemPicker
            open={itemPickerOpen}
            onClose={() => {
              setItemPickerOpen(false);
              swapItemIndexRef.current = null;
            }}
            onSelect={(selection) => {
              const swapIndex = swapItemIndexRef.current;
              swapItemIndexRef.current = null;

              if (selection.source === "custom") {
                if (swapIndex !== null) {
                  const items = [...data.inventory.items];
                  const { itemId: _removed, ...rest } = items[swapIndex];
                  items[swapIndex] = {
                    ...rest,
                    name: selection.name,
                    weightLb: selection.weightLb,
                    magicItem: false,
                    equipped: false,
                    wieldMain: false,
                    wieldOff: false,
                    attuned: false,
                  };
                  update({ inventory: { ...data.inventory, items } });
                } else {
                  update({
                    inventory: {
                      ...data.inventory,
                      items: [
                        ...data.inventory.items,
                        {
                          id: crypto.randomUUID(),
                          name: selection.name,
                          quantity: 1,
                          weightLb: selection.weightLb,
                          equipped: false,
                          wieldMain: false,
                          wieldOff: false,
                          attuned: false,
                          magicItem: false,
                          notes: "",
                        },
                      ],
                    },
                  });
                }
                return;
              }

              const catalogItem = selection.item;

              if (swapIndex !== null) {
                // Swap an existing slot to a different catalog item
                const items = [...data.inventory.items];
                items[swapIndex] = {
                  ...items[swapIndex],
                  itemId: catalogItem.slug,
                  name: catalogItem.name,
                  magicItem: catalogItem.is_magic,
                };
                update({ inventory: { ...data.inventory, items } });
              } else {
                // Add a brand new item
                const newItem = {
                  id: crypto.randomUUID(),
                  itemId: catalogItem.slug,
                  name: catalogItem.name,
                  quantity: 1,
                  equipped: false,
                  wieldMain: false,
                  wieldOff: false,
                  attuned: false,
                  magicItem: catalogItem.is_magic,
                  notes: "",
                };
                update({
                  inventory: {
                    ...data.inventory,
                    items: [...data.inventory.items, newItem],
                  },
                });
              }
            }}
          />
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Features & Traits</CardTitle>
              {editable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update({
                      features: [
                        ...customFeatures,
                        {
                          id: crypto.randomUUID(),
                          name: "",
                          description: "",
                          restReset: "long" as const,
                        },
                      ],
                    })
                  }
                >
                  Add Feature
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {grantedFeatures.length === 0 && customFeatures.length === 0 ? (
                <p className="text-sm text-muted-foreground">No features.</p>
              ) : null}
              {grantedFeatures.map((feature) =>
                isGrantConfigurableFeature(feature) ? (
                  <GrantFeatureRow
                    key={feature.id}
                    feature={feature}
                    data={data}
                    editable={editable}
                    onApply={applyGrantUpdate}
                  />
                ) : isConfigurableGrantedFeature(feature) ? (
                  <ConfigurableFeatureRow
                    key={feature.id}
                    feature={feature}
                    editable={editable}
                    onChoiceChange={updateFeatureChoice}
                    favoredHumanoidSpecies={data.featureChoices?.favoredHumanoidSpecies ?? []}
                    onFavoredHumanoidSpeciesChange={updateFavoredHumanoidSpecies}
                  />
                ) : (
                  <GrantedFeatureRow key={feature.id} feature={feature} />
                )
              )}
              {customFeatures.map((feature, i) => (
                <div key={feature.id} className="rounded-md border p-3 space-y-2">
                  {editable ? (
                    <>
                      <Input
                        placeholder="Name"
                        value={feature.name}
                        onChange={(e) => {
                          const features = [...customFeatures];
                          features[i] = { ...feature, name: e.target.value };
                          update({ features });
                        }}
                      />
                      <Textarea
                        placeholder="Description"
                        value={feature.description}
                        onChange={(e) => {
                          const features = [...customFeatures];
                          features[i] = {
                            ...feature,
                            description: e.target.value,
                          };
                          update({ features });
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() =>
                          update({
                            features: customFeatures.filter((f) => f.id !== feature.id),
                          })
                        }
                      >
                        Remove
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">{feature.name}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {feature.description}
                      </p>
                      {feature.uses && (
                        <p className="text-xs">
                          Uses: {feature.uses.current}/{feature.uses.max} (
                          {feature.restReset} rest)
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
