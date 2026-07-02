"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HumanoidSpeciesPicker } from "@/components/character-creator/humanoid-species-picker";
import {
  buildChoiceDescription,
  choicePlaceholder,
} from "@/lib/character/feature-choices";
import { FAVORED_ENEMIES, FAVORED_TERRAINS } from "@/lib/dnd/phb/classes";
import {
  formatFavoredEnemyDisplay,
  TWO_HUMANOID_SPECIES_OPTION,
} from "@/lib/dnd/phb/favored-enemy-humanoids";
import type { FavoredEnemyPick } from "@/lib/dnd/phb/ranger-feature-slots";

export type RangerPickerVariant = "creator" | "sheet";

export interface RangerFeaturePickersProps {
  enemySlotCount: number;
  terrainSlotCount: number;
  enemyPicks: FavoredEnemyPick[];
  terrains: string[];
  onEnemyPicksChange: (picks: FavoredEnemyPick[]) => void;
  onTerrainsChange: (terrains: string[]) => void;
  enemyRules: string;
  terrainRules: string;
  variant: RangerPickerVariant;
  /** When set, only render enemy or terrain pickers. */
  mode?: "both" | "enemy" | "terrain";
}

function updateEnemyPick(
  picks: FavoredEnemyPick[],
  index: number,
  patch: Partial<FavoredEnemyPick>
): FavoredEnemyPick[] {
  return picks.map((pick, i) => (i === index ? { ...pick, ...patch } : pick));
}

export function RangerFeaturePickers({
  enemySlotCount,
  terrainSlotCount,
  enemyPicks,
  terrains,
  onEnemyPicksChange,
  onTerrainsChange,
  enemyRules,
  terrainRules,
  variant,
  mode = "both",
}: RangerFeaturePickersProps) {
  const isCreator = variant === "creator";
  const labelClass = isCreator ? "candy-label" : "text-sm font-medium";
  const inputClass = isCreator ? "candy-input" : undefined;
  const mutedClass = isCreator
    ? "retro-muted text-sm whitespace-pre-wrap"
    : "text-sm text-muted-foreground whitespace-pre-wrap";

  const filledEnemies = enemyPicks
    .map((pick) =>
      pick.enemy ? formatFavoredEnemyDisplay(pick.enemy, pick.humanoidSpecies) : null
    )
    .filter((value): value is string => !!value);
  const filledTerrains = terrains.filter((terrain) => terrain.trim());

  const enemySelection =
    filledEnemies.length > 0
      ? filledEnemies.map((value, index) => `${filledEnemies.length > 1 ? `${index + 1}. ` : ""}${value}`).join("\n")
      : null;
  const terrainSelection =
    filledTerrains.length > 0
      ? filledTerrains
          .map((value, index) => `${filledTerrains.length > 1 ? `${index + 1}. ` : ""}${value}`)
          .join("\n")
      : null;

  function renderEnemySelect(index: number) {
    const pick = enemyPicks[index] ?? { enemy: "", humanoidSpecies: [] };
    const slotLabel = enemySlotCount > 1 ? ` (${index + 1})` : "";

    if (isCreator) {
      return (
        <div key={`enemy-${index}`} className="space-y-2">
          <label className={labelClass}>Favored enemy{slotLabel}</label>
          <select
            className={inputClass ?? "candy-input"}
            value={pick.enemy}
            onChange={(e) => {
              const enemy = e.target.value;
              onEnemyPicksChange(
                updateEnemyPick(enemyPicks, index, {
                  enemy,
                  humanoidSpecies:
                    enemy === TWO_HUMANOID_SPECIES_OPTION ? pick.humanoidSpecies : [],
                })
              );
            }}
          >
            <option value="">{choicePlaceholder("favoredEnemy")}</option>
            {FAVORED_ENEMIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {pick.enemy === TWO_HUMANOID_SPECIES_OPTION ? (
            <>
              <label className={labelClass}>Humanoid species (pick 2){slotLabel}</label>
              <HumanoidSpeciesPicker
                selected={pick.humanoidSpecies}
                onChange={(ids) =>
                  onEnemyPicksChange(
                    updateEnemyPick(enemyPicks, index, { humanoidSpecies: ids })
                  )
                }
                variant="creator"
              />
            </>
          ) : null}
          {pick.enemy ? (
            <p className={mutedClass}>{enemyRules}</p>
          ) : null}
        </div>
      );
    }

    return (
      <div key={`enemy-${index}`} className="space-y-2">
        {enemySlotCount > 1 ? (
          <p className="text-xs text-muted-foreground">Favored enemy {index + 1}</p>
        ) : null}
        <Select
          value={pick.enemy || undefined}
          onValueChange={(value) => {
            const enemy = value ?? "";
            onEnemyPicksChange(
              updateEnemyPick(enemyPicks, index, {
                enemy,
                humanoidSpecies:
                  enemy === TWO_HUMANOID_SPECIES_OPTION ? pick.humanoidSpecies : [],
              })
            );
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={choicePlaceholder("favoredEnemy")} />
          </SelectTrigger>
          <SelectContent>
            {FAVORED_ENEMIES.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pick.enemy === TWO_HUMANOID_SPECIES_OPTION ? (
          <HumanoidSpeciesPicker
            selected={pick.humanoidSpecies}
            onChange={(ids) =>
              onEnemyPicksChange(
                updateEnemyPick(enemyPicks, index, { humanoidSpecies: ids })
              )
            }
            variant="sheet"
          />
        ) : null}
        {pick.enemy ? <p className={mutedClass}>{enemyRules}</p> : null}
      </div>
    );
  }

  function renderTerrainSelect(index: number) {
    const terrain = terrains[index] ?? "";
    const slotLabel = terrainSlotCount > 1 ? ` (${index + 1})` : "";

    if (isCreator) {
      return (
        <div key={`terrain-${index}`} className="space-y-2">
          <label className={labelClass}>Favored terrain{slotLabel}</label>
          <select
            className={inputClass ?? "candy-input"}
            value={terrain}
            onChange={(e) => {
              const next = [...terrains];
              next[index] = e.target.value;
              onTerrainsChange(next);
            }}
          >
            <option value="">{choicePlaceholder("favoredTerrain")}</option>
            {FAVORED_TERRAINS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {terrain ? <p className={mutedClass}>{terrainRules}</p> : null}
        </div>
      );
    }

    return (
      <div key={`terrain-${index}`} className="space-y-2">
        {terrainSlotCount > 1 ? (
          <p className="text-xs text-muted-foreground">Favored terrain {index + 1}</p>
        ) : null}
        <Select
          value={terrain || undefined}
          onValueChange={(value) => {
            const next = [...terrains];
            next[index] = value ?? "";
            onTerrainsChange(next);
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={choicePlaceholder("favoredTerrain")} />
          </SelectTrigger>
          <SelectContent>
            {FAVORED_TERRAINS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {terrain ? <p className={mutedClass}>{terrainRules}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mode !== "terrain" ? (
        <div className="space-y-3">
          {Array.from({ length: enemySlotCount }, (_, index) => renderEnemySelect(index))}
          {mode === "enemy" ? null : (
            <p className={mutedClass}>
              {buildChoiceDescription(enemyRules, enemySelection)}
            </p>
          )}
        </div>
      ) : null}
      {mode !== "enemy" ? (
        <div className="space-y-3">
          {Array.from({ length: terrainSlotCount }, (_, index) => renderTerrainSelect(index))}
          {mode === "terrain" ? null : (
            <p className={mutedClass}>
              {buildChoiceDescription(terrainRules, terrainSelection)}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
