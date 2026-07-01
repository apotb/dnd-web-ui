"use client";

import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CatalogItemPicker } from "@/components/character-creator/catalog-item-picker";
import { EquipmentSubPicker } from "@/components/character-creator/equipment-sub-picker";
import { SkillPicker } from "@/components/character-creator/skill-picker";
import { useGatedFeatureEdit } from "@/components/character/use-gated-feature-edit";
import { CantripPickerField } from "@/components/spells/cantrip-picker-field";
import { SpellPicker } from "@/components/spells/spell-picker";
import type { CatalogSpellRow } from "@/lib/content/catalog-client";
import { choicePlaceholder } from "@/lib/character/feature-choices";
import {
  buildGrantFeatureCommitPatch,
  isGrantFeatureDraftDirty,
} from "@/lib/character/creation-choice-draft";
import { featureSourceLabel } from "@/lib/character/feature-derivation";
import type { GrantConfigurableFeature } from "@/lib/character/feature-grant-features";
import type {
  BackgroundChoices,
  CharacterData,
  FeatureChoices,
  SkillKey,
  SpeciesChoices,
} from "@/lib/schemas/character";
import { optionLabel } from "@/lib/ui/select-display";
import { getSpell } from "@/lib/dnd/phb/spells";
import { weaponChoicesToFilter } from "@/lib/items/catalog-picker-filter";

interface GrantFeatureRowProps {
  feature: GrantConfigurableFeature;
  data: CharacterData;
  editable?: boolean;
  onApply: (patch: Partial<CharacterData>) => void;
}

function patchStorage(
  data: CharacterData,
  storage: GrantConfigurableFeature["grantEditor"]["storage"],
  value: string | string[]
): Partial<CharacterData> {
  if (storage.area === "featureChoices") {
    return {
      featureChoices: {
        ...(data.featureChoices ?? {}),
        [storage.key]: value,
      } as FeatureChoices,
    };
  }
  if (storage.area === "speciesChoices") {
    return {
      speciesChoices: {
        ...(data.speciesChoices ?? {}),
        [storage.key]: value,
      } as SpeciesChoices,
    };
  }
  return {
    backgroundChoices: {
      ...(data.backgroundChoices ?? {}),
      [storage.key]: value,
    } as BackgroundChoices,
  };
}

