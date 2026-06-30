"use client";

import { useMemo, useState } from "react";
import {
  calculateEffectiveMaxHpBreakdown,
  getHitDiceRemaining,
  getHitDieSides,
} from "@/lib/character/combat-derivation";
import { abilityModifier } from "@/lib/dnd/calculations";
import { parseDieRoll, sanitizeDieRollInput } from "@/lib/dnd/dice";
import {
  applySecondWind,
  applySpellSlotRecovery,
  ARCANE_RECOVERY_ID,
  canUseSecondWind,
  getSpellRecoveryOptions,
  NATURAL_RECOVERY_ID,
  type SpellRecoverySelection,
} from "@/lib/dnd/mechanical-features";
import { applyShortRestFinish, applySingleHitDieHeal } from "@/lib/dnd/rest";
import { levelFromXp } from "@/lib/dnd/xp";
import type { CharacterData } from "@/lib/schemas/character";
import type { PhbClass, PhbSpecies } from "@/lib/dnd/phb/types";

interface ShortRestHealModalProps {
  data: CharacterData;
  classes?: PhbClass[];
  speciesList?: PhbSpecies[];
  onApply: (next: CharacterData) => void | Promise<void>;
}

function formatRollBonus(value: number): { sign: string; amount: string } {
  if (value >= 0) return { sign: "+", amount: String(value) };
  return { sign: "−", amount: String(Math.abs(value)) };
}

