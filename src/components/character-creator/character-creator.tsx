"use client";

import { useMemo, useState } from "react";
import type { AbilityKey, SkillKey } from "@/lib/schemas/character";
import { SKILL_LABELS } from "@/lib/dnd/calculations";
import { ABILITY_KEYS, isValidPointBuy } from "@/lib/dnd/phb/point-buy";
import {
  buildCharacterExport,
  computeRacialBonuses,
  validateCreatorState,
} from "@/lib/dnd/character-builder/build-character";
import {
  ALIGNMENTS,
  createInitialCreatorState,
  getVisibleSteps,
  type CharacterCreatorState,
  type CreatorStep,
} from "@/lib/dnd/character-builder/types";
import {
  ARTISAN_TOOLS,
  ALL_BACKGROUNDS,
  EXPLORER_TOOLS,
  GAMING_SETS,
  MUSICAL_INSTRUMENTS,
  STANDARD_LANGUAGES,
} from "@/lib/dnd/phb/backgrounds";
import {
  classRequiresSubclassAtLevel1,
  FAVORED_ENEMIES,
  FAVORED_TERRAINS,
  FIGHTING_STYLES,
  getClass,
  PHB_CLASSES,
} from "@/lib/dnd/phb/classes";
import { PHB_FEATS } from "@/lib/dnd/phb/feats";
import { getRace, PHB_RACES } from "@/lib/dnd/phb/races";
import { getRaceGrantLines } from "@/lib/dnd/phb/race-grants";
import {
  getCantripsForList,
  getLevel1SpellsForList,
  getSpell,
} from "@/lib/dnd/phb/spells";
import { characterExportSchema } from "@/lib/schemas/character";
import { AbilityScorePanel } from "./ability-score-panel";

interface CharacterCreatorProps {
  campaignId: string;
}

function toggleInList<T>(list: T[], item: T, max?: number): T[] {
  if (list.includes(item)) return list.filter((x) => x !== item);
  if (max !== undefined && list.length >= max) return list;
  return [...list, item];
}

