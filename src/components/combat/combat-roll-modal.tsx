"use client";

import { useMemo, useState } from "react";
import type { CombatOption } from "@/lib/combat/combat-options";
import { formatModifier } from "@/lib/dnd/calculations";
import { formatAttackRollLine } from "@/lib/dnd/attacks";
import { formatDamageRoll, rollD20, rollDamage } from "@/lib/dnd/dice";

interface CombatRollModalProps {
  option: CombatOption;
  onCancel: () => void;
  onUse: () => void;
}

export function CombatRollModal({ option, onCancel, onUse }: CombatRollModalProps) {
  const attack = option.attack;
  const rollsAttack =
    attack != null && attack.rollType !== "save" && attack.rollType !== "auto";

  const [d20Roll, setD20Roll] = useState<number | null>(() =>
    rollsAttack ? rollD20() : null
  );
  const [damageRoll, setDamageRoll] = useState<ReturnType<typeof rollDamage>>(null);

  const attackTotal = useMemo(() => {
    if (d20Roll == null || !attack) return null;
    if (attack.rollType === "save" || attack.rollType === "auto") return null;
    return d20Roll + attack.attackBonus;
  }, [attack, d20Roll]);

  function handleRollDamage() {
    if (!attack?.damageDice.trim()) return;
    setDamageRoll(rollDamage(attack.damageDice));
  }

  function handleRollActionDamage() {
    const notation = option.enemyAction?.description.match(/\d+d\d+(?:\s*[+-]\s*\d+)?/i)?.[0];
    if (!notation) return;
    setDamageRoll(rollDamage(notation));
  }

  const title = option.name;

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-roll-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">{title}</p>

        {attack ? (
          <div className="combat-roll-body">
            {attack.rollType === "save" && attack.saveDc != null ? (
              <p className="combat-roll-line">
                {formatAttackRollLine(attack)}
                {attack.damageType ? ` · ${attack.damageType}` : ""}
              </p>
            ) : attack.rollType === "auto" ? (
              <p className="combat-roll-line">Auto hit</p>
            ) : (
              <div className="combat-roll-row">
                <span className="combat-roll-die">{d20Roll ?? "—"}</span>
                <span className="combat-roll-mod">
                  {formatModifier(attack.attackBonus)}
                </span>
                <span className="combat-roll-total" aria-live="polite">
                  = {attackTotal ?? "—"}
                </span>
              </div>
            )}

            {attack.damageDice ? (
              <div className="combat-roll-damage">
                <p className="combat-roll-line">
                  Damage: {attack.damageDice}
                  {attack.damageType ? ` ${attack.damageType}` : ""}
                </p>
                <button type="button" className="candy-btn" onClick={handleRollDamage}>
                  Roll damage
                </button>
                {damageRoll ? (
                  <p className="combat-roll-result" aria-live="polite">
                    {formatDamageRoll(damageRoll)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {attack.notes ? (
              <p className="combat-roll-notes retro-muted">{attack.notes}</p>
            ) : null}
          </div>
        ) : null}

        {option.action ? (
          <div className="combat-roll-body">
            <p className="combat-roll-line">{option.action.description}</p>
          </div>
        ) : null}

        {option.enemyAction ? (
          <div className="combat-roll-body">
            <p className="combat-roll-line">{option.enemyAction.description}</p>
            <button type="button" className="candy-btn" onClick={handleRollActionDamage}>
              Roll damage
            </button>
            {damageRoll ? (
              <p className="combat-roll-result" aria-live="polite">
                {formatDamageRoll(damageRoll)}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="supply-picker-actions combat-roll-actions">
          <button type="button" className="candy-btn" onClick={onCancel}>
            Cancel
          </button>
          <div className="combat-roll-right-actions">
            {attack && rollsAttack ? (
              <button
                type="button"
                className="candy-btn"
                onClick={() => setD20Roll(rollD20())}
              >
                Re-roll attack
              </button>
            ) : null}
            <button type="button" className="candy-btn" onClick={onUse}>
              Use Action
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