function ordinalLevel(level: number): string {
  const mod100 = level % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${level}th`;
  switch (level % 10) {
    case 1:
      return `${level}st`;
    case 2:
      return `${level}nd`;
    case 3:
      return `${level}rd`;
    default:
      return `${level}th`;
  }
}

export function ShortRestHealModal({
  data,
  classes,
  speciesList,
  onApply,
}: ShortRestHealModalProps) {
  const [healRoll, setHealRoll] = useState("");
  const [secondWindRoll, setSecondWindRoll] = useState("");
  const [slotSelections, setSlotSelections] = useState<
    Record<number, number>
  >({});
  const [busy, setBusy] = useState(false);

  const catalogs = useMemo(
    () => ({ classes, species: speciesList }),
    [classes, speciesList]
  );

  const arcaneRecovery = useMemo(
    () => getSpellRecoveryOptions(data, ARCANE_RECOVERY_ID, catalogs),
    [data, catalogs]
  );
  const naturalRecovery = useMemo(
    () => getSpellRecoveryOptions(data, NATURAL_RECOVERY_ID, catalogs),
    [data, catalogs]
  );
  const spellRecovery =
    arcaneRecovery?.available
      ? arcaneRecovery
      : naturalRecovery?.available
        ? naturalRecovery
        : null;

  const secondWindCanUse = canUseSecondWind(data, catalogs);
  const characterLevel = levelFromXp(data.basicInfo.xp ?? 0);

  const hitDiceRemaining = getHitDiceRemaining(data, classes);
  const hitDieSides = getHitDieSides(data, classes);
  const conMod = abilityModifier(data.abilityScores.con);
  const healRollValue = parseDieRoll(healRoll, hitDieSides);
  const healTotal =
    healRollValue != null ? Math.max(0, healRollValue + conMod) : null;
  const healBonus = formatRollBonus(conMod);
  const secondWindRollValue = parseDieRoll(secondWindRoll, 10);
  const secondWindTotal =
    secondWindRollValue != null
      ? Math.max(0, secondWindRollValue + characterLevel)
      : null;
  const secondWindBonus = formatRollBonus(characterLevel);
  const { total: derivedMaxHp } = useMemo(
    () => calculateEffectiveMaxHpBreakdown(data, classes, speciesList),
    [data, classes, speciesList]
  );
  const maxHp = Math.max(data.combat.maxHp, derivedMaxHp);
  const atFullHp = data.combat.currentHp >= maxHp;
  const canHeal = !atFullHp && hitDiceRemaining > 0;

  const selectedSpellLevels = useMemo(() => {
    if (!spellRecovery) return 0;
    return spellRecovery.levels.reduce((sum, level) => {
      const count = slotSelections[level.level] ?? 0;
      return sum + level.level * count;
    }, 0);
  }, [spellRecovery, slotSelections]);

  const spellRecoverySelections = useMemo((): SpellRecoverySelection[] => {
    if (!spellRecovery) return [];
    return spellRecovery.levels
      .map((level) => ({
        level: level.level,
        count: slotSelections[level.level] ?? 0,
      }))
      .filter((entry) => entry.count > 0);
  }, [spellRecovery, slotSelections]);

  const canRecoverSlots =
    !!spellRecovery &&
    selectedSpellLevels > 0 &&
    selectedSpellLevels <= spellRecovery.budget;

  if (!data.combat.pendingShortRest) return null;

  async function runApply(next: CharacterData) {
    setBusy(true);
    try {
      await onApply(next);
    } finally {
      setBusy(false);
    }
  }

  async function handleHeal() {
    if (healRollValue == null || !canHeal || busy) return;
    const next = applySingleHitDieHeal(
      data,
      healRollValue,
      classes,
      speciesList
    );
    await runApply(next);
    setHealRoll("");
  }

  async function handleRecoverSlots() {
    if (!spellRecovery || !canRecoverSlots || busy) return;
    const next = applySpellSlotRecovery(
      data,
      spellRecovery.featureId,
      spellRecoverySelections,
      catalogs
    );
    await runApply(next);
    setSlotSelections({});
  }

  async function handleSecondWind() {
    if (secondWindRollValue == null || !secondWindCanUse || busy) return;
    const next = applySecondWind(data, secondWindRollValue, catalogs);
    await runApply(next);
    setSecondWindRoll("");
  }

  async function handleFinish() {
    if (busy) return;
    const next = applyShortRestFinish(data, classes, speciesList);
    await runApply(next);
    setHealRoll("");
    setSecondWindRoll("");
    setSlotSelections({});
  }

  function adjustSlotSelection(level: number, delta: number, max: number) {
    setSlotSelections((prev) => {
      const current = prev[level] ?? 0;
      const next = Math.max(0, Math.min(max, current + delta));
      if (next === 0) {
        const { [level]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [level]: next };
    });
  }

  return (
    <div className="supply-picker-overlay">
      <div className="supply-picker-modal retro-box short-rest-heal-modal">
        <p className="retro-box-title">Short rest — heal with Hit Dice</p>
        <p className="retro-muted">
          HP {data.combat.currentHp}/{maxHp} · {hitDiceRemaining} hit{" "}
          {hitDiceRemaining === 1 ? "die" : "dice"} remaining
        </p>

        {spellRecovery ? (
          <div className="short-rest-feature-panel">
            <p className="short-rest-feature-title">{spellRecovery.featureName}</p>
            <p className="retro-muted">
              Recover up to {spellRecovery.budget} spell levels (selected:{" "}
              {selectedSpellLevels}/{spellRecovery.budget})
            </p>
            <div className="short-rest-slot-rows">
              {spellRecovery.levels.map((level) => {
                const selected = slotSelections[level.level] ?? 0;
                return (
                  <div key={level.level} className="short-rest-slot-row">
                    <span>
                      {ordinalLevel(level.level)}-level ({level.used} used)
                    </span>
                    <div className="short-rest-slot-controls">
                      <button
                        type="button"
                        className="candy-btn candy-btn-sm"
                        disabled={busy || selected <= 0}
                        onClick={() =>
                          adjustSlotSelection(level.level, -1, level.used)
                        }
                        aria-label={`Recover fewer ${ordinalLevel(level.level)}-level slots`}
                      >
                        −
                      </button>
                      <span className="short-rest-slot-count">{selected}</span>
                      <button
                        type="button"
                        className="candy-btn candy-btn-sm"
                        disabled={
                          busy ||
                          selected >= level.used ||
                          selectedSpellLevels + level.level > spellRecovery.budget
                        }
                        onClick={() =>
                          adjustSlotSelection(level.level, 1, level.used)
                        }
                        aria-label={`Recover more ${ordinalLevel(level.level)}-level slots`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className="candy-btn"
              onClick={() => void handleRecoverSlots()}
              disabled={busy || !canRecoverSlots}
            >
              Recover slots
            </button>
          </div>
        ) : null}

        {secondWindCanUse ? (
          <div className="short-rest-feature-panel">
            <p className="short-rest-feature-title">Second Wind</p>
            <div className="short-rest-heal-row">
              <input
                type="text"
                inputMode="numeric"
                className="candy-input short-rest-heal-input"
                placeholder="d10"
                value={secondWindRoll}
                onChange={(event) =>
                  setSecondWindRoll(
                    sanitizeDieRollInput(event.target.value, 10)
                  )
                }
                disabled={busy}
                aria-label="d10 roll for Second Wind"
                aria-invalid={
                  secondWindRoll.trim().length > 0 &&
                  secondWindRollValue == null
                }
              />
              <span className="combat-roll-sep">{secondWindBonus.sign}</span>
              <span className="combat-roll-mod">{secondWindBonus.amount}</span>
              <span className="combat-roll-sep">=</span>
              <span className="combat-roll-total" aria-live="polite">
                {secondWindTotal ?? "—"}
              </span>
            </div>
            <button
              type="button"
              className="candy-btn"
              onClick={() => void handleSecondWind()}
              disabled={busy || secondWindRollValue == null}
            >
              Use Second Wind
            </button>
          </div>
        ) : null}

        <div className="short-rest-heal-row">
          <input
            type="text"
            inputMode="numeric"
            className="candy-input short-rest-heal-input"
            placeholder={`d${hitDieSides}`}
            value={healRoll}
            onChange={(event) =>
              setHealRoll(
                sanitizeDieRollInput(event.target.value, hitDieSides)
              )
            }
            disabled={busy || !canHeal}
            autoFocus
            aria-label={`d${hitDieSides} roll`}
            aria-invalid={healRoll.trim().length > 0 && healRollValue == null}
          />
          <span className="combat-roll-sep">{healBonus.sign}</span>
          <span className="combat-roll-mod">{healBonus.amount}</span>
          <span className="combat-roll-sep">=</span>
          <span className="combat-roll-total" aria-live="polite">
            {healTotal ?? "—"}
          </span>
        </div>
        {atFullHp ? (
          <p className="retro-muted">Already at full HP.</p>
        ) : hitDiceRemaining <= 0 ? (
          <p className="retro-muted">No hit dice remaining.</p>
        ) : null}
        <div className="supply-picker-actions short-rest-heal-actions">
          <button
            type="button"
            className="candy-btn"
            onClick={() => void handleHeal()}
            disabled={busy || healRollValue == null || !canHeal}
          >
            Heal
          </button>
          <button
            type="button"
            className="candy-btn"
            onClick={() => void handleFinish()}
            disabled={busy}
          >
            {busy ? "…" : "Finish"}
          </button>
        </div>
      </div>
    </div>
  );
}