export function GrantFeatureRow({
  feature,
  data,
  editable,
  onApply,
}: GrantFeatureRowProps) {
  const [spellPickerOpen, setSpellPickerOpen] = useState(false);
  const [spellPickerTarget, setSpellPickerTarget] = useState<
    "magic-cantrip-0" | "magic-cantrip-1" | "magic-spell" | null
  >(null);

  const handleCommit = useCallback(
    (draft: CharacterData) => {
      onApply(buildGrantFeatureCommitPatch(feature, data, draft));
    },
    [data, feature, onApply]
  );

  const {
    gated,
    isEditing,
    workingData,
    startEdit,
    save,
    cancel,
    draftApply,
    canSave,
  } = useGatedFeatureEdit({
    featureId: feature.id,
    editable,
    savedData: data,
    isDraftDirty: (saved, draft) => isGrantFeatureDraftDirty(feature, saved, draft),
    onCommit: handleCommit,
  });

  const editor = feature.grantEditor;
  const showEditors = gated ? isEditing : !!editable;

  const magicClass = workingData.featureChoices?.magicInitiateClass ?? "";
  const magicCantrips = workingData.featureChoices?.magicInitiateCantripIds ?? [];
  const magicSpellId = workingData.featureChoices?.magicInitiateSpellId ?? "";
  const skillOrToolChoice = workingData.speciesChoices?.speciesSkillOrTool ?? "";

  function applyPatch(patch: Partial<CharacterData>) {
    if (gated && isEditing) {
      draftApply(patch);
      return;
    }
    onApply(patch);
  }

  function applyStorage(value: string | string[]) {
    applyPatch(patchStorage(workingData, editor.storage, value));
  }

  function applyMagicInitiate(
    patch: Partial<
      Pick<FeatureChoices, "magicInitiateClass" | "magicInitiateCantripIds" | "magicInitiateSpellId">
    >
  ) {
    applyPatch({
      featureChoices: {
        ...(workingData.featureChoices ?? {}),
        ...patch,
      },
    });
  }

  function handleSpellSelect(spell: CatalogSpellRow) {
    if (spellPickerTarget === "magic-cantrip-0") {
      const next = [...magicCantrips];
      next[0] = spell.slug;
      applyMagicInitiate({ magicInitiateCantripIds: next.slice(0, 2) });
    } else if (spellPickerTarget === "magic-cantrip-1") {
      const next = [...magicCantrips];
      next[1] = spell.slug;
      applyMagicInitiate({ magicInitiateCantripIds: next.slice(0, 2) });
    } else if (spellPickerTarget === "magic-spell") {
      applyMagicInitiate({ magicInitiateSpellId: spell.slug });
    }
    setSpellPickerOpen(false);
    setSpellPickerTarget(null);
  }

  const cantripFeatureKey =
    editor.kind === "cantrip" && editor.storage.area === "featureChoices"
      ? (editor.storage.key as keyof FeatureChoices)
      : null;
  const cantripValue =
    cantripFeatureKey != null
      ? String(workingData.featureChoices?.[cantripFeatureKey] ?? "")
      : workingData.speciesChoices?.speciesCantripId ?? "";

  function readSkillSelection(): SkillKey[] {
    if (editor.kind !== "skill") return [];
    if (editor.storage.area === "featureChoices") {
      const key = editor.storage.key as keyof FeatureChoices;
      const value = workingData.featureChoices?.[key];
      return typeof value === "string" && value ? [value as SkillKey] : [];
    }
    if (workingData.speciesChoices?.variantHumanSkill) {
      return [workingData.speciesChoices.variantHumanSkill];
    }
    return [];
  }

  return (
    <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{feature.name}</p>
          <Badge variant="outline" className="text-xs shrink-0">
            {featureSourceLabel(feature.source)}
          </Badge>
        </div>
        {editable && gated && !isEditing ? (
          <Button type="button" size="sm" variant="outline" onClick={startEdit}>
            Edit
          </Button>
        ) : null}
        {editable && gated && isEditing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={cancel}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={!canSave}>
              Save
            </Button>
          </div>
        ) : null}
      </div>

      {showEditors ? (
        <div className="space-y-2">
          {editor.kind === "skill-or-tool" ? (
            <Select
              value={skillOrToolChoice || undefined}
              onValueChange={(value) => {
                applyPatch({
                  speciesChoices: {
                    ...(workingData.speciesChoices ?? {}),
                    speciesSkillOrTool: (value ?? "") as SpeciesChoices["speciesSkillOrTool"],
                    ...(value === "skill" ? { speciesToolChoice: "" } : { speciesSkillChoices: [] }),
                  },
                });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder={choicePlaceholder(feature.choiceKey)}>
                  {optionLabel(feature.choiceOptions, skillOrToolChoice)}
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
          ) : null}

          {editor.kind === "skills" ? (
            <SkillPicker
              selected={
                editor.storage.area === "backgroundChoices"
                  ? (workingData.backgroundChoices?.backgroundSkillChoices ?? [])
                  : (workingData.speciesChoices?.speciesSkillChoices ?? [])
              }
              max={editor.max ?? 1}
              options={editor.skillOptions}
              onChange={(skills) => applyStorage(skills)}
            />
          ) : null}

          {editor.kind === "skill" ? (
            <SkillPicker
              selected={readSkillSelection()}
              max={1}
              options={editor.skillOptions}
              onChange={(skills) => applyStorage(skills[0] ?? "")}
            />
          ) : null}

          {editor.kind === "skill-or-tool" && skillOrToolChoice === "skill" ? (
            <SkillPicker
              selected={workingData.speciesChoices?.speciesSkillChoices ?? []}
              max={1}
              onChange={(skills) =>
                applyPatch({
                  speciesChoices: {
                    ...(workingData.speciesChoices ?? {}),
                    speciesSkillChoices: skills,
                  },
                })
              }
            />
          ) : null}

          {editor.kind === "skill-or-tool" && skillOrToolChoice === "tool" ? (
            <EquipmentSubPicker
              filter={{ kind: "creator_tools" }}
              value={workingData.speciesChoices?.speciesToolChoice || null}
              onSelect={(tool) =>
                applyPatch({
                  speciesChoices: {
                    ...(workingData.speciesChoices ?? {}),
                    speciesToolChoice: tool,
                  },
                })
              }
            />
          ) : null}

          {editor.kind === "weapons" && editor.weaponChoiceFilter ? (
            <CatalogItemPicker
              filter={weaponChoicesToFilter(editor.weaponChoiceFilter)}
              selected={workingData.speciesChoices?.speciesWeaponChoices ?? []}
              max={editor.max ?? 1}
              placeholder="Search weapons…"
              onChange={(names) => applyStorage(names)}
            />
          ) : null}

          {editor.kind === "tool-pick" ? (
            <>
              <Select
                value={workingData.backgroundChoices?.backgroundToolPick || undefined}
                onValueChange={(value) => applyStorage(value ?? "")}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select tool type">
                    {optionLabel(
                      (editor.toolPickOptions ?? []).map((opt) => ({
                        value: opt,
                        label: opt,
                      })),
                      workingData.backgroundChoices?.backgroundToolPick
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(editor.toolPickOptions ?? []).map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workingData.backgroundChoices?.backgroundToolPick === "artisan's tools" ? (
                <EquipmentSubPicker
                  filter={{ kind: "subcategory", subcategory: "artisans_tools" }}
                  value={workingData.backgroundChoices?.backgroundArtisanTool || null}
                  onSelect={(tool) =>
                    applyPatch({
                      backgroundChoices: {
                        ...(workingData.backgroundChoices ?? {}),
                        backgroundArtisanTool: tool,
                      },
                    })
                  }
                />
              ) : null}
              {workingData.backgroundChoices?.backgroundToolPick === "gaming set" ? (
                <EquipmentSubPicker
                  filter={{ kind: "subcategory", subcategory: "gaming_set" }}
                  value={workingData.backgroundChoices?.backgroundGamingSet || null}
                  onSelect={(tool) =>
                    applyPatch({
                      backgroundChoices: {
                        ...(workingData.backgroundChoices ?? {}),
                        backgroundGamingSet: tool,
                      },
                    })
                  }
                />
              ) : null}
              {workingData.backgroundChoices?.backgroundToolPick === "musical instrument" ? (
                <EquipmentSubPicker
                  filter={{ kind: "subcategory", subcategory: "musical_instrument" }}
                  value={workingData.backgroundChoices?.backgroundMusicalInstrument || null}
                  onSelect={(tool) =>
                    applyPatch({
                      backgroundChoices: {
                        ...(workingData.backgroundChoices ?? {}),
                        backgroundMusicalInstrument: tool,
                      },
                    })
                  }
                />
              ) : null}
            </>
          ) : null}

          {editor.kind === "tool-multi" ? (
            <div className="flex flex-wrap gap-2">
              {(editor.toolPickOptions ?? []).map((opt) => {
                const toolOpt = opt as BackgroundChoices["backgroundToolMulti"][number];
                const selected = workingData.backgroundChoices?.backgroundToolMulti ?? [];
                const active = selected.includes(toolOpt);
                return (
                  <Button
                    key={String(opt)}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    onClick={() => {
                      const max = editor.max ?? 1;
                      const next = active
                        ? selected.filter((v) => v !== toolOpt)
                        : selected.length >= max
                          ? selected
                          : [...selected, toolOpt];
                      applyStorage(next);
                    }}
                  >
                    {opt}
                  </Button>
                );
              })}
            </div>
          ) : null}

          {editor.kind === "cantrip" && editor.spellListId ? (
            <CantripPickerField
              value={cantripValue}
              onChange={(spellId) => applyStorage(spellId)}
              classListId={editor.spellListId}
            />
          ) : null}

          {editor.kind === "magic-initiate" ? (
            <div className="space-y-2">
              <Select
                value={magicClass || undefined}
                onValueChange={(value) =>
                  applyMagicInitiate({
                    magicInitiateClass: (value ?? "") as FeatureChoices["magicInitiateClass"],
                    magicInitiateCantripIds: [],
                    magicInitiateSpellId: "",
                  })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Spell list">
                    {optionLabel(
                      [
                        { value: "cleric", label: "Cleric" },
                        { value: "druid", label: "Druid" },
                        { value: "wizard", label: "Wizard" },
                      ],
                      magicClass
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cleric">Cleric</SelectItem>
                  <SelectItem value="druid">Druid</SelectItem>
                  <SelectItem value="wizard">Wizard</SelectItem>
                </SelectContent>
              </Select>
              {magicClass ? (
                <div className="flex flex-wrap gap-2">
                  {[0, 1].map((index) => (
                    <Button
                      key={index}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSpellPickerTarget(
                          index === 0 ? "magic-cantrip-0" : "magic-cantrip-1"
                        );
                        setSpellPickerOpen(true);
                      }}
                    >
                      {magicCantrips[index]
                        ? getSpell(magicCantrips[index])?.name ?? magicCantrips[index]
                        : `Cantrip ${index + 1}`}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSpellPickerTarget("magic-spell");
                      setSpellPickerOpen(true);
                    }}
                  >
                    {magicSpellId
                      ? getSpell(magicSpellId)?.name ?? magicSpellId
                      : "1st-level spell"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {feature.description}
      </p>

      {showEditors && editor.kind === "magic-initiate" && magicClass && spellPickerOpen ? (
        <SpellPicker
          open={spellPickerOpen}
          onClose={() => {
            setSpellPickerOpen(false);
            setSpellPickerTarget(null);
          }}
          onSelect={handleSpellSelect}
          defaultClassListId={magicClass}
          maxSpellLevel={spellPickerTarget === "magic-spell" ? 1 : 0}
        />
      ) : null}
    </div>
  );
}
