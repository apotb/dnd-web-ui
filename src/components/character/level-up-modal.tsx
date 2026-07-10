"use client";

import { useEffect, useMemo, useState } from "react";
import { applyLevelUp } from "@/lib/character/apply-level-up";
import { saveCharacterData } from "@/lib/character/save-character-data";
import { CantripPickerField } from "@/components/spells/cantrip-picker-field";
import { SpellPreparationPicker } from "@/components/spells/spell-preparation-picker";
import { SpellPicker } from "@/components/spells/spell-picker";
import { LanguagePicker } from "@/components/character-creator/language-picker";
import { SkillPicker } from "@/components/character-creator/skill-picker";
import { FeatPicker } from "@/components/character-creator/feat-picker";
import { FightingStylePicker } from "@/components/character/fighting-style-picker";
import { RangerFeaturePickers } from "@/components/character/ranger-feature-pickers";
import { findCatalogRulesDescription } from "@/lib/character/feature-choices";
import { resolveCharacterClass } from "@/lib/character/class-derivation";
import { getRangerPicksFromChoices } from "@/lib/dnd/phb/ranger-feature-slots";
import {
  fetchCatalogClassesClient,
  type CatalogSpellRow,
} from "@/lib/content/catalog-client";
import {
  ABILITY_FULL_LABELS,
  ABILITY_LABELS,
  formatModifier,
} from "@/lib/dnd/calculations";
import { getFeatAbilityBonusConfig } from "@/lib/dnd/feat-ability-bonuses";
import {
  computeHpGain,
  getLevelUpSteps,
  getAllSelectedFeatIds,
  validateLevelUpDraft,
  validateLevelUpStep,
  type LevelUpDraft,
  type LevelUpStep,
} from "@/lib/dnd/level-up";
import { ABILITY_KEYS } from "@/lib/dnd/phb/point-buy";
import { KNOWLEDGE_DOMAIN_SKILL_OPTIONS } from "@/lib/dnd/phb/cleric-domain-grants";
import { getCharacterLevel } from "@/lib/dnd/xp";
import type { AbilityKey, CharacterData } from "@/lib/schemas/character";
import type { PhbClass } from "@/lib/dnd/phb/types";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";

interface LevelUpModalProps {
  characterId: string;
  data: CharacterData;
  originalData: CharacterData;
  onComplete: () => void;
  onCancel: () => void;
  isDm?: boolean;
  onSaved?: (next: CharacterData) => void;
}

function StepReview({ step }: { step: Extract<LevelUpStep, { kind: "review" }> }) {
  if (step.features.length === 0) {
    return (
      <p className="retro-muted">
        No new class features listed for this level — you may still have choices below.
      </p>
    );
  }
  return (
    <ul className="level-up-feature-list">
      {step.features.map((f) => (
        <li key={`${f.source}-${f.name}`} className="retro-box level-up-feature-card">
          <p className="level-up-feature-name">
            {f.name}
            {f.source === "subclass" ? (
              <span className="retro-muted"> · subclass</span>
            ) : null}
          </p>
          <p className="retro-muted level-up-feature-desc">{f.description}</p>
        </li>
      ))}
    </ul>
  );
}

