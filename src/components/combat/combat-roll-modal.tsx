"use client";

import { useMemo, useState } from "react";
import { CombatBattleTooltipSummary } from "@/components/combat/combat-battle-tooltip-summary";
import type { CombatOption } from "@/lib/combat/combat-options";
import { buildBattleAttackTooltipParts } from "@/lib/combat/battle-tooltip";
import { formatModifier } from "@/lib/dnd/calculations";
import { formatDamageRoll, rollD20, rollDamage } from "@/lib/dnd/dice";
import type { CharacterData } from "@/lib/schemas/character";

interface CombatRollModalProps {
  option: CombatOption;
  attackerCharacter?: CharacterData;
  onCancel: () => void;
  onUse: () => void;
}

export function CombatRollModal({
  option,
  attackerCharacter,
  onCancel,
  onUse,
}: CombatRollModalProps) {
  const attack = option.attack;
  const rollsAttack =
    attack != null && attack.rollType !== "save" && attack.rollType !== "auto";

  const attackTooltipParts = useMemo(
    () =>
      attack
        ? buildBattleAttackTooltipParts(
            attack,
            attackerCharacter ?? ({ basicInfo: { xp: 0 }, combat: { conditions: [] }, exhaustionLevels: [] } as CharacterData),
            { omitBonusActionNote: true }
          )
        : null,
    [attack, attackerCharacter]
  );

  const [d20Roll, setD20Roll] = useState<number | null>(() =>
    rollsAttack ? rollD20() : null
  );
  const [damageRoll, setDamageRoll] = useState<ReturnType<typeof rollDamage>>(null);

  const attackTotal =
    d20Roll != null && attack && attack.rollType !== "save" && attack.rollType !== "auto"
      ? d20Roll + attack.attackBonus
      : null;

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

        {attack && attackTooltipParts ? (
          <div className="combat-roll-body">
            <CombatBattleTooltipSummary
              parts={attackTooltipParts}
              omitTitle
              className="retro-muted"
            />

            {attack.rollType !== "save" && attack.rollType !== "auto" ? (
              <div className="combat-roll-row">
                <span className="combat-roll-die">{d20Roll ?? "—"}</span>
                <span className="combat-roll-mod">
                  {formatModifier(attack.attackBonus)}
                </span>
                <span className="combat-roll-total" aria-live="polite">
                  = {attackTotal ?? "—"}
                </span>
              </div>
            ) : null}

            {attack.damageDice ? (
              <div className="combat-roll-damage">
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
