import type { AbilityKey } from "@/lib/schemas/character";
import { Tooltip } from "@/components/ui/tooltip";
import {
  ABILITY_FULL_LABELS,
  ABILITY_LABELS,
  abilityModifier,
  formatModifier,
} from "@/lib/dnd/calculations";
import { ABILITY_KEYS, POINT_BUY_TOTAL, pointBuySpent } from "@/lib/dnd/phb/point-buy";

interface RacialPreviewEntry {
  base: number;
  racial: number;
  other: number;
  sources: { label: string; value: number }[];
}

interface AbilityScorePanelProps {
  baseScores: Record<AbilityKey, number>;
  racialPreview: Record<AbilityKey, RacialPreviewEntry>;
  onChange: (key: AbilityKey, value: number) => void;
  readOnly?: boolean;
}

export function AbilityScorePanel({
  baseScores,
  racialPreview,
  onChange,
  readOnly = false,
}: AbilityScorePanelProps) {
  const spent = pointBuySpent(baseScores);
  const remaining = POINT_BUY_TOTAL - spent;

  return (
    <div>
      <p className="retro-muted creator-points">
        Point buy: {spent} / {POINT_BUY_TOTAL} spent
        {remaining !== 0 ? ` (${remaining > 0 ? remaining + " left" : Math.abs(remaining) + " over"})` : " ✓"}
      </p>
      <div className="creator-ability-grid">
        {ABILITY_KEYS.map((key) => {
          const racial = racialPreview[key]?.racial ?? 0;
          const total = baseScores[key] + racial;
          const mod = abilityModifier(total);
          const sources = [
            { label: "Base", value: baseScores[key] },
            ...(racialPreview[key]?.sources ?? []),
          ];
          const title = sources.map((s) => `${s.label}: ${s.value >= 0 ? "+" : ""}${s.value}`).join("\n");

          return (
            <Tooltip key={key} content={readOnly ? title : null}>
            <div className="creator-ability-cell retro-box">
              <p className="creator-ability-label">{ABILITY_LABELS[key]}</p>
              <p className="creator-ability-name">{ABILITY_FULL_LABELS[key]}</p>
              {readOnly ? (
                <p className="creator-ability-score">{total}</p>
              ) : (
                <div className="creator-ability-controls">
                  <button
                    type="button"
                    className="candy-btn candy-btn-sm"
                    disabled={baseScores[key] <= 8}
                    onClick={() => onChange(key, baseScores[key] - 1)}
                  >
                    −
                  </button>
                  <span className="creator-ability-score">{total}</span>
                  <button
                    type="button"
                    className="candy-btn candy-btn-sm"
                    disabled={baseScores[key] >= 15}
                    onClick={() => onChange(key, baseScores[key] + 1)}
                  >
                    +
                  </button>
                </div>
              )}
              <p className="creator-ability-mod">{formatModifier(mod)}</p>
              {racial !== 0 ? (
                <p className="creator-ability-racial">includes {racial > 0 ? "+" : ""}{racial} racial</p>
              ) : null}
            </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
