"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { saveCharacterData } from "@/lib/character/save-character-data";
import type { ParsedCharacter } from "@/lib/character/utils";
import {
  getFoodItems,
  getWaterItems,
  formatSupplyItemTooltip,
  ELSEWHERE_WATER_GALLONS,
  hasEnoughWaterToday,
  markFed,
  markFedManually,
  markWatered,
  markWateredElsewhere,
  needsFood,
  needsWater,
} from "@/lib/dnd/supplies";
import {
  formatGallons,
  getFoodNotificationInfo,
  getWaterNotificationInfo,
} from "@/lib/dnd/survival";
import { useRealtimeCharacter } from "@/lib/hooks/use-realtime-character";
import { useRealtimeWorldData } from "@/lib/hooks/use-realtime-world-data";
import {
  groupNotificationsByCategory,
  type CampaignNotificationItem,
  type NotificationAlertLevel,
} from "@/lib/notifications/categories";
import type { CharacterData, InventoryItem } from "@/lib/schemas/character";
import {
  getCampaignCalendarDate,
  type WorldData,
} from "@/lib/schemas/world";

import { DehydrationSaveModal } from "@/components/layout/dehydration-save-modal";
import { DeathSceneModal } from "@/components/layout/death-scene-modal";
import { InitiativeRollModal } from "@/components/layout/initiative-roll-modal";
import { ShortRestHealModal } from "@/components/character/short-rest-heal-modal";
import { LevelUpModal } from "@/components/character/level-up-modal";
import { Tooltip } from "@/components/ui/tooltip";
import {
  getExhaustionDeathMessage,
  getExhaustionModifiers,
} from "@/lib/dnd/exhaustion";
import { canCharacterLevelUp, getCharacterNextLevelUpTarget } from "@/lib/dnd/xp";

type SupplyKind = "food" | "water";

const FOOD_NOTIFICATION_IMAGE = "/food-notification.png";
const WATER_NOTIFICATION_IMAGE = "/water-notification.png";
const LEVEL_UP_NOTIFICATION_IMAGE = "/level-up-notification.png";

interface CampaignNotificationsProps {
  campaignId: string;
  userId: string | null;
  ownedCharacterId: string | null;
  initialCharacter: ParsedCharacter | null;
  initialWorldData: WorldData;
  isDm: boolean;
}

function CriticalAlertBadge() {
  return (
    <span
      className="campaign-notification-category-badge campaign-notification-category-badge-critical"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="campaign-notification-category-icon"
        aria-hidden="true"
      >
        <rect x="10.25" y="4.5" width="3.5" height="11" rx="1.75" fill="currentColor" />
        <circle cx="12" cy="19.25" r="2.25" fill="currentColor" />
      </svg>
    </span>
  );
}

