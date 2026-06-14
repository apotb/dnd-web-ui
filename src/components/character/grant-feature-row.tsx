"use client";

import { useMemo, useState } from "react";
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
import { SpellPicker } from "@/components/spells/spell-picker";
import type { CatalogSpellRow } from "@/lib/content/catalog-client";
import { choicePlaceholder } from "@/lib/character/feature-choices";
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
import { getCantripsForList, getSpell } from "@/lib/dnd/phb/spells";
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

  const editor = feature.grantEditor;
  const magicClass = data.featureChoices?.magicInitiateClass ?? "";
  const magicCantrips = data.featureChoices?.magicInitiateCantripIds ?? [];
  const magicSpellId = data.featureChoices?.magicInitiateSpellId ?? "";

  const cantripOptions = useMemo(() => {
    if (editor.kind === "cantrip" && editor.spellListId) {
      return getCantripsForList(editor.spellListId);
    }
    return [];
  }, [editor]);

  function applyStorage(value: string | string[]) {
    onApply(patchStorage(data, editor.storage, value));
  }

  function applyMagicInitiate(
    patch: Partial<
      Pick<FeatureChoices, "magicInitiateClass" | "magicInitiateCantripIds" | "magicInitiateSpellId">
    >
  ) {
    onApply({
      featureChoices: {
        ...(data.featureChoices ?? {}),
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

  return (
    <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{feature.name}</p>
        <Badge variant="outline" className="text-xs shrink-0">
          {featureSourceLabel(feature.source)}
        </Badge>
      </div>

      {editable ? (
        <div className="space-y-2">
          {editor.kind === "skill-or-tool" ? (
            <Select
              value={feature.choiceValue || undefined}
              onValueChange={(value) => {
                onApply({
                  speciesChoices: {
                    ...(data.speciesChoices ?? {}),
                    speciesSkillOrTool: (value ?? "") as SpeciesChoices["speciesSkillOrTool"],
                    ...(value === "skill" ? { speciesToolChoice: "" } : { speciesSkillChoices: [] }),
                  },
                });
              }}
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
          ) : null}

          {editor.kind === "skills" ? (
            <SkillPicker
              selected={
                editor.storage.area === "backgroundChoices"
                  ? (data.backgroundChoices?.backgroundSkillChoices ?? [])
                  : (data.speciesChoices?.speciesSkillChoices ?? [])
              }
              max={editor.max ?? 1}
              options={editor.skillOptions}
              onChange={(skills) => applyStorage(skills)}
            />
          ) : null}

          {editor.kind === "skill" ? (
            <SkillPicker
              selected={
                data.speciesChoices?.variantHumanSkill
                  ? [data.speciesChoices.variantHumanSkill]
                  : []
              }
              max={1}
              onChange={(skills) => applyStorage(skills[0] ?? "")}
            />
          ) : null}

          {editor.kind === "skill-or-tool" &&
          data.speciesChoices?.speciesSkillOrTool === "skill" ? (
            <SkillPicker
              selected={data.speciesChoices?.speciesSkillChoices ?? []}
              max={1}
              onChange={(skills) =>
                onApply({
                  speciesChoices: {
                    ...(data.speciesChoices ?? {}),
                    speciesSkillChoices: skills,
                  },
                })
              }
            />
          ) : null}

          {editor.kind === "skill-or-tool" &&
          data.speciesChoices?.speciesSkillOrTool === "tool" ? (
            <EquipmentSubPicker
              filter={{ kind: "creator_tools" }}
              value={data.speciesChoices?.speciesToolChoice || null}
              onSelect={(tool) =>
                onApply({
                  speciesChoices: {
                    ...(data.speciesChoices ?? {}),
                    speciesToolChoice: tool,
                  },
                })
              }
            />
          ) : null}

          {editor.kind === "weapons" && editor.weaponChoiceFilter ? (
            <CatalogItemPicker
              filter={weaponChoicesToFilter(editor.weaponChoiceFilter)}
              selected={data.speciesChoices?.speciesWeaponChoices ?? []}
              max={editor.max ?? 1}
              placeholder="Search weapons…"
              onChange={(names) => applyStorage(names)}
            />
          ) : null}

          {editor.kind === "tool-pick" ? (
            <>
              <Select
                value={data.backgroundChoices?.backgroundToolPick || undefined}
                onValueChange={(value) => applyStorage(value ?? "")}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select tool type">
                    {optionLabel(
                      (editor.toolPickOptions ?? []).map((opt) => ({
                        value: opt,
                        label: opt,
                      })),
                      data.backgroundChoices?.backgroundToolPick
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
              {data.backgroundChoices?.backgroundToolPick === "artisan's tools" ? (
                <EquipmentSubPicker
                  filter={{ kind: "subcategory", subcategory: "artisans_tools" }}
                  value={data.backgroundChoices?.backgroundArtisanTool || null}
                  onSelect={(tool) =>
                    onApply({
                      backgroundChoices: {
                        ...(data.backgroundChoices ?? {}),
                        backgroundArtisanTool: tool,
                      },
                    })
                  }
                />
              ) : null}
              {data.backgroundChoices?.backgroundToolPick === "gaming set" ? (
                <EquipmentSubPicker
                  filter={{ kind: "subcategory", subcategory: "gaming_set" }}
                  value={data.backgroundChoices?.backgroundGamingSet || null}
                  onSelect={(tool) =>
                    onApply({
                      backgroundChoices: {
                        ...(data.backgroundChoices ?? {}),
                        backgroundGamingSet: tool,
                      },
                    })
                  }
                />
              ) : null}
              {data.backgroundChoices?.backgroundToolPick === "musical instrument" ? (
                <EquipmentSubPicker
                  filter={{ kind: "subcategory", subcategory: "musical_instrument" }}
                  value={data.backgroundChoices?.backgroundMusicalInstrument || null}
                  onSelect={(tool) =>
                    onApply({
                      backgroundChoices: {
                        ...(data.backgroundChoices ?? {}),
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
                const selected = data.backgroundChoices?.backgroundToolMulti ?? [];
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

          {editor.kind === "cantrip" ? (
            <Select
              value={data.speciesChoices?.speciesCantripId || undefined}
              onValueChange={(value) => applyStorage(value ?? "")}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select cantrip">
                  {data.speciesChoices?.speciesCantripId
                    ? getSpell(data.speciesChoices.speciesCantripId)?.name ??
                      data.speciesChoices.speciesCantripId
                    : ""}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {cantripOptions.map((spell) => (
                  <SelectItem key={spell.id} value={spell.id}>
                    {spell.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {editable && editor.kind === "magic-initiate" && magicClass ? (
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
