"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LAY_ON_HANDS_CURE_COST,
  type LayOnHandsMode,
} from "@/lib/dnd/mechanical-features";

export interface LayOnHandsTarget {
  id: string;
  name: string;
  currentHp: number;
  maxHp: number;
  poisoned: boolean;
}

export interface LayOnHandsFormProps {
  targets: LayOnHandsTarget[];
  poolRemaining: number;
  selectedTargetId: string;
  onSelectTarget: (id: string) => void;
  mode: LayOnHandsMode;
  onModeChange: (mode: LayOnHandsMode) => void;
  healAmount: number;
  onHealAmountChange: (amount: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  title?: string;
  cureCost?: number;
  enableCure?: boolean;
}

function healValidation(
  target: LayOnHandsTarget | null,
  healAmount: number,
  poolRemaining: number
): string | null {
  if (!target) return "Select a target.";
  if (target.currentHp >= target.maxHp) return "Target is already at full HP.";
  if (poolRemaining <= 0) return "No healing pool remaining.";
  if (healAmount <= 0) return "Enter an amount to heal.";
  if (healAmount > poolRemaining) return "Not enough pool remaining.";
  return null;
}

function cureValidation(
  target: LayOnHandsTarget | null,
  poolRemaining: number,
  cureCost: number
): string | null {
  if (!target) return "Select a target.";
  if (!target.poisoned) return "Target has no poison to cure.";
  if (poolRemaining < cureCost) {
    return `Need at least ${cureCost} pool HP to cure poison.`;
  }
  return null;
}

export function LayOnHandsForm({
  targets,
  poolRemaining,
  selectedTargetId,
  onSelectTarget,
  mode,
  onModeChange,
  healAmount,
  onHealAmountChange,
  onConfirm,
  onCancel,
  busy = false,
  title = "Lay on Hands",
  cureCost = LAY_ON_HANDS_CURE_COST,
  enableCure = cureCost > 0,
}: LayOnHandsFormProps) {
  const selectedTarget =
    targets.find((target) => target.id === selectedTargetId) ?? targets[0] ?? null;
  const maxHeal =
    selectedTarget == null
      ? 0
      : Math.min(
          poolRemaining,
          Math.max(0, selectedTarget.maxHp - selectedTarget.currentHp)
        );
  const validation =
    mode === "heal"
      ? healValidation(selectedTarget, healAmount, poolRemaining)
      : cureValidation(selectedTarget, poolRemaining, cureCost);
  const canConfirm = validation == null && !busy;

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-roll-modal lay-on-hands-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">{title}</p>
        <div className="combat-roll-body space-y-4">
          <p className="combat-roll-line">
            Pool remaining: {poolRemaining} HP
          </p>

          <div className="space-y-2">
            <p className="text-sm font-medium">Target</p>
            <div className="lay-on-hands-target-list space-y-2">
              {targets.map((target) => {
                const selected = target.id === (selectedTarget?.id ?? "");
                return (
                  <button
                    key={target.id}
                    type="button"
                    className={`lay-on-hands-target${selected ? " lay-on-hands-target--selected" : ""}`}
                    onClick={() => onSelectTarget(target.id)}
                  >
                    <span className="font-medium">{target.name}</span>
                    <span className="retro-muted">
                      {target.currentHp}/{target.maxHp} HP
                    </span>
                    {target.poisoned ? (
                      <Badge variant="outline" className="text-xs">
                        Poisoned
                      </Badge>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "heal" ? "default" : "outline"}
              onClick={() => onModeChange("heal")}
            >
              Heal
            </Button>
            {enableCure ? (
            <Button
              type="button"
              size="sm"
              variant={mode === "cure" ? "default" : "outline"}
              onClick={() => onModeChange("cure")}
            >
              Cure poison/disease ({cureCost} HP)
            </Button>
            ) : null}
          </div>

          {mode === "heal" ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm" htmlFor="lay-on-hands-heal-amount">
                HP to restore
              </label>
              <Input
                id="lay-on-hands-heal-amount"
                type="number"
                min={1}
                max={Math.max(1, maxHeal)}
                className="h-8 w-20"
                value={healAmount}
                onChange={(event) => {
                  const next = parseInt(event.target.value, 10);
                  onHealAmountChange(Number.isFinite(next) ? next : 0);
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={maxHeal <= 0}
                onClick={() => onHealAmountChange(maxHeal)}
              >
                Max ({maxHeal})
              </Button>
            </div>
          ) : enableCure ? (
            <p className="text-xs retro-muted">
              Spends {cureCost} pool HP to remove the poisoned
              condition. Other diseases are tracked by the DM until a disease
              condition exists.
            </p>
          ) : null}

          {validation ? (
            <p className="text-sm text-destructive">{validation}</p>
          ) : null}
        </div>
        <div className="supply-picker-actions combat-roll-actions">
          <button type="button" className="candy-btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <div className="combat-roll-right-actions">
            <button
              type="button"
              className="candy-btn"
              onClick={onConfirm}
              disabled={!canConfirm}
            >
              {mode === "heal" ? "Heal" : "Cure"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