export function LevelUpModal({
  characterId,
  data,
  originalData,
  onComplete,
  onCancel,
  isDm = false,
  onSaved,
}: LevelUpModalProps) {
  const [classes, setClasses] = useState<PhbClass[]>(PHB_CLASSES);
  const [catalogReady, setCatalogReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<LevelUpDraft>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [spellPickerOpen, setSpellPickerOpen] = useState(false);
  const [spellPickerTarget, setSpellPickerTarget] = useState<"wizard" | null>(null);

  const targetLevel = getCharacterLevel(data) + 1;
  const catalogs = useMemo(() => ({ classes }), [classes]);

  const existingKnownSpellSlugs = useMemo(
    () =>
      data.spells.known
        .filter((spell) => spell.level > 0 && spell.spellId)
        .map((spell) => spell.spellId as string),
    [data.spells.known]
  );

  useEffect(() => {
    fetchCatalogClassesClient()
      .then((loaded) => {
        setClasses(loaded);
        setCatalogReady(true);
      })
      .catch(() => {
        setCatalogReady(true);
      });
  }, []);

  const steps = useMemo(
    () => getLevelUpSteps(data, catalogs, targetLevel, draft),
    [data, catalogs, targetLevel, draft]
  );

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex >= steps.length - 1;

  function patchDraft(patch: Partial<LevelUpDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setMessage(null);
  }

  function goNext() {
    if (!currentStep) return;
    if (!isLastStep) {
      const err = validateLevelUpStep(
        data,
        catalogs,
        targetLevel,
        currentStep,
        draft
      );
      if (err) {
        setMessage(err);
        return;
      }
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
      setMessage(null);
      return;
    }
    void completeLevelUp();
  }

  function goBack() {
    setStepIndex((i) => Math.max(0, i - 1));
    setMessage(null);
  }

  function handleCancel() {
    setDraft({});
    setStepIndex(0);
    setMessage(null);
    onCancel();
  }

  async function completeLevelUp() {
    const err = validateLevelUpDraft(data, catalogs, targetLevel, draft);
    if (err) {
      setMessage(err);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const next = applyLevelUp(data, draft, catalogs);
      const { error } = await saveCharacterData(
        characterId,
        next,
        classes,
        { isDm, originalData }
      );
      if (error) {
        setMessage(error);
        setSaving(false);
        return;
      }
      onSaved?.(next);
      onComplete();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Level up failed.");
      setSaving(false);
    }
  }

  function onSpellPicked(spell: CatalogSpellRow) {
    if (spellPickerTarget === "wizard") {
      const ids = [...(draft.wizardSpellIds ?? [])];
      if (!ids.includes(spell.slug)) ids.push(spell.slug);
      patchDraft({ wizardSpellIds: ids });
    }
    setSpellPickerOpen(false);
    setSpellPickerTarget(null);
  }

  function renderStep() {
    if (!currentStep) return null;

    switch (currentStep.kind) {
      case "review":
        return <StepReview step={currentStep} />;

      case "hp": {
        const hp = draft.hp;
        const method = hp?.method;
        const roll = hp?.rollResult;
        return (
          <div className="level-up-hp-step">
            <p className="retro-muted">
              Hit die d{currentStep.hitDie} · Constitution{" "}
              {formatModifier(currentStep.conMod)}
            </p>
            <div className="level-up-hp-methods">
              <button
                type="button"
                className={`candy-btn${method === "average" ? " candy-btn-active" : ""}`}
                onClick={() =>
                  patchDraft({
                    hp: {
                      method: "average",
                      gain: currentStep.averageGain,
                    },
                  })
                }
              >
                Take average ({currentStep.averageRoll})
              </button>
              <button
                type="button"
                className={`candy-btn${method === "roll" ? " candy-btn-active" : ""}`}
                onClick={() =>
                  patchDraft({
                    hp: {
                      method: "roll",
                      rollResult: hp?.rollResult,
                      gain: 0,
                    },
                  })
                }
              >
                Roll d{currentStep.hitDie}
              </button>
            </div>
            {method === "roll" ? (
              <>
                <div className="level-up-hp-roll">
                  <label className="candy-label">
                    d{currentStep.hitDie} roll
                  </label>
                  <input
                    type="number"
                    className="candy-input"
                    min={1}
                    max={currentStep.hitDie}
                    placeholder={`d${currentStep.hitDie}`}
                    aria-label={`d${currentStep.hitDie} roll`}
                    value={roll ?? ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      const rollResult = Number.isFinite(val) ? val : undefined;
                      const hpGain = rollResult
                        ? computeHpGain(
                            currentStep.hitDie,
                            currentStep.conMod,
                            "roll",
                            rollResult
                          )
                        : 0;
                      patchDraft({
                        hp: { method: "roll", rollResult, gain: hpGain },
                      });
                    }}
                  />
                </div>
                <p className="level-up-hp-roll-note retro-muted">
                  Please don&apos;t cheat — roll once and enter the result.
                </p>
              </>
            ) : null}
            {hp ? (
              <p className="retro-muted">You gain {hp.gain} max HP.</p>
            ) : null}
          </div>
        );
      }

      case "subclass": {
        const cls = resolveCharacterClass(data, classes);
        return (
          <FightingStylePicker
            label={cls?.id === "wizard" ? "Arcane Tradition" : "Subclass"}
            options={currentStep.options}
            value={draft.subclassId}
            onChange={(id) => {
              const fullName =
                cls?.subclasses.find((subclass) => subclass.id === id)?.name ??
                currentStep.options.find((option) => option.value === id)?.label ??
                "";
              patchDraft({
                subclassId: id,
                subclassName: fullName,
              });
            }}
          />
        );
      }

      case "subclassChoices": {
        const choices = draft.featureChoices ?? {};
        if (currentStep.subclassId === "nature") {
          return (
            <div className="space-y-4">
              <label className="candy-label">Acolyte of Nature — skill</label>
              <SkillPicker
                selected={
                  choices.acolyteOfNatureSkill ? [choices.acolyteOfNatureSkill] : []
                }
                max={1}
                options={["animalHandling", "nature", "survival"]}
                onChange={(skills) =>
                  patchDraft({
                    featureChoices: {
                      ...choices,
                      acolyteOfNatureSkill: skills[0] ?? "",
                    },
                  })
                }
              />
              <label className="candy-label">Acolyte of Nature — druid cantrip</label>
              <CantripPickerField
                variant="creator"
                value={choices.bonusDruidCantripId ?? ""}
                onChange={(spellId) =>
                  patchDraft({
                    featureChoices: {
                      ...choices,
                      bonusDruidCantripId: spellId,
                    },
                  })
                }
                classListId="druid"
                placeholder="Druid cantrip"
              />
            </div>
          );
        }
        if (currentStep.subclassId === "knowledge") {
          return (
            <div className="space-y-4">
              <label className="candy-label">Blessings of Knowledge — languages</label>
              <LanguagePicker
                selected={choices.knowledgeDomainLanguages ?? []}
                max={2}
                onChange={(slugs) =>
                  patchDraft({
                    featureChoices: {
                      ...choices,
                      knowledgeDomainLanguages: slugs,
                    },
                  })
                }
              />
              <label className="candy-label">Blessings of Knowledge — skills</label>
              <SkillPicker
                selected={choices.knowledgeDomainSkills ?? []}
                max={2}
                options={[...KNOWLEDGE_DOMAIN_SKILL_OPTIONS]}
                onChange={(skills) =>
                  patchDraft({
                    featureChoices: {
                      ...choices,
                      knowledgeDomainSkills: skills,
                    },
                  })
                }
              />
            </div>
          );
        }
        return null;
      }

      case "fightingStyle":
        return (
          <FightingStylePicker
            options={currentStep.options}
            value={draft.fightingStyle}
            onChange={(fightingStyle) => patchDraft({ fightingStyle })}
          />
        );

      case "prepareSpells":
        return (
          <div className="space-y-3">
            <p className="retro-muted">
              Choose {currentStep.count} prepared spell
              {currentStep.count === 1 ? "" : "s"} (up to level{" "}
              {currentStep.maxSpellLevel}).
            </p>
            <SpellPreparationPicker
              active
              classListId={currentStep.classListId}
              maxSpellLevel={currentStep.maxSpellLevel}
              prepareLimit={currentStep.count}
              selectedSlugs={draft.preparedSpellIds ?? []}
              onSelectedSlugsChange={(slugs) =>
                patchDraft({ preparedSpellIds: slugs })
              }
              scrollMode="parent"
            />
          </div>
        );

      case "rangerPicks": {
        const mergedChoices = {
          ...(data.featureChoices ?? {}),
          ...(draft.featureChoices ?? {}),
        };
        const { enemyPicks, terrains } = getRangerPicksFromChoices(
          mergedChoices,
          targetLevel
        );
        const cls = resolveCharacterClass(data, classes);
        const enemyRules =
          (cls &&
            findCatalogRulesDescription(cls.features, "Favored Enemy", targetLevel)) ??
          "Choose favored enemy types gained at this level.";
        const terrainRules =
          (cls &&
            findCatalogRulesDescription(cls.features, "Natural Explorer", targetLevel)) ??
          "Choose favored terrain types gained at this level.";
        return (
          <RangerFeaturePickers
            enemySlotCount={currentStep.enemySlotCount}
            terrainSlotCount={currentStep.terrainSlotCount}
            enemyPicks={enemyPicks}
            terrains={terrains}
            onEnemyPicksChange={(picks) => {
              const primary = picks[0];
              patchDraft({
                featureChoices: {
                  ...mergedChoices,
                  favoredEnemyPicks: picks,
                  favoredEnemy: primary?.enemy ?? "",
                  favoredHumanoidSpecies: primary?.humanoidSpecies ?? [],
                },
              });
            }}
            onTerrainsChange={(nextTerrains) =>
              patchDraft({
                featureChoices: {
                  ...mergedChoices,
                  favoredTerrains: nextTerrains,
                  favoredTerrain: nextTerrains[0] ?? "",
                },
              })
            }
            enemyRules={enemyRules}
            terrainRules={terrainRules}
            variant="creator"
          />
        );
      }

      case "cantrips":
        return (
          <div className="space-y-3">
            <p className="retro-muted">
              Choose {currentStep.count} new cantrip
              {currentStep.count === 1 ? "" : "s"}.
            </p>
            {Array.from({ length: currentStep.count }).map((_, i) => (
              <CantripPickerField
                key={i}
                variant="creator"
                value={draft.cantripIds?.[i] ?? ""}
                onChange={(spellId) => {
                  const ids = [...(draft.cantripIds ?? [])];
                  ids[i] = spellId;
                  patchDraft({ cantripIds: ids.filter(Boolean) });
                }}
                classListId={currentStep.classListId}
              />
            ))}
          </div>
        );

      case "spellsKnown":
        return (
          <div className="space-y-3">
            <p className="retro-muted">
              Choose {currentStep.count} new spell
              {currentStep.count === 1 ? "" : "s"} (up to level{" "}
              {currentStep.maxSpellLevel}).
            </p>
            <SpellPreparationPicker
              active
              classListId={currentStep.classListId}
              maxSpellLevel={currentStep.maxSpellLevel}
              prepareLimit={currentStep.count}
              selectedSlugs={draft.spellIds ?? []}
              onSelectedSlugsChange={(slugs) => patchDraft({ spellIds: slugs })}
              excludeSlugs={existingKnownSpellSlugs}
              selectionKind="selected"
              scrollMode="parent"
            />
          </div>
        );

      case "wizardSpellbook":
        return (
          <div className="space-y-3">
            <p className="retro-muted">
              Add {currentStep.count} spells to your spellbook (up to level{" "}
              {currentStep.maxSpellLevel}).
            </p>
            {(draft.wizardSpellIds ?? []).map((slug, i) => (
              <p key={slug} className="text-sm">
                {i + 1}. {slug}
              </p>
            ))}
            {(draft.wizardSpellIds?.length ?? 0) < currentStep.count ? (
              <button
                type="button"
                className="candy-btn"
                onClick={() => {
                  setSpellPickerTarget("wizard");
                  setSpellPickerOpen(true);
                }}
              >
                Add to spellbook
              </button>
            ) : null}
          </div>
        );

      case "asiOrFeat": {
        const asiOrFeat = draft.asiOrFeat;
        return (
          <div className="space-y-4">
            <div className="level-up-asi-toggle">
              <button
                type="button"
                className={`candy-btn${asiOrFeat?.mode === "asi" ? " candy-btn-active" : ""}`}
                onClick={() => patchDraft({ asiOrFeat: { mode: "asi" } })}
              >
                Ability Score Improvement
              </button>
              <button
                type="button"
                className={`candy-btn${asiOrFeat?.mode === "feat" ? " candy-btn-active" : ""}`}
                onClick={() => patchDraft({ asiOrFeat: { mode: "feat", featId: "" } })}
              >
                Feat
              </button>
            </div>

            {asiOrFeat?.mode === "asi" ? (
              <div className="space-y-3">
                <div className="level-up-asi-toggle">
                  <button
                    type="button"
                    className={`candy-btn${asiOrFeat.style === "double" ? " candy-btn-active" : ""}`}
                    onClick={() =>
                      patchDraft({
                        asiOrFeat: { mode: "asi", style: "double" },
                      })
                    }
                  >
                    +2 to one ability
                  </button>
                  <button
                    type="button"
                    className={`candy-btn${asiOrFeat.style === "split" ? " candy-btn-active" : ""}`}
                    onClick={() =>
                      patchDraft({
                        asiOrFeat: { mode: "asi", style: "split", splitAbilities: undefined },
                      })
                    }
                  >
                    +1 to two abilities
                  </button>
                </div>
                {asiOrFeat.style === "double" ? (
                  <select
                    className="candy-input"
                    value={asiOrFeat.doubleAbility ?? ""}
                    onChange={(e) =>
                      patchDraft({
                        asiOrFeat: {
                          mode: "asi",
                          style: "double",
                          doubleAbility: e.target.value as AbilityKey,
                        },
                      })
                    }
                  >
                    <option value="">— ability —</option>
                    {ABILITY_KEYS.map((key) => (
                      <option key={key} value={key} disabled={data.abilityScores[key] >= 19}>
                        {ABILITY_FULL_LABELS[key]} ({data.abilityScores[key]})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map((slot) => (
                      <select
                        key={slot}
                        className="candy-input"
                        value={asiOrFeat.splitAbilities?.[slot as 0 | 1] ?? ""}
                        onChange={(e) => {
                          const other = asiOrFeat.splitAbilities?.[slot === 0 ? 1 : 0];
                          const picked = e.target.value as AbilityKey;
                          patchDraft({
                            asiOrFeat: {
                              mode: "asi",
                              style: "split",
                              splitAbilities: slot === 0
                                ? [picked, other ?? ("str" as AbilityKey)]
                                : [other ?? ("str" as AbilityKey), picked],
                            },
                          });
                        }}
                      >
                        <option value="">— ability —</option>
                        {ABILITY_KEYS.map((key) => (
                          <option key={key} value={key} disabled={data.abilityScores[key] >= 20}>
                            {ABILITY_LABELS[key]} ({data.abilityScores[key]})
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {asiOrFeat?.mode === "feat" ? (
              <div className="space-y-3">
                <FeatPicker
                  selectedId={asiOrFeat.featId}
                  excludedIds={getAllSelectedFeatIds(data)}
                  onChange={(featId) =>
                    patchDraft({
                      asiOrFeat: {
                        mode: "feat",
                        featId,
                        featAbilityChoiceIndex: undefined,
                      },
                    })
                  }
                />
                {asiOrFeat.featId ? (() => {
                  const bonus = getFeatAbilityBonusConfig(asiOrFeat.featId);
                  if (bonus?.mode === "choice" && bonus.choices) {
                    return (
                      <select
                        className="candy-input"
                        value={asiOrFeat.featAbilityChoiceIndex ?? ""}
                        onChange={(e) =>
                          patchDraft({
                            asiOrFeat: {
                              ...asiOrFeat,
                              featAbilityChoiceIndex: parseInt(e.target.value, 10),
                            },
                          })
                        }
                      >
                        <option value="">— ability bonus —</option>
                        {bonus.choices.map((choice, idx) => {
                          const label = ABILITY_KEYS.filter((k) => choice[k])
                            .map((k) => `${ABILITY_LABELS[k]} +${choice[k]}`)
                            .join(", ");
                          return (
                            <option key={idx} value={idx}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    );
                  }
                  return null;
                })() : null}
              </div>
            ) : null}
          </div>
        );
      }

      default:
        return null;
    }
  }

  const stepTitle = (() => {
    if (!currentStep) return "";
    switch (currentStep.kind) {
      case "review":
        return "New features";
      case "hp":
        return "Hit points";
      case "subclass":
        return "Subclass";
      case "subclassChoices":
        return "Subclass choices";
      case "fightingStyle":
        return "Fighting style";
      case "prepareSpells":
        return "Prepare spells";
      case "rangerPicks":
        return "Ranger choices";
      case "cantrips":
        return "Cantrips";
      case "spellsKnown":
        return "Spells known";
      case "wizardSpellbook":
        return "Spellbook";
      case "asiOrFeat":
        return "ASI or feat";
      default:
        return "";
    }
  })();

  const spellStep =
    currentStep?.kind === "wizardSpellbook" ? currentStep : null;

  return (
    <>
      <div className="supply-picker-overlay">
        <div className="supply-picker-modal retro-box level-up-modal">
        <p className="retro-box-title">Level up to {targetLevel}</p>
        <p className="retro-muted level-up-step-label">
          Step {stepIndex + 1} of {steps.length}: {stepTitle}
        </p>

        <div className="level-up-step-body">
          {!catalogReady ? (
            <p className="retro-muted">Loading class options…</p>
          ) : (
            renderStep()
          )}
        </div>

        {message ? <p className="level-up-error">{message}</p> : null}

        <div className="supply-picker-actions combat-roll-actions">
          {stepIndex > 0 ? (
            <button type="button" className="candy-btn" onClick={goBack} disabled={saving}>
              Back
            </button>
          ) : (
            <button type="button" className="candy-btn" onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
          )}
          <div className="combat-roll-right-actions">
            <button
              type="button"
              className="candy-btn"
              onClick={goNext}
              disabled={saving || !catalogReady}
            >
              {saving ? "Saving…" : !catalogReady ? "Loading…" : isLastStep ? "Complete level up" : "Next"}
            </button>
          </div>
        </div>
      </div>
      </div>

      {spellPickerOpen && spellStep ? (
        <SpellPicker
          open={spellPickerOpen}
          onClose={() => {
            setSpellPickerOpen(false);
            setSpellPickerTarget(null);
          }}
          onSelect={onSpellPicked}
          defaultClassListId="wizard"
          maxSpellLevel={
            spellStep?.kind === "wizardSpellbook"
              ? spellStep.maxSpellLevel
              : undefined
          }
          excludeSlugs={[
            ...(draft.wizardSpellIds ?? []),
            ...(draft.preparedSpellIds ?? []),
            ...existingKnownSpellSlugs,
          ]}
          initialLevel="1"
          lockLevelFilter={false}
          title="Add to spellbook"
        />
      ) : null}
    </>
  );
}
