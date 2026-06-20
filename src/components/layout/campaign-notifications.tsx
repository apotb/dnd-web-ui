"use client";

import { useState } from "react";
import { saveCharacterData } from "@/lib/character/save-character-data";
import type { ParsedCharacter } from "@/lib/character/utils";
import {
  getFoodItems,
  getWaterItems,
  markFed,
  markWatered,
  needsFood,
  needsWater,
} from "@/lib/dnd/supplies";
import { useRealtimeCharacter } from "@/lib/hooks/use-realtime-character";
import { useRealtimeWorldData } from "@/lib/hooks/use-realtime-world-data";
import type { InventoryItem } from "@/lib/schemas/character";
import {
  getCampaignCalendarDate,
  type WorldData,
} from "@/lib/schemas/world";

type SupplyKind = "food" | "water";

const FOOD_NOTIFICATION_IMAGE = "/food-notification.png";
const WATER_NOTIFICATION_IMAGE = "/water-notification.png";

interface CampaignNotificationsProps {
  campaignId: string;
  userId: string | null;
  ownedCharacterId: string | null;
  initialCharacter: ParsedCharacter | null;
  initialWorldData: WorldData;
  isDm: boolean;
}

function SupplyPicker({
  kind,
  items,
  onSelect,
  onCancel,
  saving,
}: {
  kind: SupplyKind;
  items: InventoryItem[];
  onSelect: (itemId: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const title = kind === "food" ? "Eat something" : "Drink something";
  const empty =
    kind === "food"
      ? "No food in your inventory. Add rations to your sheet."
      : "No water in your inventory. Add a waterskin to your sheet.";

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="retro-box-title">{title}</p>
        {items.length === 0 ? (
          <p className="retro-muted">{empty}</p>
        ) : (
          <ul className="supply-picker-list">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="supply-picker-item"
                  disabled={saving}
                  onClick={() => onSelect(item.id)}
                >
                  <span>{item.name || "Unnamed item"}</span>
                  <span className="retro-muted">×{item.quantity}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="supply-picker-actions">
          <button
            type="button"
            className="candy-btn"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function CampaignNotifications({
  campaignId,
  userId,
  ownedCharacterId,
  initialCharacter,
  initialWorldData,
  isDm,
}: CampaignNotificationsProps) {
  const worldData = useRealtimeWorldData(campaignId, initialWorldData);
  const character = useRealtimeCharacter(
    ownedCharacterId,
    initialCharacter,
    isDm
  );
  const [activePicker, setActivePicker] = useState<SupplyKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!userId || !ownedCharacterId || !character) return null;

  const showFood = needsFood(character.data, worldData);
  const showWater = needsWater(character.data, worldData);
  if (!showFood && !showWater && !activePicker) return null;

  const foodItems = getFoodItems(character.data);
  const waterItems = getWaterItems(character.data);
  const campaignDate = getCampaignCalendarDate(worldData);

  async function consume(kind: SupplyKind, inventoryItemId: string) {
    if (!character) return;
    setSaving(true);
    setMessage(null);

    const nextData =
      kind === "food"
        ? markFed(character.data, campaignDate, inventoryItemId)
        : markWatered(character.data, campaignDate, inventoryItemId);

    const { error } = await saveCharacterData(character.id, nextData, undefined, {
      isDm: false,
      originalData: character.data,
    });

    setSaving(false);
    if (error) {
      setMessage(error);
      return;
    }

    setActivePicker(null);
  }

  return (
    <>
      <div className="campaign-notifications-rail" aria-label="Needs attention">
        <div className="campaign-notifications">
          {showFood ? (
            <button
              type="button"
              className="campaign-notification-btn campaign-notification-btn-food"
              title="You need to eat"
              aria-label="You need to eat"
              onClick={() => setActivePicker("food")}
            >
              <img
                src={FOOD_NOTIFICATION_IMAGE}
                alt=""
                className="campaign-notification-img"
              />
            </button>
          ) : null}
          {showWater ? (
            <button
              type="button"
              className="campaign-notification-btn campaign-notification-btn-water"
              title="You need to drink"
              aria-label="You need to drink"
              onClick={() => setActivePicker("water")}
            >
              <img
                src={WATER_NOTIFICATION_IMAGE}
                alt=""
                className="campaign-notification-img"
              />
            </button>
          ) : null}
        </div>
        {message ? (
          <p className="retro-muted campaign-notification-message">{message}</p>
        ) : null}
      </div>
      {activePicker ? (
        <SupplyPicker
          kind={activePicker}
          items={activePicker === "food" ? foodItems : waterItems}
          onSelect={(itemId) => consume(activePicker, itemId)}
          onCancel={() => setActivePicker(null)}
          saving={saving}
        />
      ) : null}
    </>
  );
}
