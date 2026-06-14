"use client";

import { useEffect, useMemo, useState } from "react";
import type { AbilityKey, SkillKey } from "@/lib/schemas/character";
import {
  ABILITY_LABELS,
  SKILL_LABELS,
  abilityModifier,
  formatModifier,
} from "@/lib/dnd/calculations";
import { ABILITY_KEYS, isValidPointBuy } from "@/lib/dnd/phb/point-buy";
import {
  buildCharacterExport,
  computeRacialBonuses,
  getClassSkillExclusions,
  resolveBackgroundEquipment,
  resolveBackgroundToolProficiencies,
  validateCreatorState,
} from "@/lib/dnd/character-builder/build-character";
import { choicePlaceholder, buildChoiceDescription } from "@/lib/character/feature-choices";
import { TWO_HUMANOID_SPECIES_OPTION, formatFavoredEnemyDisplay } from "@/lib/dnd/phb/favored-enemy-humanoids";
import {
  ALIGNMENTS,
  CREATOR_STEPS,
  createInitialCreatorState,
  getVisibleSteps,
  type CharacterCreatorState,
  type CreatorStep,
} from "@/lib/dnd/character-builder/types";
import {
  classRequiresSubclassAtLevel1,
  FAVORED_ENEMIES,
  FAVORED_TERRAINS,
  FIGHTING_STYLES,
} from "@/lib/dnd/phb/classes";
import { getSpeciesGrantLines } from "@/lib/dnd/phb/species-grants";
import type { CreatorCatalog } from "@/lib/content/catalog";
import { characterExportSchema } from "@/lib/schemas/character";
import { AbilityScorePanel } from "./ability-score-panel";
import { CatalogItemPicker } from "./catalog-item-picker";
import {
  EquipmentSubPicker,
  getEquipmentPlaceholderFilter,
} from "./equipment-sub-picker";
import { IntroContent } from "./creator-intro-modal";
import { LanguagePicker } from "./language-picker";
import { HumanoidSpeciesPicker } from "./humanoid-species-picker";
import { SkillPicker } from "./skill-picker";
import { weaponChoicesToFilter } from "@/lib/items/catalog-picker-filter";
import { Tooltip } from "@/components/ui/tooltip";
import {
  buildLanguageLookup,
  resolveLanguageSlug,
} from "@/lib/languages/resolve";

interface CharacterCreatorProps {
  campaignId: string;
  catalog: CreatorCatalog;
}

function toggleInList<T>(list: T[], item: T, max?: number): T[] {
  if (list.includes(item)) return list.filter((x) => x !== item);
  if (max !== undefined && list.length >= max) return list;
  return [...list, item];
}