function ReminderAlertBadge() {
  return (
    <span
      className="campaign-notification-category-badge campaign-notification-category-badge-reminder"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="campaign-notification-category-icon"
        aria-hidden="true"
      >
        <path
          d="M12 3c-1.1 0-2 .9-2 2v.3A6 6 0 0 0 6 11v4l-2 2v1h16v-1l-2-2v-4a6 6 0 0 0-4-5.7V5c0-1.1-.9-2-2-2zm-1 17h2a1 1 0 0 0-2 0z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

function CategoryBadge({ level }: { level: NotificationAlertLevel }) {
  return level === "critical" ? <CriticalAlertBadge /> : <ReminderAlertBadge />;
}

function NotificationButton({ item }: { item: CampaignNotificationItem }) {
  return (
    <div className="campaign-notification-wrap">
      <button
        type="button"
        className={`campaign-notification-btn${item.imageClassName ? ` ${item.imageClassName}` : ""}`}
        title={item.title}
        aria-label={item.ariaLabel}
        onClick={item.onClick}
      >
        <img src={item.imageSrc} alt="" className="campaign-notification-img" />
      </button>
      {item.category === "alert" ? (
        <CategoryBadge level={item.alertLevel} />
      ) : null}
    </div>
  );
}

function SupplyPicker({
  kind,
  data,
  worldData,
  items,
  onSelect,
  onManual,
  onCancel,
  saving,
}: {
  kind: SupplyKind;
  data: CharacterData;
  worldData: WorldData;
  items: InventoryItem[];
  onSelect: (itemId: string) => void;
  onManual: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const title = kind === "food" ? "Eat something" : "Drink something";
  const empty =
    kind === "food"
      ? "No rations in inventory."
      : "No waterskins in inventory.";
  const manualLabel =
    kind === "food"
      ? "Ate elsewhere"
      : `Drank elsewhere (${formatGallons(ELSEWHERE_WATER_GALLONS)} gal)`;
  const manualHint =
    kind === "food"
      ? "Mark today as fed without using rations."
      : `Adds ${formatGallons(ELSEWHERE_WATER_GALLONS)} gal without using a waterskin.`;

  const foodInfo = kind === "food" ? getFoodNotificationInfo(data) : null;
  const waterInfo = kind === "water" ? getWaterNotificationInfo(data, worldData) : null;
  const atMaxHydration =
    kind === "water" && hasEnoughWaterToday(data, worldData);

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="retro-box-title">{title}</p>
        {kind === "food" && foodInfo ? (
          <div className="supply-picker-summary">
            <p className="supply-picker-stat">
              {foodInfo.daysWithoutFood} / {foodInfo.maxDaysWithoutFood} days
              without food
            </p>
            {foodInfo.starvationRisk ? (
              <p className="supply-picker-warning">
                If you don&apos;t eat you will starve!
              </p>
            ) : null}
          </div>
        ) : null}
        {kind === "water" && waterInfo ? (
          <div className="supply-picker-summary">
            <p className="supply-picker-stat">
              {formatGallons(waterInfo.consumedGallons)} /{" "}
              {formatGallons(waterInfo.requiredGallons)} gal consumed today
            </p>
            {waterInfo.needsHalfMessage ? (
              <p className="supply-picker-note">
                Drink at least half your daily water for a chance to avoid
                dehydration.
              </p>
            ) : null}
          </div>
        ) : null}
        <ul className="supply-picker-list">
          {items.length === 0 ? (
            <li className="supply-picker-empty retro-muted">{empty}</li>
          ) : (
            items.map((item) => (
              <li key={item.id}>
                <Tooltip content={formatSupplyItemTooltip(item, kind)}>
                  <button
                    type="button"
                    className="supply-picker-item"
                    disabled={saving || atMaxHydration}
                    onClick={() => onSelect(item.id)}
                  >
                    <span>{item.name || "Unnamed item"}</span>
                    <span className="retro-muted">×{item.quantity}</span>
                  </button>
                </Tooltip>
              </li>
            ))
          )}
          <li>
            <Tooltip content={manualHint}>
              <button
                type="button"
                className="supply-picker-item"
                disabled={saving || atMaxHydration}
                onClick={onManual}
              >
                <span>{manualLabel}</span>
              </button>
            </Tooltip>
          </li>
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
  const [mounted, setMounted] = useState(false);
  const [dehydrationSaveOpen, setDehydrationSaveOpen] = useState(false);
  const [initiativeRollOpen, setInitiativeRollOpen] = useState(false);
  const [shortRestHealOpen, setShortRestHealOpen] = useState(false);
  const [deathSceneOpen, setDeathSceneOpen] = useState(false);
  const [levelUpOpen, setLevelUpOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hasPendingDehydrationSave =
    !!character?.data.supplies.pendingDehydrationSave;
  const hasPendingInitiativeRoll = !!character?.data.combat.pendingInitiativeRoll;
  const hasPendingShortRest = !!character?.data.combat.pendingShortRest;
  const isDead = character
    ? getExhaustionModifiers(character.data).isDead
    : false;
  const deathMessage = character
    ? getExhaustionDeathMessage(character.data)
    : null;

  useEffect(() => {
    if (hasPendingDehydrationSave) {
      setDehydrationSaveOpen(true);
    }
  }, [hasPendingDehydrationSave]);

  useEffect(() => {
    if (hasPendingInitiativeRoll) {
      setInitiativeRollOpen(true);
    }
  }, [hasPendingInitiativeRoll]);

  useEffect(() => {
    if (hasPendingShortRest) {
      setShortRestHealOpen(true);
    }
  }, [hasPendingShortRest]);

  useEffect(() => {
    if (isDead) {
      setDeathSceneOpen(true);
    }
  }, [isDead]);

  const showFood = character
    ? needsFood(character.data, worldData)
    : false;
  const showWater = character
    ? needsWater(character.data, worldData)
    : false;
  const showLevelUp = character ? canCharacterLevelUp(character.data) : false;
  const nextLevelTarget = character
    ? getCharacterNextLevelUpTarget(character.data)
    : null;

  const notifications = useMemo(() => {
    if (!character) return [];

    const items: CampaignNotificationItem[] = [];

    if (showLevelUp && nextLevelTarget) {
      items.push({
        id: "level-up",
        category: "alert",
        title: `Level up to ${nextLevelTarget}`,
        ariaLabel: "Level up",
        imageSrc: LEVEL_UP_NOTIFICATION_IMAGE,
        imageClassName: "campaign-notification-btn-level-up",
        alertLevel: "reminder",
        onClick: () => setLevelUpOpen(true),
      });
    }

    if (showFood) {
      const foodInfo = getFoodNotificationInfo(character.data);
      items.push({
        id: "food",
        category: "alert",
        title: "Eat something",
        ariaLabel: "Eat something",
        imageSrc: FOOD_NOTIFICATION_IMAGE,
        imageClassName: "campaign-notification-btn-food",
        alertLevel: foodInfo.starvationRisk ? "critical" : "reminder",
        onClick: () => setActivePicker("food"),
      });
    }

    if (showWater) {
      const waterInfo = getWaterNotificationInfo(character.data, worldData);
      items.push({
        id: "water",
        category: "alert",
        title: "Drink something",
        ariaLabel: "Drink something",
        imageSrc: WATER_NOTIFICATION_IMAGE,
        imageClassName: "campaign-notification-btn-water",
        alertLevel: waterInfo.dehydrationRisk ? "critical" : "reminder",
        onClick: () => setActivePicker("water"),
      });
    }

    return groupNotificationsByCategory(items);
  }, [character, showFood, showWater, showLevelUp, nextLevelTarget, worldData]);

  if (!userId || !ownedCharacterId || !character) return null;

  const showRail = showFood || showWater || showLevelUp;

  const foodItems = getFoodItems(character.data);
  const waterItems = getWaterItems(character.data);
  const campaignDate = getCampaignCalendarDate(worldData);

  async function consume(kind: SupplyKind, inventoryItemId: string | null) {
    if (!character) return;
    setSaving(true);
    setMessage(null);

    const nextData =
      kind === "food"
        ? inventoryItemId
          ? markFed(character.data, campaignDate, inventoryItemId)
          : markFedManually(character.data, campaignDate)
        : inventoryItemId
          ? markWatered(
              character.data,
              campaignDate,
              inventoryItemId,
              worldData
            )
          : markWateredElsewhere(character.data, campaignDate, worldData);

    const { error } = await saveCharacterData(character.id, nextData, undefined, {
      isDm: false,
      originalData: character.data,
    });

    setSaving(false);
    if (error) {
      setMessage(error);
      return;
    }

    if (kind === "food" || hasEnoughWaterToday(nextData, worldData)) {
      setActivePicker(null);
    }
  }

  if (!showRail && !dehydrationSaveOpen && !initiativeRollOpen && !shortRestHealOpen && !deathSceneOpen && !levelUpOpen && !activePicker) return null;

  const modals = (
    <>
      {deathSceneOpen && deathMessage ? (
        <DeathSceneModal
          message={deathMessage}
          onDismiss={() => setDeathSceneOpen(false)}
        />
      ) : null}
      {dehydrationSaveOpen ? (
        <DehydrationSaveModal
          characterId={character.id}
          data={character.data}
          originalData={character.data}
          onComplete={() => {
            setDehydrationSaveOpen(false);
            setMessage(null);
          }}
        />
      ) : null}
      {initiativeRollOpen ? (
        <InitiativeRollModal
          campaignId={campaignId}
          characterId={character.id}
          data={character.data}
          onComplete={() => {
            setInitiativeRollOpen(false);
            setMessage(null);
          }}
        />
      ) : null}
      {shortRestHealOpen ? (
        <ShortRestHealModal
          data={character.data}
          onApply={async (next) => {
            setSaving(true);
            setMessage(null);
            const { error } = await saveCharacterData(
              character.id,
              next,
              undefined,
              { isDm: false, originalData: character.data }
            );
            setSaving(false);
            if (error) {
              setMessage(error);
              return;
            }
            if (!next.combat.pendingShortRest) {
              setShortRestHealOpen(false);
            }
          }}
        />
      ) : null}
      {levelUpOpen && character ? (
        <LevelUpModal
          characterId={character.id}
          data={character.data}
          originalData={character.data}
          onCancel={() => {
            setLevelUpOpen(false);
            setMessage(null);
          }}
          onComplete={() => {
            setLevelUpOpen(false);
            setMessage(null);
          }}
        />
      ) : null}
      {activePicker ? (
        <SupplyPicker
          kind={activePicker}
          data={character.data}
          worldData={worldData}
          items={activePicker === "food" ? foodItems : waterItems}
          onSelect={(itemId) => consume(activePicker, itemId)}
          onManual={() => consume(activePicker, null)}
          onCancel={() => setActivePicker(null)}
          saving={saving}
        />
      ) : null}
    </>
  );

  return (
    <>
      {showRail ? (
        <div className="campaign-notifications-rail" aria-label="Notifications">
          <div className="campaign-notifications">
            {notifications.map(({ category, items }) => (
              <div
                key={category.id}
                className="campaign-notification-category"
                aria-label={category.label}
              >
                {items.map((item) => (
                  <NotificationButton key={item.id} item={item} />
                ))}
              </div>
            ))}
          </div>
          {message ? (
            <p className="retro-muted campaign-notification-message">{message}</p>
          ) : null}
        </div>
      ) : null}
      {mounted ? createPortal(modals, document.body) : null}
    </>
  );
}