export function CharacterCreator({ campaignId }: CharacterCreatorProps) {
  const [state, setState] = useState<CharacterCreatorState>(createInitialCreatorState);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  const visibleSteps = useMemo(() => getVisibleSteps(state), [state]);
  const currentStep = visibleSteps[stepIndex] ?? "identity";

  const selectedRace = getRace(state.raceId);
  const selectedBackground = ALL_BACKGROUNDS.find((b) => b.id === state.backgroundId);
  const selectedClass = getClass(state.classId);

  const raceGrantLines = useMemo(() => {
    if (!selectedRace) return [];
    return getRaceGrantLines(selectedRace, {
      subraceId: state.subraceId,
      halfElfAbilityBonuses: state.halfElfAbilityBonuses,
      halfElfSkills: state.halfElfSkills,
      variantHumanAbilityBonuses: state.variantHumanAbilityBonuses,
      variantHumanSkill: state.variantHumanSkill,
      variantHumanFeat: state.variantHumanFeat,
      raceLanguageChoices: state.raceLanguageChoices,
    });
  }, [selectedRace, state]);

  const racialPreview = useMemo(() => {
    const bonuses = computeRacialBonuses(state);
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
  }, [state]);

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
        if (!state.raceId) return "Choose a race.";
        if (selectedRace?.subraces?.length && !state.subraceId) return "Choose a subrace.";
        if (!state.backgroundId) return "Choose a background.";
        if (state.raceId === "half-elf" && state.halfElfAbilityBonuses.length !== 2) {
          return "Half-Elf: pick two ability scores for +1 (not Charisma).";
        }
        if (state.raceId === "half-elf" && state.halfElfSkills.length !== 2) {
          return "Half-Elf: pick two skill proficiencies.";
        }
        if (state.raceId === "human" && state.subraceId === "variant") {
          if (state.variantHumanAbilityBonuses.length !== 2) return "Variant Human: pick two +1 abilities.";
          if (!state.variantHumanSkill) return "Variant Human: pick a skill.";
          if (!state.variantHumanFeat) return "Variant Human: pick a feat.";
        }
        const raceLangCount =
          (selectedRace?.languageChoices ?? 0) +
          (state.raceId === "elf" && state.subraceId === "high" ? 1 : 0);
        if (state.raceLanguageChoices.length < raceLangCount) {
          return `Choose ${raceLangCount} language(s) from your race.`;
        }
        const bgLangCount = selectedBackground?.languageChoices ?? 0;
        if (state.backgroundLanguageChoices.length < bgLangCount) {
          return `Choose ${bgLangCount} language(s) from your background.`;
        }
        if (selectedBackground?.toolProficiencies?.includes("artisan's tools") && !state.backgroundArtisanTool) {
          return "Choose an artisan's tool from your background.";
        }
        if (selectedBackground?.toolProficiencies?.includes("gaming set") && !state.backgroundGamingSet) {
          return "Choose a gaming set from your background.";
        }
        if (selectedBackground?.toolProficiencies?.includes("musical instrument") && !state.backgroundMusicalInstrument) {
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
    setStepIndex((i) => Math.min(i + 1, visibleSteps.length - 1));
  }

  function prevStep() {
    setStepError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function downloadJson() {
    const errors = validateCreatorState(state);
    if (errors.length) {
      setStepError(errors[0] ?? "Fix validation errors before exporting.");
      return;
    }
    const payload = characterExportSchema.parse(buildCharacterExport(state));
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
    const skills = new Set<string>();
    selectedRace?.skillProficiencies?.forEach((s) => skills.add(SKILL_LABELS[s]));
    selectedBackground?.skillProficiencies.forEach((s) => skills.add(SKILL_LABELS[s]));
    if (state.raceId === "half-elf") {
      state.halfElfSkills.forEach((s) => skills.add(SKILL_LABELS[s]));
    }
    if (state.raceId === "human" && state.subraceId === "variant" && state.variantHumanSkill) {
      skills.add(SKILL_LABELS[state.variantHumanSkill]);
    }
    return [...skills];
  }, [selectedRace, selectedBackground, state]);

  return (
    <div className="creator-wrap">
      <nav className="creator-steps">
        {visibleSteps.map((step, i) => (
          <button
            key={step}
            type="button"
            className={`candy-btn candy-btn-sm${i === stepIndex ? " candy-btn-active" : ""}`}
            onClick={() => {
              if (i <= stepIndex) setStepIndex(i);
            }}
          >
            {step.charAt(0).toUpperCase() + step.slice(1)}
          </button>
        ))}
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
          <h3 className="retro-box-title">Race &amp; Background</h3>
          <div className="creator-two-col">
            <div>
              <label className="candy-label">Race</label>
              <select
                className="candy-input"
                value={state.raceId}
                onChange={(e) =>
                  update({
                    raceId: e.target.value,
                    subraceId: "",
                    halfElfAbilityBonuses: [],
                    halfElfSkills: [],
                    variantHumanAbilityBonuses: [],
                    variantHumanSkill: "",
                    variantHumanFeat: "",
                    raceLanguageChoices: [],
                  })
                }
              >
                <option value="">— choose —</option>
                {PHB_RACES.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>

              {selectedRace?.subraces?.length ? (
                <>
                  <label className="candy-label">Subrace / variant</label>
                  <select
                    className="candy-input"
                    value={state.subraceId}
                    onChange={(e) => update({ subraceId: e.target.value })}
                  >
                    <option value="">— choose —</option>
                    {selectedRace.subraces.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </>
              ) : null}

              {selectedRace ? (
                <div className="creator-grants">
                  {raceGrantLines.map((line) => (
                    <p key={line.label} className="retro-muted">
                      {line.label}: {line.value}
                    </p>
                  ))}
                </div>
              ) : null}

              {state.raceId === "half-elf" ? (
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
                  <p className="candy-label">Two skill proficiencies</p>
                  <SkillPicker
                    selected={state.halfElfSkills}
                    max={2}
                    onChange={(skills) => update({ halfElfSkills: skills })}
                  />
                </>
              ) : null}

              {state.raceId === "human" && state.subraceId === "variant" ? (
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
                    {PHB_FEATS.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </>
              ) : null}

              {(selectedRace?.languageChoices ?? 0) > 0 ||
              (state.raceId === "elf" && state.subraceId === "high") ? (
                <>
                  <p className="candy-label">Bonus languages</p>
                  <LanguagePicker
                    selected={state.raceLanguageChoices}
                    max={
                      (selectedRace?.languageChoices ?? 0) +
                      (state.raceId === "elf" && state.subraceId === "high" ? 1 : 0)
                    }
                    onChange={(langs) => update({ raceLanguageChoices: langs })}
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
                  })
                }
              >
                <option value="">— choose —</option>
                {ALL_BACKGROUNDS.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              {selectedBackground ? (
                <div className="creator-grants">
                  <p className="retro-muted">
                    Skills: {selectedBackground.skillProficiencies.map((s) => SKILL_LABELS[s]).join(", ")}
                  </p>
                  {selectedBackground.toolProficiencies?.length ? (
                    <p className="retro-muted">
                      Tools: {selectedBackground.toolProficiencies.join(", ")}
                    </p>
                  ) : null}
                  <p className="retro-muted">Starting gold: {selectedBackground.gold} gp</p>
                  <p className="retro-muted">Feature: {selectedBackground.feature.name}</p>
                </div>
              ) : null}

              {(selectedBackground?.languageChoices ?? 0) > 0 ? (
                <>
                  <p className="candy-label">Background languages</p>
                  <LanguagePicker
                    selected={state.backgroundLanguageChoices}
                    max={selectedBackground?.languageChoices ?? 0}
                    onChange={(langs) => update({ backgroundLanguageChoices: langs })}
                  />
                </>
              ) : null}

              {selectedBackground?.toolProficiencies?.includes("artisan's tools") ? (
                <>
                  <label className="candy-label">Artisan&apos;s tools</label>
                  <select
                    className="candy-input"
                    value={state.backgroundArtisanTool}
                    onChange={(e) => update({ backgroundArtisanTool: e.target.value })}
                  >
                    <option value="">— choose —</option>
                    {ARTISAN_TOOLS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </>
              ) : null}

              {selectedBackground?.toolProficiencies?.includes("gaming set") ? (
                <>
                  <label className="candy-label">Gaming set</label>
                  <select
                    className="candy-input"
                    value={state.backgroundGamingSet}
                    onChange={(e) => update({ backgroundGamingSet: e.target.value })}
                  >
                    <option value="">— choose —</option>
                    {GAMING_SETS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </>
              ) : null}

              {selectedBackground?.toolProficiencies?.includes("musical instrument") ? (
                <>
                  <label className="candy-label">Musical instrument</label>
                  <select
                    className="candy-input"
                    value={state.backgroundMusicalInstrument}
                    onChange={(e) => update({ backgroundMusicalInstrument: e.target.value })}
                  >
                    <option value="">— choose —</option>
                    {MUSICAL_INSTRUMENTS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </>
              ) : null}

              {selectedBackground?.toolProficiencies?.includes(
                "cartographer's tools or navigator's tools"
              ) ? (
                <>
                  <label className="candy-label">Explorer&apos;s tools</label>
                  <select
                    className="candy-input"
                    value={state.backgroundExplorerTool}
                    onChange={(e) => update({ backgroundExplorerTool: e.target.value })}
                  >
                    <option value="">— choose —</option>
                    {EXPLORER_TOOLS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </>
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
                fightingStyle: "",
                favoredEnemy: "",
                favoredTerrain: "",
              })
            }
          >
            <option value="">— choose —</option>
            {PHB_CLASSES.map((c) => (
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
                  <label className="candy-label">Favored enemy</label>
                  <select
                    className="candy-input"
                    value={state.favoredEnemy}
                    onChange={(e) => update({ favoredEnemy: e.target.value })}
                  >
                    <option value="">— choose —</option>
                    {FAVORED_ENEMIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <label className="candy-label">Favored terrain</label>
                  <select
                    className="candy-input"
                    value={state.favoredTerrain}
                    onChange={(e) => update({ favoredTerrain: e.target.value })}
                  >
                    <option value="">— choose —</option>
                    {FAVORED_TERRAINS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </>
              ) : null}

              {state.classId === "monk" ? (
                <>
                  <label className="candy-label">Tool or instrument</label>
                  <select
                    className="candy-input"
                    value={state.monkTool}
                    onChange={(e) => update({ monkTool: e.target.value })}
                  >
                    <option value="">— choose —</option>
                    {[...ARTISAN_TOOLS, ...MUSICAL_INSTRUMENTS].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </>
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
                onChange={(skills) => update({ classSkills: skills })}
              />
            </>
          ) : null}
        </section>
      ) : null}

      {currentStep === "spells" && selectedClass?.spellcasting ? (
        <section className="retro-box creator-section">
          <h3 className="retro-box-title">Spells</h3>
          <SpellStep state={state} update={update} classId={state.classId} racialPreview={racialPreview} />
        </section>
      ) : null}

      {currentStep === "equipment" ? (
        <section className="retro-box creator-section">
          <h3 className="retro-box-title">Starting Equipment</h3>
          {selectedClass ? (
            selectedClass.equipmentChoices.map((choice, index) => (
              <div key={choice.prompt} className="creator-equip-choice">
                <p className="candy-label">{choice.prompt}</p>
                <div className="creator-chip-row">
                  {choice.options.map((opt, optIndex) => (
                    <button
                      key={opt.label}
                      type="button"
                      className={`candy-btn candy-btn-sm${
                        (state.equipmentChoiceIndices[index] ?? -1) === optIndex
                          ? " candy-btn-active"
                          : ""
                      }`}
                      onClick={() => {
                        const next = [...state.equipmentChoiceIndices];
                        next[index] = optIndex;
                        update({ equipmentChoiceIndices: next });
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : null}

          {selectedBackground ? (
            <p className="retro-muted creator-summary">
              Background adds: {selectedBackground.equipment.join(", ")} and {selectedBackground.gold} gp.
            </p>
          ) : null}
        </section>
      ) : null}

      {currentStep === "review" ? (
        <section className="retro-box creator-section">
          <h3 className="retro-box-title">Review &amp; Download</h3>
          {(() => {
            const errors = validateCreatorState(state);
            if (errors.length) {
              return (
                <ul className="creator-error-list">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              );
            }
            const preview = buildCharacterExport(state);
            return (
              <>
                <p className="creator-summary">
                  {preview.name} · {preview.data.basicInfo.species} ·{" "}
                  {preview.data.basicInfo.classes.join(", ")} · Level 1
                </p>
                <p className="retro-muted">
                  HP {preview.data.combat.maxHp} · AC {preview.data.combat.ac} · Speed{" "}
                  {preview.data.combat.speed} ft · {preview.data.inventory.currency.gp} gp
                </p>
                <button type="button" className="candy-btn" onClick={downloadJson}>
                  Download character JSON
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
        {currentStep !== "review" ? (
          <button type="button" className="candy-btn" onClick={nextStep}>
            Next →
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SkillPicker({
  selected,
  max,
  options,
  onChange,
}: {
  selected: SkillKey[];
  max: number;
  options?: SkillKey[];
  onChange: (skills: SkillKey[]) => void;
}) {
  const keys = options ?? (Object.keys(SKILL_LABELS) as SkillKey[]);
  return (
    <div className="creator-chip-row creator-skill-grid">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          className={`candy-btn candy-btn-sm${selected.includes(key) ? " candy-btn-active" : ""}`}
          onClick={() => onChange(toggleInList(selected, key, max))}
        >
          {SKILL_LABELS[key]}
        </button>
      ))}
    </div>
  );
}

function LanguagePicker({
  selected,
  max,
  onChange,
}: {
  selected: string[];
  max: number;
  onChange: (langs: string[]) => void;
}) {
  return (
    <div className="creator-chip-row creator-lang-grid">
      {STANDARD_LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          className={`candy-btn candy-btn-sm${selected.includes(lang) ? " candy-btn-active" : ""}`}
          onClick={() => onChange(toggleInList(selected, lang, max))}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}

function SpellStep({
  state,
  update,
  classId,
  racialPreview,
}: {
  state: CharacterCreatorState;
  update: (p: Partial<CharacterCreatorState>) => void;
  classId: string;
  racialPreview: Record<AbilityKey, { racial: number }>;
}) {
  const cls = getClass(classId);
  const sc = cls?.spellcasting;
  if (!sc) return null;

  const cantrips = getCantripsForList(sc.spellListId);
  const level1 = getLevel1SpellsForList(sc.spellListId);

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
          <button
            key={spell.id}
            type="button"
            className={`candy-btn candy-btn-sm${state.cantripIds.includes(spell.id) ? " candy-btn-active" : ""}`}
            title={spell.description}
            onClick={() =>
              update({
                cantripIds: toggleInList(state.cantripIds, spell.id, sc.cantripsKnown),
              })
            }
          >
            {spell.name}
          </button>
        ))}
      </div>

      {sc.spellbookAtLevel1 ? (
        <>
          <p className="candy-label">Spellbook (6 spells)</p>
          <div className="creator-spell-grid">
            {level1.map((spell) => (
              <button
                key={spell.id}
                type="button"
                className={`candy-btn candy-btn-sm${state.wizardSpellbookIds.includes(spell.id) ? " candy-btn-active" : ""}`}
                title={spell.description}
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
            ))}
          </div>
          <p className="candy-label">Prepared today</p>
          <div className="creator-spell-grid">
            {state.wizardSpellbookIds.map((id) => {
              const spell = getSpell(id);
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
              <button
                key={spell.id}
                type="button"
                className={`candy-btn candy-btn-sm${state.spellIds.includes(spell.id) ? " candy-btn-active" : ""}`}
                title={spell.description}
                onClick={() =>
                  update({
                    spellIds: toggleInList(state.spellIds, spell.id, preparedCount),
                  })
                }
              >
                {spell.name}
                {spell.ritual ? " ◆" : ""}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