export function CharacterCreator({ campaignId, catalog }: CharacterCreatorProps) {
  const [state, setState] = useState<CharacterCreatorState>(createInitialCreatorState);
  // Guard against states initialized before equipmentSubChoices was added
  const subChoices: Record<string, string> = state.equipmentSubChoices ?? {};
  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [visitedSteps, setVisitedSteps] = useState<Set<CreatorStep>>(
    () => new Set<CreatorStep>(["identity"])
  );
  const [blurbOpen, setBlurbOpen] = useState(false);

  const visibleSteps = useMemo(() => getVisibleSteps(state), [state]);
  const currentStep = visibleSteps[stepIndex] ?? "identity";

  const selectedSpecies = catalog.species.find((r) => r.id === state.speciesId);
  const selectedBackground = catalog.backgrounds.find((b) => b.id === state.backgroundId);
  const selectedClass = catalog.classes.find((c) => c.id === state.classId);

  const speciesGrantLines = useMemo(() => {
    if (!selectedSpecies) return [];
    return getSpeciesGrantLines(selectedSpecies, {
      subspeciesId: state.subspeciesId,
      halfElfAbilityBonuses: state.halfElfAbilityBonuses,
      speciesSkillChoices: state.speciesSkillChoices,
      speciesWeaponChoices: state.speciesWeaponChoices,
      speciesToolChoice: state.speciesToolChoice,
      speciesSkillOrTool: state.speciesSkillOrTool,
      variantHumanAbilityBonuses: state.variantHumanAbilityBonuses,
      variantHumanSkill: state.variantHumanSkill,
      variantHumanFeat: state.variantHumanFeat,
      speciesLanguageChoices: state.speciesLanguageChoices,
    });
  }, [selectedSpecies, state]);

  const racialPreview = useMemo(() => {
    const bonuses = computeRacialBonuses(state, catalog);
    return Object.fromEntries(
      ABILITY_KEYS.map((key) => [
        key,
        {
          base: state.baseScores[key],
          racial: bonuses[key].total,
          other: 0,
          sources: bonuses[key].sources,
        },
      ])
    ) as Record<
      AbilityKey,
      { base: number; racial: number; other: number; sources: { label: string; value: number }[] }
    >;
  }, [state, catalog]);

  function update(partial: Partial<CharacterCreatorState>) {
    setState((prev) => ({ ...prev, ...partial }));
    setStepError(null);
  }

  function validateStep(step: CreatorStep): string | null {
    switch (step) {
      case "identity":
        if (!state.name.trim()) return "Enter a character name.";
        if (!state.alignment) return "Choose an alignment.";
        return null;
      case "origin": {
        if (!state.speciesId) return "Choose a species.";
        if (selectedSpecies?.subspecies?.length && !state.subspeciesId) return "Choose a subspecies.";
        if (!state.backgroundId) return "Choose a background.";
        if (state.speciesId === "half-elf" && state.halfElfAbilityBonuses.length !== 2) {
          return "Half-Elf: pick two ability scores for +1 (not Charisma).";
        }
        if (selectedSpecies?.skillChoices && !selectedSpecies.skillOrToolChoice) {
          const { count } = selectedSpecies.skillChoices;
          if (state.speciesSkillChoices.length !== count) {
            return `${selectedSpecies.name}: pick ${count} skill proficiency${count === 1 ? "" : "ies"}.`;
          }
        }
        if (selectedSpecies?.skillOrToolChoice) {
          if (!state.speciesSkillOrTool) {
            return `${selectedSpecies.name}: choose a skill or a tool.`;
          }
          if (state.speciesSkillOrTool === "skill" && state.speciesSkillChoices.length !== 1) {
            return `${selectedSpecies.name}: pick one skill.`;
          }
          if (state.speciesSkillOrTool === "tool" && !state.speciesToolChoice) {
            return `${selectedSpecies.name}: pick one tool.`;
          }
        }
        if (selectedSpecies?.weaponChoices) {
          const { count } = selectedSpecies.weaponChoices;
          if (state.speciesWeaponChoices.length !== count) {
            return `${selectedSpecies.name}: pick ${count} martial weapon${count === 1 ? "" : "s"}.`;
          }
        }
        if (state.speciesId === "human" && state.subspeciesId === "variant") {
          if (state.variantHumanAbilityBonuses.length !== 2) return "Variant Human: pick two +1 abilities.";
          if (!state.variantHumanSkill) return "Variant Human: pick a skill.";
          if (!state.variantHumanFeat) return "Variant Human: pick a feat.";
        }
        const speciesLangCount =
          (selectedSpecies?.languageChoices ?? 0) +
          (state.speciesId === "elf" && state.subspeciesId === "high" ? 1 : 0);
        if (state.speciesLanguageChoices.length < speciesLangCount) {
          return `Choose ${speciesLangCount} ${speciesLangCount === 1 ? "language" : "languages"} from your species.`;
        }
        const bgLangCount = selectedBackground?.languageChoices ?? 0;
        if (state.backgroundLanguageChoices.length < bgLangCount) {
          return `Choose ${bgLangCount} ${bgLangCount === 1 ? "language" : "languages"} from your background.`;
        }
        if (selectedBackground?.skillChoices) {
          const { count } = selectedBackground.skillChoices;
          if (state.backgroundSkillChoices.length !== count) {
            return `${selectedBackground.name}: pick ${count} background skill${count === 1 ? "" : "s"}.`;
          }
        }
        if (selectedBackground?.toolPick && !state.backgroundToolPick) {
          return `${selectedBackground.name}: pick a tool type.`;
        }
        if (selectedBackground?.toolMultiPick) {
          const { count } = selectedBackground.toolMultiPick;
          if (state.backgroundToolMulti.length !== count) {
            return `${selectedBackground.name}: pick ${count} tools.`;
          }
        }
        const needsGaming =
          selectedBackground?.toolProficiencies?.includes("gaming set") ||
          (selectedBackground?.toolPick?.options.includes("gaming set") &&
            state.backgroundToolPick === "gaming set") ||
          state.backgroundToolMulti.includes("gaming set");
        const needsArtisan =
          selectedBackground?.toolProficiencies?.includes("artisan's tools") ||
          (selectedBackground?.toolPick?.options.includes("artisan's tools") &&
            state.backgroundToolPick === "artisan's tools");
        const needsInstrument =
          selectedBackground?.toolProficiencies?.includes("musical instrument") ||
          (selectedBackground?.toolPick?.options.includes("musical instrument") &&
            state.backgroundToolPick === "musical instrument") ||
          state.backgroundToolMulti.includes("musical instrument");
        if (needsArtisan && !state.backgroundArtisanTool) {
          return "Choose an artisan's tool from your background.";
        }
        if (needsGaming && !state.backgroundGamingSet) {
          return "Choose a gaming set from your background.";
        }
        if (needsInstrument && !state.backgroundMusicalInstrument) {
          return "Choose a musical instrument from your background.";
        }
        if (
          selectedBackground?.toolProficiencies?.includes(
            "cartographer's tools or navigator's tools"
          ) &&
          !state.backgroundExplorerTool
        ) {
          return "Choose cartographer's or navigator's tools for Archaeologist.";
        }
        return null;
      }
      case "class": {
        if (!state.classId) return "Choose a class.";
        if (classRequiresSubclassAtLevel1(state.classId) && !state.subclassId) {
          return "This class requires a subclass at 1st level.";
        }
        if (state.classId === "fighter" && !state.fightingStyle) return "Choose a fighting style.";
        if (state.classId === "ranger") {
          if (!state.favoredEnemy) return "Choose a favored enemy.";
          if (
            state.favoredEnemy === TWO_HUMANOID_SPECIES_OPTION &&
            state.favoredHumanoidSpecies.length !== 2
          ) {
            return "Choose two humanoid species for favored enemy.";
          }
          if (!state.favoredTerrain) return "Choose a favored terrain.";
        }
        if (state.classId === "monk" && !state.monkTool) return "Choose a monk tool proficiency.";
        return null;
      }
      case "abilities":
        if (isValidPointBuy(state.baseScores)) return null;
        return "Spend exactly 27 point-buy points (scores 8–15 before racial bonuses).";
      case "skills":
        if (selectedClass && state.classSkills.length !== selectedClass.skillChoiceCount) {
          return `Choose ${selectedClass.skillChoiceCount} class skill(s).`;
        }
        return null;
      case "spells": {
        const sc = selectedClass?.spellcasting;
        if (!sc) return null;
        if (state.cantripIds.length !== sc.cantripsKnown) {
          return `Choose ${sc.cantripsKnown} cantrip(s).`;
        }
        if (sc.spellsKnown && state.spellIds.length !== sc.spellsKnown) {
          return `Choose ${sc.spellsKnown} 1st-level spell(s).`;
        }
        if (sc.spellbookAtLevel1 && state.wizardSpellbookIds.length !== sc.spellbookAtLevel1) {
          return `Add ${sc.spellbookAtLevel1} spells to your spellbook.`;
        }
        if (sc.preparedCaster && !sc.spellbookAtLevel1) {
          const mod = Math.floor(
            (state.baseScores[sc.ability] +
              (racialPreview[sc.ability]?.racial ?? 0) -
              10) /
              2
          );
          const required = Math.max(1, mod + 1);
          if (state.spellIds.length !== required) {
            return `Prepare ${required} 1st-level spell(s).`;
          }
        }
        if (sc.spellbookAtLevel1) {
          const mod = Math.floor(
            (state.baseScores.int + (racialPreview.int?.racial ?? 0) - 10) / 2
          );
          const required = Math.max(1, mod + 1);
          if (state.spellIds.length !== required) {
            return `Prepare ${required} spell(s) from your spellbook.`;
          }
        }
        return null;
      }
      case "equipment":
        if (selectedClass) {
          for (let i = 0; i < selectedClass.equipmentChoices.length; i++) {
            if (state.equipmentChoiceIndices[i] === undefined) {
              return "Make all equipment choices.";
            }
            const optIdx = state.equipmentChoiceIndices[i]!;
            const option = selectedClass.equipmentChoices[i].options[optIdx];
            if (option) {
              for (let j = 0; j < option.items.length; j++) {
                if (getEquipmentPlaceholderFilter(option.items[j]) &&
                    !subChoices[`c${i}_${j}`]) {
                  return "Select a specific item for every open-ended choice.";
                }
              }
            }
          }
          for (let i = 0; i < selectedClass.fixedEquipment.length; i++) {
            if (getEquipmentPlaceholderFilter(selectedClass.fixedEquipment[i]) &&
                !subChoices[`f${i}`]) {
              return "Select a specific item for every open-ended choice.";
            }
          }
        }
        return null;
      default:
        return null;
    }
  }

  function nextStep() {
    const err = validateStep(currentStep);
    if (err) {
      setStepError(err);
      return;
    }
    const nextIdx = Math.min(stepIndex + 1, visibleSteps.length - 1);
    const nextId = visibleSteps[nextIdx];
    setStepIndex(nextIdx);
    setVisitedSteps((prev) => {
      if (prev.has(nextId)) return prev;
      const next = new Set(prev);
      next.add(nextId);
      return next;
    });
  }

  function prevStep() {
    setStepError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function downloadJson() {
    const errors = validateCreatorState(state, catalog);
    if (errors.length) {
      setStepError(errors[0] ?? "Fix validation errors before exporting.");
      return;
    }
    const payload = characterExportSchema.parse(buildCharacterExport(state, catalog));
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.name || "character"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const grantedSkills = useMemo(() => {
    const skills = getClassSkillExclusions(state, catalog);
    return skills.map((s) => SKILL_LABELS[s]);
  }, [state, catalog]);

  const speciesSkillExclusions = useMemo(
    () => selectedSpecies?.skillProficiencies ?? [],
    [selectedSpecies]
  );

  const backgroundSkillExclusions = useMemo(() => {
    const excluded = new Set<SkillKey>([
      ...(selectedSpecies?.skillProficiencies ?? []),
      ...state.speciesSkillChoices,
    ]);
    if (
      state.speciesId === "human" &&
      state.subspeciesId === "variant" &&
      state.variantHumanSkill
    ) {
      excluded.add(state.variantHumanSkill);
    }
    selectedBackground?.skillProficiencies.forEach((s) => excluded.add(s));
    return [...excluded];
  }, [selectedSpecies, selectedBackground, state]);

  const speciesLanguageChoiceCount = useMemo(
    () =>
      (selectedSpecies?.languageChoices ?? 0) +
      (state.speciesId === "elf" && state.subspeciesId === "high" ? 1 : 0),
    [selectedSpecies, state.speciesId, state.subspeciesId]
  );

  const backgroundLanguageChoiceCount =
    selectedBackground?.languageChoices ?? 0;

  const resolvedBackgroundTools = useMemo(
    () => resolveBackgroundToolProficiencies(state, catalog),
    [state, catalog]
  );

  const resolvedBackgroundEquipment = useMemo(
    () => resolveBackgroundEquipment(state, catalog),
    [state, catalog]
  );

  const classSkillExclusions = useMemo(
    () => getClassSkillExclusions(state, catalog),
    [state, catalog]
  );

  const automaticLanguages = useMemo(() => {
    return [
      ...(selectedSpecies?.languages ?? []),
      ...(selectedSpecies?.fixedLanguages ?? []),
      ...(selectedBackground?.fixedLanguages ?? []),
    ];
  }, [selectedSpecies, selectedBackground]);

  const languageLookup = useMemo(
    () => buildLanguageLookup(catalog.languages),
    [catalog.languages]
  );

  const automaticLanguageSlugs = useMemo(
    () => automaticLanguages.map((l) => resolveLanguageSlug(l, languageLookup)),
    [automaticLanguages, languageLookup]
  );

  const speciesLanguageDisabled = useMemo(() => {
    return [
      ...new Set([
        ...automaticLanguageSlugs,
        ...state.backgroundLanguageChoices.map((l) =>
          resolveLanguageSlug(l, languageLookup)
        ),
      ]),
    ];
  }, [
    automaticLanguageSlugs,
    state.backgroundLanguageChoices,
    languageLookup,
  ]);

  const backgroundLanguageDisabled = useMemo(() => {
    return [
      ...new Set([
        ...automaticLanguageSlugs,
        ...state.speciesLanguageChoices.map((l) =>
          resolveLanguageSlug(l, languageLookup)
        ),
      ]),
    ];
  }, [automaticLanguageSlugs, state.speciesLanguageChoices, languageLookup]);

  useEffect(() => {
    setState((prev) => {
      const species = catalog.species.find((r) => r.id === prev.speciesId);
      const bg = catalog.backgrounds.find((b) => b.id === prev.backgroundId);
      const lookup = buildLanguageLookup(catalog.languages);
      const auto = [
        ...(species?.languages ?? []),
        ...(species?.fixedLanguages ?? []),
        ...(bg?.fixedLanguages ?? []),
      ];
      const autoSlugs = new Set(auto.map((l) => resolveLanguageSlug(l, lookup)));
      const bgDisabled = new Set([
        ...autoSlugs,
        ...prev.speciesLanguageChoices.map((l) => resolveLanguageSlug(l, lookup)),
      ]);
      const prunedBg = prev.backgroundLanguageChoices.filter(
        (l) => !bgDisabled.has(resolveLanguageSlug(l, lookup))
      );
      const speciesDisabled = new Set([
        ...autoSlugs,
        ...prunedBg.map((l) => resolveLanguageSlug(l, lookup)),
      ]);
      const prunedSpecies = prev.speciesLanguageChoices.filter(
        (l) => !speciesDisabled.has(resolveLanguageSlug(l, lookup))
      );
      if (
        prunedBg.length === prev.backgroundLanguageChoices.length &&
        prunedSpecies.length === prev.speciesLanguageChoices.length
      ) {
        return prev;
      }
      return {
        ...prev,
        speciesLanguageChoices: prunedSpecies,
        backgroundLanguageChoices: prunedBg,
      };
    });
  }, [state.speciesId, state.subspeciesId, state.backgroundId, catalog]);

  useEffect(() => {
    if (currentStep !== "skills") return;
    setState((prev) => {
      const excluded = getClassSkillExclusions(prev, catalog);
      const pruned = prev.classSkills.filter((s) => !excluded.includes(s));
      if (pruned.length === prev.classSkills.length) return prev;
      return { ...prev, classSkills: pruned };
    });
  }, [currentStep, classSkillExclusions]);

  return (
    <div className="creator-wrap">
      <nav className="creator-steps">
        {visibleSteps.map((step, i) => {
          const visited = visitedSteps.has(step);
          const label = CREATOR_STEPS.find((s) => s.id === step)?.label ?? step;
          return (
            <button
              key={step}
              type="button"
              className={`candy-btn candy-btn-sm${i === stepIndex ? " candy-btn-active" : ""}`}
              disabled={!visited}
              onClick={() => {
                if (visited) {
                  setStepIndex(i);
                  setStepError(null);
                }
              }}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {stepError ? <p className="creator-error">{stepError}</p> : null}

      {currentStep === "identity" ? (
        <section className="retro-box creator-section">
          <h3 className="retro-box-title">Identity</h3>
          <label className="candy-label" htmlFor="char-name">Character name</label>
          <input
            id="char-name"
            className="candy-input"
            value={state.name}
            onChange={(e) => update({ name: e.target.value })}
          />
          <label className="candy-label" htmlFor="player-name">Player name</label>
          <input
            id="player-name"
            className="candy-input"
            value={state.playerName}
            onChange={(e) => update({ playerName: e.target.value })}
          />
          <label className="candy-label" htmlFor="alignment">Alignment</label>
          <select
            id="alignment"
            className="candy-input"
            value={state.alignment}
            onChange={(e) => update({ alignment: e.target.value })}
          >
            <option value="">— choose —</option>
            {ALIGNMENTS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </section>
      ) : null}

      {currentStep === "origin" ? (
        <section className="retro-box creator-section">
          <h3 className="retro-box-title">Species &amp; Background</h3>
          <div className="creator-two-col">
            <div>
              <label className="candy-label">Species</label>
              <select
                className="candy-input"
                value={state.speciesId}
                onChange={(e) =>
                  update({
                    speciesId: e.target.value,
                    subspeciesId: "",
                    halfElfAbilityBonuses: [],
                    speciesSkillChoices: [],
                    speciesWeaponChoices: [],
                    speciesToolChoice: "",
                    speciesSkillOrTool: "",
                    variantHumanAbilityBonuses: [],
                    variantHumanSkill: "",
                    variantHumanFeat: "",
                    speciesLanguageChoices: [],
                  })
                }
              >
                <option value="">— choose —</option>
                {catalog.species.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>

              {selectedSpecies?.subspecies?.length ? (
                <>
                  <label className="candy-label">Subspecies / variant</label>
                  <select
                    className="candy-input"
                    value={state.subspeciesId}
                    onChange={(e) => update({ subspeciesId: e.target.value })}
                  >
                    <option value="">— choose —</option>
                    {selectedSpecies.subspecies.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </>
              ) : null}

              {selectedSpecies ? (
                <div className="creator-grants">
                  {speciesGrantLines.map((line) => (
                    <p key={line.label} className="retro-muted">
                      {line.label}: {line.value}
                    </p>
                  ))}
                </div>
              ) : null}

              {state.speciesId === "half-elf" ? (
                <>
                  <p className="candy-label">+1 to two abilities (not Charisma)</p>
                  <div className="creator-chip-row">
                    {ABILITY_KEYS.filter((k) => k !== "cha").map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={`candy-btn candy-btn-sm${state.halfElfAbilityBonuses.includes(key) ? " candy-btn-active" : ""}`}
                        onClick={() =>
                          update({
                            halfElfAbilityBonuses: toggleInList(
                              state.halfElfAbilityBonuses,
                              key,
                              2
                            ),
                          })
                        }
                      >
                        {key.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {selectedSpecies?.skillChoices && !selectedSpecies.skillOrToolChoice ? (
                <>
                  <p className="candy-label">
                    {selectedSpecies.skillChoices.prompt ??
                      `${selectedSpecies.skillChoices.count} skill proficiency${selectedSpecies.skillChoices.count === 1 ? "" : "ies"}`}
                  </p>
                  <SkillPicker
                    selected={state.speciesSkillChoices}
                    max={selectedSpecies.skillChoices.count}
                    options={selectedSpecies.skillChoices.options}
                    excluded={speciesSkillExclusions}
                    onChange={(skills) => update({ speciesSkillChoices: skills })}
                  />
                </>
              ) : null}

              {selectedSpecies?.skillOrToolChoice ? (
                <>
                  <p className="candy-label">
                    {selectedSpecies.skillOrToolChoice.prompt ?? "Skill or tool"}
                  </p>
                  <div className="creator-chip-row">
                    <button
                      type="button"
                      className={`candy-btn candy-btn-sm${state.speciesSkillOrTool === "skill" ? " candy-btn-active" : ""}`}
                      onClick={() =>
                        update({ speciesSkillOrTool: "skill", speciesToolChoice: "" })
                      }
                    >
                      Skill
                    </button>
                    <button
                      type="button"
                      className={`candy-btn candy-btn-sm${state.speciesSkillOrTool === "tool" ? " candy-btn-active" : ""}`}
                      onClick={() =>
                        update({ speciesSkillOrTool: "tool", speciesSkillChoices: [] })
                      }
                    >
                      Tool
                    </button>
                  </div>
                  {state.speciesSkillOrTool === "skill" ? (
                    <SkillPicker
                      selected={state.speciesSkillChoices}
                      max={1}
                      excluded={speciesSkillExclusions}
                      onChange={(skills) => update({ speciesSkillChoices: skills })}
                    />
                  ) : null}
                  {state.speciesSkillOrTool === "tool" ? (
                    <EquipmentSubPicker
                      filter={{ kind: "creator_tools" }}
                      value={state.speciesToolChoice || null}
                      onSelect={(tool) => update({ speciesToolChoice: tool })}
                    />
                  ) : null}
                </>
              ) : null}

              {selectedSpecies?.weaponChoices ? (
                <>
                  <CatalogItemPicker
                    filter={weaponChoicesToFilter(selectedSpecies.weaponChoices)}
                    selected={state.speciesWeaponChoices}
                    max={selectedSpecies.weaponChoices.count}
                    label={
                      selectedSpecies.weaponChoices.prompt ??
                      `${selectedSpecies.weaponChoices.count} weapons`
                    }
                    placeholder="Search weapons…"
                    onChange={(names) => update({ speciesWeaponChoices: names })}
                  />
                </>
              ) : null}

              {state.speciesId === "human" && state.subspeciesId === "variant" ? (
                <>
                  <p className="candy-label">+1 to two abilities</p>
                  <div className="creator-chip-row">
                    {ABILITY_KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={`candy-btn candy-btn-sm${state.variantHumanAbilityBonuses.includes(key) ? " candy-btn-active" : ""}`}
                        onClick={() =>
                          update({
                            variantHumanAbilityBonuses: toggleInList(
                              state.variantHumanAbilityBonuses,
                              key,
                              2
                            ),
                          })
                        }
                      >
                        {key.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <p className="candy-label">Skill proficiency</p>
                  <SkillPicker
                    selected={state.variantHumanSkill ? [state.variantHumanSkill] : []}
                    max={1}
                    excluded={speciesSkillExclusions}
                    onChange={(skills) =>
                      update({ variantHumanSkill: skills[0] ?? "" })
                    }
                  />
                  <label className="candy-label">Feat</label>
                  <select
                    className="candy-input"
                    value={state.variantHumanFeat}
                    onChange={(e) => update({ variantHumanFeat: e.target.value })}
                  >
                    <option value="">— choose —</option>
                    {catalog.feats.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </>
              ) : null}

              {(selectedSpecies?.languageChoices ?? 0) > 0 ||
              (state.speciesId === "elf" && state.subspeciesId === "high") ? (
                <>
                  <p className="candy-label">
                    Bonus {speciesLanguageChoiceCount === 1 ? "language" : "languages"}
                  </p>
                  <LanguagePicker
                    selected={state.speciesLanguageChoices}
                    max={speciesLanguageChoiceCount}
                    disabled={speciesLanguageDisabled}
                    catalog={catalog.languages}
                    onChange={(langs) => {
                      const bgDisabled = new Set([
                        ...automaticLanguageSlugs,
                        ...langs.map((l) => resolveLanguageSlug(l, languageLookup)),
                      ]);
                      const prunedBg = state.backgroundLanguageChoices.filter(
                        (l) => !bgDisabled.has(resolveLanguageSlug(l, languageLookup))
                      );
                      update({
                        speciesLanguageChoices: langs,
                        ...(prunedBg.length !== state.backgroundLanguageChoices.length
                          ? { backgroundLanguageChoices: prunedBg }
                          : {}),
                      });
                    }}
                  />
                </>
              ) : null}
            </div>

            <div>
              <label className="candy-label">Background</label>
              <select
                className="candy-input"
                value={state.backgroundId}
                onChange={(e) =>
                  update({
                    backgroundId: e.target.value,
                    backgroundLanguageChoices: [],
                    backgroundArtisanTool: "",
                    backgroundGamingSet: "",
                    backgroundMusicalInstrument: "",
                    backgroundExplorerTool: "",
                    backgroundSkillChoices: [],
                    backgroundToolPick: "",
                    backgroundToolMulti: [],
                  })
                }
              >
                <option value="">— choose —</option>
                {catalog.backgrounds.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              {selectedBackground ? (
                <div className="creator-grants">
                  <p className="retro-muted">
                    Skills:{" "}
                    {[
                      ...selectedBackground.skillProficiencies.map((s) => SKILL_LABELS[s]),
                      ...state.backgroundSkillChoices.map((s) => SKILL_LABELS[s]),
                    ].join(", ") || "—"}
                  </p>
                  {(selectedBackground.toolProficiencies?.length ||
                    selectedBackground.toolPick ||
                    selectedBackground.toolMultiPick) ? (
                    <p className="retro-muted">
                      Tools: {resolvedBackgroundTools.join(", ") || "—"}
                    </p>
                  ) : null}
                  <p className="retro-muted">Starting gold: {selectedBackground.gold} gp</p>
                  <p className="retro-muted">Feature: {selectedBackground.feature.name}</p>
                </div>
              ) : null}

              {selectedBackground?.skillChoices ? (
                <>
                  <p className="candy-label">
                    {selectedBackground.skillChoices.prompt ??
                      `${selectedBackground.skillChoices.count} background skill(s)`}
                  </p>
                  <SkillPicker
                    selected={state.backgroundSkillChoices}
                    max={selectedBackground.skillChoices.count}
                    options={selectedBackground.skillChoices.options}
                    excluded={backgroundSkillExclusions}
                    onChange={(skills) => update({ backgroundSkillChoices: skills })}
                  />
                </>
              ) : null}

              {selectedBackground?.toolPick ? (
                <>
                  <p className="candy-label">
                    {selectedBackground.toolPick.prompt ?? "Tool proficiency"}
                  </p>
                  <div className="creator-chip-row">
                    {selectedBackground.toolPick.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`candy-btn candy-btn-sm${state.backgroundToolPick === option ? " candy-btn-active" : ""}`}
                        onClick={() =>
                          update({
                            backgroundToolPick: option,
                            backgroundArtisanTool:
                              option === "artisan's tools" ? state.backgroundArtisanTool : "",
                            backgroundGamingSet:
                              option === "gaming set" ? state.backgroundGamingSet : "",
                            backgroundMusicalInstrument:
                              option === "musical instrument"
                                ? state.backgroundMusicalInstrument
                                : "",
                          })
                        }
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {selectedBackground?.toolMultiPick ? (
                <>
                  <p className="candy-label">
                    {selectedBackground.toolMultiPick.prompt ??
                      `Choose ${selectedBackground.toolMultiPick.count} tools`}
                  </p>
                  <div className="creator-chip-row">
                    {selectedBackground.toolMultiPick.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`candy-btn candy-btn-sm${state.backgroundToolMulti.includes(option) ? " candy-btn-active" : ""}`}
                        onClick={() =>
                          update({
                            backgroundToolMulti: toggleInList(
                              state.backgroundToolMulti,
                              option,
                              selectedBackground.toolMultiPick!.count
                            ),
                          })
                        }
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {(selectedBackground?.languageChoices ?? 0) > 0 ? (
                <>
                  <p className="candy-label">
                    Background{" "}
                    {backgroundLanguageChoiceCount === 1 ? "language" : "languages"}
                  </p>
                  <LanguagePicker
                    selected={state.backgroundLanguageChoices}
                    max={backgroundLanguageChoiceCount}
                    disabled={backgroundLanguageDisabled}
                    standardOnly
                    catalog={catalog.languages}
                    onChange={(langs) => update({ backgroundLanguageChoices: langs })}
                  />
                </>
              ) : null}

              {(selectedBackground?.toolProficiencies?.includes("artisan's tools") ||
                (selectedBackground?.toolPick?.options.includes("artisan's tools") &&
                  state.backgroundToolPick === "artisan's tools")) ? (
                <EquipmentSubPicker
                  filter={{ kind: "subcategory", subcategory: "artisans_tools" }}
                  value={state.backgroundArtisanTool || null}
                  onSelect={(tool) => update({ backgroundArtisanTool: tool })}
                />
              ) : null}

              {(selectedBackground?.toolProficiencies?.includes("gaming set") ||
                (selectedBackground?.toolPick?.options.includes("gaming set") &&
                  state.backgroundToolPick === "gaming set") ||
                state.backgroundToolMulti.includes("gaming set")) ? (
                <EquipmentSubPicker
                  filter={{ kind: "subcategory", subcategory: "gaming_set" }}
                  value={state.backgroundGamingSet || null}
                  onSelect={(tool) => update({ backgroundGamingSet: tool })}
                />
              ) : null}

              {(selectedBackground?.toolProficiencies?.includes("musical instrument") ||
                (selectedBackground?.toolPick?.options.includes("musical instrument") &&
                  state.backgroundToolPick === "musical instrument") ||
                state.backgroundToolMulti.includes("musical instrument")) ? (
                <EquipmentSubPicker
                  filter={{ kind: "subcategory", subcategory: "musical_instrument" }}
                  value={state.backgroundMusicalInstrument || null}
                  onSelect={(tool) => update({ backgroundMusicalInstrument: tool })}
                />
              ) : null}

              {selectedBackground?.toolProficiencies?.includes(
                "cartographer's tools or navigator's tools"
              ) ? (
                <EquipmentSubPicker
                  filter={{ kind: "subcategory", subcategory: "explorer_tools" }}
                  value={state.backgroundExplorerTool || null}
                  onSelect={(tool) => update({ backgroundExplorerTool: tool })}
                />
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {currentStep === "class" ? (
        <section className="retro-box creator-section">
          <h3 className="retro-box-title">Class</h3>
          <select
            className="candy-input"
            value={state.classId}
            onChange={(e) =>
              update({
                classId: e.target.value,
                subclassId: "",
                classSkills: [],
                cantripIds: [],
                spellIds: [],
                wizardSpellbookIds: [],
                equipmentChoiceIndices: [],
                equipmentSubChoices: {},
                fightingStyle: "",
                favoredEnemy: "",
                favoredHumanoidSpecies: [],
                favoredTerrain: "",
              })
            }
          >
            <option value="">— choose —</option>
            {catalog.classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {selectedClass ? (
            <>
              <p className="retro-muted">
                Hit die d{selectedClass.hitDie} · Choose {selectedClass.skillChoiceCount} skills · Saves:{" "}
                {selectedClass.savingThrows.map((s) => s.toUpperCase()).join(", ")}
              </p>

              {(classRequiresSubclassAtLevel1(state.classId) ||
                selectedClass.subclassLevel === 1) &&
              selectedClass.subclasses.length ? (
                <>
                  <label className="candy-label">
                    Subclass{classRequiresSubclassAtLevel1(state.classId) ? " (required)" : ""}
                  </label>
                  <select
                    className="candy-input"
                    value={state.subclassId}
                    onChange={(e) => update({ subclassId: e.target.value })}
                  >
                    <option value="">— choose —</option>
                    {selectedClass.subclasses.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </>
              ) : null}

              {state.classId === "fighter" ? (
                <>
                  <label className="candy-label">Fighting style</label>
                  <select
                    className="candy-input"
                    value={state.fightingStyle}
                    onChange={(e) => update({ fightingStyle: e.target.value })}
                  >
                    <option value="">— choose —</option>
                    {FIGHTING_STYLES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </>
              ) : null}

              {state.classId === "ranger" ? (
                <>
                  {(() => {
                    const enemyRules =
                      selectedClass.features.find((f) => f.name === "Favored Enemy")
                        ?.description ??
                      "Advantage on Survival checks to track and Intelligence to recall info about chosen enemy type.";
                    const terrainRules =
                      selectedClass.features.find((f) => f.name === "Natural Explorer")
                        ?.description ?? "";
                    return (
                      <>
                        <label className="candy-label">Favored enemy</label>
                        <select
                          className="candy-input"
                          value={state.favoredEnemy}
                          onChange={(e) => {
                            const favoredEnemy = e.target.value;
                            update({
                              favoredEnemy,
                              favoredHumanoidSpecies:
                                favoredEnemy === TWO_HUMANOID_SPECIES_OPTION
                                  ? state.favoredHumanoidSpecies
                                  : [],
                            });
                          }}
                        >
                          <option value="">{choicePlaceholder("favoredEnemy")}</option>
                          {FAVORED_ENEMIES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        {state.favoredEnemy === TWO_HUMANOID_SPECIES_OPTION ? (
                          <>
                            <label className="candy-label">Humanoid species (pick 2)</label>
                            <HumanoidSpeciesPicker
                              selected={state.favoredHumanoidSpecies}
                              onChange={(ids) => update({ favoredHumanoidSpecies: ids })}
                              variant="creator"
                            />
                          </>
                        ) : null}
                        <p className="retro-muted text-sm whitespace-pre-wrap">
                          {buildChoiceDescription(
                            enemyRules,
                            state.favoredEnemy
                              ? formatFavoredEnemyDisplay(
                                  state.favoredEnemy,
                                  state.favoredHumanoidSpecies
                                )
                              : null
                          )}
                        </p>
                        <label className="candy-label">Favored terrain</label>
                        <select
                          className="candy-input"
                          value={state.favoredTerrain}
                          onChange={(e) => update({ favoredTerrain: e.target.value })}
                        >
                          <option value="">{choicePlaceholder("favoredTerrain")}</option>
                          {FAVORED_TERRAINS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <p className="retro-muted text-sm whitespace-pre-wrap">
                          {buildChoiceDescription(
                            terrainRules,
                            state.favoredTerrain || null
                          )}
                        </p>
                      </>
                    );
                  })()}
                </>
              ) : null}

              {state.classId === "monk" ? (
                <EquipmentSubPicker
                  filter={{
                    kind: "subcategory",
                    subcategory: ["artisans_tools", "musical_instrument"],
                  }}
                  value={state.monkTool || null}
                  onSelect={(tool) => update({ monkTool: tool })}
                />
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {currentStep === "abilities" ? (
        <section className="retro-box creator-section">
          <h3 className="retro-box-title">Ability Scores (Point Buy)</h3>
          <p className="retro-muted">Scores shown include racial bonuses.</p>
          <AbilityScorePanel
            baseScores={state.baseScores}
            racialPreview={racialPreview}
            onChange={(key, value) =>
              update({ baseScores: { ...state.baseScores, [key]: value } })
            }
          />
        </section>
      ) : null}

      {currentStep === "skills" ? (
        <section className="retro-box creator-section">
          <h3 className="retro-box-title">Class Skills</h3>
          {grantedSkills.length ? (
            <p className="retro-note">Already proficient: {grantedSkills.join(", ")}</p>
          ) : null}
          {selectedClass ? (
            <>
              <p className="retro-muted">
                Pick {selectedClass.skillChoiceCount} from your class list.
              </p>
              <SkillPicker
                selected={state.classSkills}
                max={selectedClass.skillChoiceCount}
                options={selectedClass.skillOptions}
                excluded={classSkillExclusions}
                onChange={(skills) => update({ classSkills: skills })}
              />
            </>
          ) : null}
        </section>
      ) : null}

      {currentStep === "spells" && selectedClass?.spellcasting ? (
        <section className="retro-box creator-section">
          <h3 className="retro-box-title">Spells</h3>
          <SpellStep state={state} update={update} classId={state.classId} racialPreview={racialPreview} catalog={catalog} />
        </section>
      ) : null}

      {currentStep === "equipment" ? (
        <section className="retro-box creator-section">
          <h3 className="retro-box-title">Starting Equipment</h3>
          {selectedClass ? (
            <>
              {selectedClass.equipmentChoices.map((choice, groupIdx) => {
                const selectedOptIdx = state.equipmentChoiceIndices[groupIdx] ?? -1;
                const selectedOpt = choice.options[selectedOptIdx] ?? null;
                return (
                  <div key={choice.prompt} className="creator-equip-choice">
                    <p className="candy-label">{choice.prompt}</p>
                    <div className="creator-chip-row">
                      {choice.options.map((opt, optIdx) => (
                        <button
                          key={opt.label}
                          type="button"
                          className={`candy-btn candy-btn-sm${
                            selectedOptIdx === optIdx ? " candy-btn-active" : ""
                          }`}
                          onClick={() => {
                            const next = [...state.equipmentChoiceIndices];
                            next[groupIdx] = optIdx;
                            // Clear sub-choices for this group when option changes
                            const newSub = { ...subChoices };
                            choice.options.forEach((o) =>
                              o.items.forEach((_, ii) => {
                                delete newSub[`c${groupIdx}_${ii}`];
                              })
                            );
                            update({ equipmentChoiceIndices: next, equipmentSubChoices: newSub });
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {selectedOpt?.items.map((itemName, itemIdx) => {
                      const filter = getEquipmentPlaceholderFilter(itemName);
                      if (!filter) return null;
                      const subKey = `c${groupIdx}_${itemIdx}`;
                      return (
                        <EquipmentSubPicker
                          key={subKey}
                          filter={filter}
                          value={subChoices[subKey] ?? null}
                          onSelect={(name) =>
                            update({
                              equipmentSubChoices: {
                                ...subChoices,
                                [subKey]: name,
                              },
                            })
                          }
                        />
                      );
                    })}
                  </div>
                );
              })}

              {selectedClass.fixedEquipment.map((itemName, idx) => {
                const filter = getEquipmentPlaceholderFilter(itemName);
                if (!filter) return null;
                const subKey = `f${idx}`;
                return (
                  <EquipmentSubPicker
                    key={subKey}
                    filter={filter}
                    value={subChoices[subKey] ?? null}
                    onSelect={(name) =>
                      update({
                        equipmentSubChoices: {
                          ...subChoices,
                          [subKey]: name,
                        },
                      })
                    }
                  />
                );
              })}
            </>
          ) : null}

          {selectedBackground ? (
            <p className="retro-muted creator-summary">
              Background adds: {resolvedBackgroundEquipment.join(", ")} and{" "}
              {selectedBackground.gold} gp.
            </p>
          ) : null}
        </section>
      ) : null}

      {currentStep === "review" ? (
        <section className="retro-box creator-section">
          <h3 className="retro-box-title">Review &amp; Download</h3>
          {(() => {
            const errors = validateCreatorState(state, catalog);
            if (errors.length) {
              return (
                <ul className="creator-error-list">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              );
            }
            const preview = buildCharacterExport(state, catalog);
            const d = preview.data;

            const proficientSkills = (Object.entries(d.skills) as [SkillKey, { proficient: boolean }][])
              .filter(([, v]) => v.proficient)
              .map(([k]) => SKILL_LABELS[k])
              .sort();

            const cantrips = d.spells.known.filter((s) => s.level === 0).map((s) => s.name);
            const spellsKnown = d.spells.known.filter((s) => s.level > 0).map((s) => s.name);
            const spellsPrepared = d.spells.prepared.filter((s) => s.level > 0).map((s) => s.name);
            const spellbookSpells = d.spells.known.filter((s) => s.notes?.startsWith("Spellbook")).map((s) => s.name);

            const itemList = d.inventory.items
              .map((i) => (i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name))
              .join(", ");

            const subspeciesName = selectedSpecies?.subspecies?.find(
              (sr) => sr.id === state.subspeciesId
            )?.name;
            const speciesLabel = subspeciesName
              ? `${selectedSpecies?.name} (${subspeciesName})`
              : selectedSpecies?.name ?? "—";

            const subclassName = selectedClass?.subclasses?.find(
              (sc) => sc.id === state.subclassId
            )?.name;

            return (
              <>
                {/* Identity */}
                <div className="creator-review-section">
                  <p className="candy-label" style={{ marginBottom: 4 }}>Identity</p>
                  <div className="creator-review-grid">
                    <span>Name</span><span>{d.basicInfo.name || "—"}</span>
                    <span>Player</span><span>{d.basicInfo.playerName || "—"}</span>
                    <span>Alignment</span><span>{d.basicInfo.alignment || "—"}</span>
                  </div>
                </div>

                {/* Origin */}
                <div className="creator-review-section">
                  <p className="candy-label" style={{ marginBottom: 4 }}>Origin</p>
                  <div className="creator-review-grid">
                    <span>Species</span><span>{speciesLabel}</span>
                    <span>Background</span><span>{selectedBackground?.name ?? "—"}</span>
                  </div>
                </div>

                {/* Class */}
                <div className="creator-review-section">
                  <p className="candy-label" style={{ marginBottom: 4 }}>Class</p>
                  <div className="creator-review-grid">
                    <span>Class</span>
                    <span>{selectedClass?.name ?? "—"}</span>
                    {subclassName ? (
                      <>
                        <span>Subclass</span>
                        <span>{subclassName}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Ability Scores */}
                <div className="creator-review-section">
                  <p className="candy-label" style={{ marginBottom: 4 }}>Ability Scores</p>
                  <div className="creator-review-scores">
                    {ABILITY_KEYS.map((key) => {
                      const score = d.abilityScores[key];
                      const mod = abilityModifier(score);
                      return (
                        <div key={key} className="creator-review-score-cell">
                          <span className="creator-review-score-label">{ABILITY_LABELS[key]}</span>
                          <span className="creator-review-score-value">{score}</span>
                          <span className="creator-review-score-mod">{formatModifier(mod)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Combat */}
                <div className="creator-review-section">
                  <p className="candy-label" style={{ marginBottom: 4 }}>Combat</p>
                  <p className="creator-review-line">
                    HP {d.combat.maxHp}
                    {" · "}AC {d.combat.ac}
                    {" · "}Speed {d.combat.speed} ft
                    {" · "}Initiative {formatModifier(d.combat.initiativeBonus + abilityModifier(d.abilityScores.dex))}
                  </p>
                </div>

                {/* Skills */}
                {proficientSkills.length > 0 && (
                  <div className="creator-review-section">
                    <p className="candy-label" style={{ marginBottom: 4 }}>Skill Proficiencies</p>
                    <p className="creator-review-line">{proficientSkills.join(", ")}</p>
                  </div>
                )}

                {/* Spells */}
                {(cantrips.length > 0 || spellsKnown.length > 0 || spellsPrepared.length > 0 || spellbookSpells.length > 0) && (
                  <div className="creator-review-section">
                    <p className="candy-label" style={{ marginBottom: 4 }}>Spells</p>
                    <div className="creator-review-grid">
                      {cantrips.length > 0 && (
                        <>
                          <span>Cantrips</span>
                          <span>{cantrips.join(", ")}</span>
                        </>
                      )}
                      {spellbookSpells.length > 0 && (
                        <>
                          <span>Spellbook</span>
                          <span>{spellbookSpells.join(", ")}</span>
                        </>
                      )}
                      {spellsPrepared.length > 0 && (
                        <>
                          <span>Prepared</span>
                          <span>{spellsPrepared.join(", ")}</span>
                        </>
                      )}
                      {spellsKnown.filter((s) => !spellsPrepared.includes(s)).length > 0 && (
                        <>
                          <span>Known</span>
                          <span>{spellsKnown.filter((s) => !spellsPrepared.includes(s)).join(", ")}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Equipment */}
                <div className="creator-review-section">
                  <p className="candy-label" style={{ marginBottom: 4 }}>Equipment</p>
                  <p className="creator-review-line">{itemList || "—"}</p>
                  <p className="creator-review-line retro-muted">{d.inventory.currency.gp} gp</p>
                </div>

                <button type="button" className="candy-btn" onClick={downloadJson}>
                  Download character .json
                </button>
                <p className="retro-muted">
                  DM can import this file from the Characters tab.
                </p>
              </>
            );
          })()}
        </section>
      ) : null}

      <div className="creator-nav">
        <button
          type="button"
          className="candy-btn"
          disabled={stepIndex === 0}
          onClick={prevStep}
        >
          ← Back
        </button>
        <button
          type="button"
          className="candy-btn"
          onClick={() => setBlurbOpen(true)}
        >
          Show blurb
        </button>
        {currentStep !== "review" ? (
          <button type="button" className="candy-btn" onClick={nextStep}>
            Next →
          </button>
        ) : null}
      </div>

      {blurbOpen && <IntroContent onDismiss={() => setBlurbOpen(false)} />}
    </div>
  );
}

function SpellStep({
  state,
  update,
  classId,
  racialPreview,
  catalog,
}: {
  state: CharacterCreatorState;
  update: (p: Partial<CharacterCreatorState>) => void;
  classId: string;
  racialPreview: Record<AbilityKey, { racial: number }>;
  catalog: CreatorCatalog;
}) {
  const cls = catalog.classes.find((c) => c.id === classId);
  const sc = cls?.spellcasting;
  if (!sc) return null;

  const cantrips = catalog.spells.filter(
    (s) => s.level === 0 && s.classes.includes(sc.spellListId)
  );
  const level1 = catalog.spells.filter(
    (s) => s.level === 1 && s.classes.includes(sc.spellListId)
  );

  const preparedCount = sc.preparedCaster
    ? Math.max(
        1,
        Math.floor(
          (state.baseScores[sc.spellbookAtLevel1 ? "int" : sc.ability] +
            (racialPreview[sc.spellbookAtLevel1 ? "int" : sc.ability]?.racial ?? 0) -
            10) /
            2
        ) + 1
      )
    : sc.spellsKnown ?? 0;

  return (
    <>
      <p className="retro-muted">
        {sc.cantripsKnown} cantrip(s)
        {sc.spellsKnown ? ` · ${sc.spellsKnown} spell(s) known` : ""}
        {sc.spellbookAtLevel1 ? ` · ${sc.spellbookAtLevel1} in spellbook` : ""}
        {sc.preparedCaster && !sc.spellbookAtLevel1
          ? ` · prepare ${preparedCount} 1st-level spell(s)`
          : ""}
        {sc.spellbookAtLevel1 ? ` · prepare ${preparedCount} from spellbook` : ""}
      </p>

      <p className="candy-label">Cantrips</p>
      <div className="creator-spell-grid">
        {cantrips.map((spell) => (
          <Tooltip key={spell.id} content={spell.description}>
            <button
              type="button"
              className={`candy-btn candy-btn-sm${state.cantripIds.includes(spell.id) ? " candy-btn-active" : ""}`}
              onClick={() =>
                update({
                  cantripIds: toggleInList(state.cantripIds, spell.id, sc.cantripsKnown),
                })
              }
            >
              {spell.name}
            </button>
          </Tooltip>
        ))}
      </div>

      {sc.spellbookAtLevel1 ? (
        <>
          <p className="candy-label">Spellbook (6 spells)</p>
          <div className="creator-spell-grid">
            {level1.map((spell) => (
              <Tooltip key={spell.id} content={spell.description}>
                <button
                  type="button"
                  className={`candy-btn candy-btn-sm${state.wizardSpellbookIds.includes(spell.id) ? " candy-btn-active" : ""}`}
                  onClick={() =>
                    update({
                      wizardSpellbookIds: toggleInList(
                        state.wizardSpellbookIds,
                        spell.id,
                        sc.spellbookAtLevel1
                      ),
                    })
                  }
                >
                  {spell.name}
                </button>
              </Tooltip>
            ))}
          </div>
          <p className="candy-label">Prepared today</p>
          <div className="creator-spell-grid">
            {state.wizardSpellbookIds.map((id) => {
              const spell = catalog.spells.find((s) => s.id === id);
              if (!spell) return null;
              return (
                <button
                  key={spell.id}
                  type="button"
                  className={`candy-btn candy-btn-sm${state.spellIds.includes(spell.id) ? " candy-btn-active" : ""}`}
                  onClick={() =>
                    update({
                      spellIds: toggleInList(state.spellIds, spell.id, preparedCount),
                    })
                  }
                >
                  {spell.name}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <p className="candy-label">
            {sc.preparedCaster ? "Prepared spells" : "Spells known"}
          </p>
          <div className="creator-spell-grid">
            {level1.map((spell) => (
              <Tooltip key={spell.id} content={spell.description}>
                <button
                  type="button"
                  className={`candy-btn candy-btn-sm${state.spellIds.includes(spell.id) ? " candy-btn-active" : ""}`}
                  onClick={() =>
                    update({
                      spellIds: toggleInList(state.spellIds, spell.id, preparedCount),
                    })
                  }
                >
                  {spell.name}
                  {spell.ritual ? " ◆" : ""}
                </button>
              </Tooltip>
            ))}
          </div>
        </>
      )}
    </>
  );
}
