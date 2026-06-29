"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatHarptosDate, type HarptosDate } from "@/lib/dnd/harptos-calendar";
import {
  formatGallons,
  getFoodNotificationInfo,
  getRequiredWaterGallons,
} from "@/lib/dnd/survival";
import {
  formatSupplyItemTooltip,
  getEndOfDaySuppliesChoiceFromData,
  getEndOfDayWaterStatus,
  getFoodItems,
  getWaterGallonsFromEndOfDayChoice,
  getWaterItems,
  type EndOfDayFoodChoice,
  type EndOfDaySuppliesChoice,
  type EndOfDayWaterElsewhereChoice,
} from "@/lib/dnd/supplies";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { InventoryItem } from "@/lib/schemas/character";
import type { WorldData } from "@/lib/schemas/world";
import { Tooltip } from "@/components/ui/tooltip";

interface DmEndOfDaySuppliesModalProps {
  characters: ParsedCharacter[];
  endingDate: HarptosDate;
  worldData: WorldData;
  initialChoices?: Record<string, EndOfDaySuppliesChoice>;
  onConfirm: (choices: Record<string, EndOfDaySuppliesChoice>) => void;
  onCancel: () => void;
  saving: boolean;
}

function WaterStepper({
  value,
  max,
  disabled,
  onChange,
}: {
  value: number;
  max: number;
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <div className="dm-end-of-day-supplies-stepper">
      <button
        type="button"
        className="dm-end-of-day-supplies-stepper-btn"
        disabled={disabled || value <= 0}
        aria-label="Use one fewer"
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span className="dm-end-of-day-supplies-stepper-value">
        {value} / {max}
      </span>
      <button
        type="button"
        className="dm-end-of-day-supplies-stepper-btn"
        disabled={disabled || value >= max}
        aria-label="Use one more"
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

function InventoryItemRow({
  item,
  kind,
  radioGroupName,
  disabled,
  selected,
  onSelect,
}: {
  item: InventoryItem;
  kind: "food" | "water";
  radioGroupName: string;
  disabled: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <Tooltip content={formatSupplyItemTooltip(item, kind)}>
        <label className="dm-end-of-day-supplies-inventory-item">
          <input
            type="radio"
            name={radioGroupName}
            checked={selected}
            disabled={disabled}
            onChange={onSelect}
          />
          <span className="dm-end-of-day-supplies-inventory-name">
            {item.name || "Unnamed item"}
          </span>
          <span className="retro-muted">×{item.quantity}</span>
        </label>
      </Tooltip>
    </li>
  );
}

function CharacterSuppliesRow({
  character,
  worldData,
  choice,
  onChange,
  disabled,
}: {
  character: ParsedCharacter;
  worldData: WorldData;
  choice: EndOfDaySuppliesChoice;
  onChange: (next: EndOfDaySuppliesChoice) => void;
  disabled: boolean;
}) {
  const requiredGallons = getRequiredWaterGallons(worldData);
  const halfGallons = requiredGallons / 2;
  const isUnclaimed = character.owner_user_id === null;
  const foodItems = getFoodItems(character.data);
  const waterItems = getWaterItems(character.data);
  const foodInfo = getFoodNotificationInfo(character.data);
  const waterGallons = getWaterGallonsFromEndOfDayChoice(choice, worldData);
  const waterStatus = getEndOfDayWaterStatus(waterGallons, worldData);
  const fed = choice.food.source !== "none";

  function setFood(food: EndOfDayFoodChoice) {
    onChange({ ...choice, food });
  }

  function setWaterCount(itemId: string, count: number) {
    onChange({
      ...choice,
      waterElsewhere: "none",
      waterItemCounts: {
        ...choice.waterItemCounts,
        [itemId]: count,
      },
    });
  }

  function setWaterElsewhere(waterElsewhere: EndOfDayWaterElsewhereChoice) {
    onChange({
      ...choice,
      waterElsewhere,
      waterItemCounts: waterElsewhere === "none" ? choice.waterItemCounts : {},
    });
  }

  function toggleWaterElsewhere(level: "half" | "full", checked: boolean) {
    setWaterElsewhere(checked ? level : "none");
  }

  const usingInventoryWater = choice.waterElsewhere === "none";

  const waterStatusLabel =
    waterStatus === "full"
      ? "fully hydrated"
      : waterStatus === "half"
        ? "half water — dehydration save"
        : "no water — exhaustion risk";

  const foodGroupName = `food-${character.id}`;

  return (
    <li className="dm-end-of-day-supplies-row">
      <div className="dm-end-of-day-supplies-character">
        <strong>{character.name}</strong>
        {isUnclaimed ? (
          <span className="retro-muted dm-end-of-day-supplies-tag">Unclaimed</span>
        ) : null}
      </div>

      <div className="dm-end-of-day-supplies-section">
        <p className="dm-end-of-day-supplies-section-title">Food</p>
        {foodInfo.daysWithoutFood > 0 ? (
          <p className="dm-end-of-day-supplies-stat retro-muted">
            {foodInfo.daysWithoutFood} / {foodInfo.maxDaysWithoutFood} days
            without food
            {foodInfo.starvationRisk ? " — starvation risk" : ""}
          </p>
        ) : null}
        <ul className="dm-end-of-day-supplies-inventory-list">
          {foodItems.length === 0 ? (
            <li className="retro-muted dm-end-of-day-supplies-empty">
              No rations in inventory
            </li>
          ) : (
            foodItems.map((item) => (
              <InventoryItemRow
                key={item.id}
                item={item}
                kind="food"
                radioGroupName={foodGroupName}
                disabled={disabled}
                selected={
                  choice.food.source === "inventory" &&
                  choice.food.itemId === item.id
                }
                onSelect={() =>
                  setFood({ source: "inventory", itemId: item.id })
                }
              />
            ))
          )}
          <li>
            <label className="dm-end-of-day-supplies-inventory-item">
              <input
                type="radio"
                name={foodGroupName}
                checked={choice.food.source === "elsewhere"}
                disabled={disabled}
                onChange={() => setFood({ source: "elsewhere" })}
              />
              <span>Ate elsewhere</span>
            </label>
          </li>
          <li>
            <label className="dm-end-of-day-supplies-inventory-item">
              <input
                type="radio"
                name={foodGroupName}
                checked={choice.food.source === "none"}
                disabled={disabled}
                onChange={() => setFood({ source: "none" })}
              />
              <span>Did not eat</span>
            </label>
          </li>
        </ul>
      </div>

      <div className="dm-end-of-day-supplies-section">
        <p className="dm-end-of-day-supplies-section-title">
          Water{" "}
          <span className="retro-muted">
            (need {formatGallons(requiredGallons)} gal / day)
          </span>
        </p>
        <ul className="dm-end-of-day-supplies-inventory-list">
          {waterItems.length === 0 ? (
            <li className="retro-muted dm-end-of-day-supplies-empty">
              No waterskins in inventory
            </li>
          ) : (
            waterItems.map((item) => {
              const count = choice.waterItemCounts[item.id] ?? 0;
              return (
                <li key={item.id} className="dm-end-of-day-supplies-water-row">
                  <Tooltip content={formatSupplyItemTooltip(item, "water")}>
                    <span className="dm-end-of-day-supplies-inventory-name">
                      {item.name || "Waterskin"}
                      <span className="retro-muted"> ×{item.quantity}</span>
                    </span>
                  </Tooltip>
                  <WaterStepper
                    value={count}
                    max={item.quantity}
                    disabled={disabled || !usingInventoryWater}
                    onChange={(next) => setWaterCount(item.id, next)}
                  />
                </li>
              );
            })
          )}
          <li>
            <label className="dm-end-of-day-supplies-inventory-item">
              <input
                type="checkbox"
                checked={choice.waterElsewhere === "half"}
                disabled={disabled}
                onChange={(event) =>
                  toggleWaterElsewhere("half", event.target.checked)
                }
              />
              <span>
                Drank elsewhere ({formatGallons(halfGallons)} gal)
              </span>
            </label>
          </li>
          <li>
            <label className="dm-end-of-day-supplies-inventory-item">
              <input
                type="checkbox"
                checked={choice.waterElsewhere === "full"}
                disabled={disabled}
                onChange={(event) =>
                  toggleWaterElsewhere("full", event.target.checked)
                }
              />
              <span>
                Drank elsewhere ({formatGallons(requiredGallons)} gal)
              </span>
            </label>
          </li>
        </ul>
        <p
          className={`dm-end-of-day-supplies-summary${
            waterStatus === "none"
              ? " dm-end-of-day-supplies-summary-risk"
              : waterStatus === "half"
                ? " dm-end-of-day-supplies-summary-warn"
                : ""
          }`}
        >
          {formatGallons(waterGallons)} gal — {waterStatusLabel}
          {" · "}
          {fed ? "Fed" : "Not fed"}
        </p>
      </div>
    </li>
  );
}

export function DmEndOfDaySuppliesModal({
  characters,
  endingDate,
  worldData,
  initialChoices,
  onConfirm,
  onCancel,
  saving,
}: DmEndOfDaySuppliesModalProps) {
  const [mounted, setMounted] = useState(false);
  const [choices, setChoices] = useState<Record<string, EndOfDaySuppliesChoice>>(
    () =>
      initialChoices ??
      Object.fromEntries(
        characters.map((character) => [
          character.id,
          getEndOfDaySuppliesChoiceFromData(
            character.data,
            endingDate,
            worldData
          ),
        ])
      )
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  function updateChoice(
    characterId: string,
    nextChoice: EndOfDaySuppliesChoice
  ) {
    setChoices((current) => ({
      ...current,
      [characterId]: nextChoice,
    }));
  }

  const modal = (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box dm-end-of-day-supplies-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">End of day supplies</p>
        <p className="retro-muted dm-end-of-day-supplies-intro">
          For {formatHarptosDate(endingDate)}, choose what unclaimed characters
          and characters you control consumed.
        </p>
        <ul className="dm-end-of-day-supplies-list">
          {characters.map((character) => (
            <CharacterSuppliesRow
              key={character.id}
              character={character}
              worldData={worldData}
              choice={
                choices[character.id] ??
                getEndOfDaySuppliesChoiceFromData(
                  character.data,
                  endingDate,
                  worldData
                )
              }
              onChange={(next) => updateChoice(character.id, next)}
              disabled={saving}
            />
          ))}
        </ul>
        <div className="supply-picker-actions">
          <button
            type="button"
            className="candy-btn"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="candy-btn"
            onClick={() => onConfirm(choices)}
            disabled={saving}
          >
            {saving ? "..." : "Next Day"}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
