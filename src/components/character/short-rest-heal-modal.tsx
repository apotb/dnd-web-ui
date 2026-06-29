"use client";

import { useMemo, useState } from "react";
import {
  calculateEffectiveMaxHpBreakdown,
  getHitDiceRemaining,
  getHitDieSides,
} from "@/lib/character/combat-derivation";
import { abilityModifier } from "@/lib/dnd/calculations";
import { parseDieRoll, sanitizeDieRollInput } from "@/lib/dnd/dice";
import { applyShortRestFinish, applySingleHitDieHeal } from "@/lib/dnd/rest";
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

export function ShortRestHealModal({
  data,
  classes,
  speciesList,
  onApply,
}: ShortRestHealModalProps) {
  const [healRoll, setHealRoll] = useState("");
  const [busy, setBusy] = useState(false);

  if (!data.combat.pendingShortRest) return null;

  const hitDiceRemaining = getHitDiceRemaining(data, classes);
  const hitDieSides = getHitDieSides(data, classes);
  const conMod = abilityModifier(data.abilityScores.con);
  const healRollValue = parseDieRoll(healRoll, hitDieSides);
  const healTotal =
    healRollValue != null ? Math.max(0, healRollValue + conMod) : null;
  const healBonus = formatRollBonus(conMod);
  const { total: maxHp } = useMemo(
    () => calculateEffectiveMaxHpBreakdown(data, classes, speciesList),
    [data, classes, speciesList]
  );
  const atFullHp = data.combat.currentHp >= maxHp;
  const canHeal = !atFullHp && hitDiceRemaining > 0;

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

  async function handleFinish() {
    if (busy) return;
    const next = applyShortRestFinish(data, classes, speciesList);
    await runApply(next);
    setHealRoll("");
  }

  return (
    <div className="supply-picker-overlay">
      <div className="supply-picker-modal retro-box short-rest-heal-modal">
        <p className="retro-box-title">Short rest — heal with Hit Dice</p>
        <p className="retro-muted">
          HP {data.combat.currentHp}/{maxHp} · {hitDiceRemaining} hit{" "}
          {hitDiceRemaining === 1 ? "die" : "dice"} remaining
        </p>
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
