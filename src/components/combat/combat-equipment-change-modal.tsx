"use client";

import { useMemo, useState } from "react";
import {
  canEquipInventoryItem,
  canWieldMainHand,
  canWieldOffHand,
  getEffectiveWieldMain,
  getEffectiveWieldOff,
  getItemEquipSlot,
  isEquippableItem,
  isOneHandedWeapon,
  setItemEquipped,
  setWeaponWield,
  sortInventoryForDisplay,
} from "@/lib/character/equip-rules";
import {
  countEquipmentToggles,
  describeObjectInteractionCost,
  getAvailableObjectInteractions,
} from "@/lib/combat/object-equipment-change";
import type { InventoryItem } from "@/lib/schemas/character";
import type { CombatTurn } from "@/lib/schemas/combat-state";
import type { Item } from "@/lib/schemas/item";
import { hasNaturalArmorSpecies } from "@/lib/dnd/phb/species-mechanics";

interface CombatEquipmentChangeModalProps {
  initialItems: InventoryItem[];
  catalogItems: Record<string, Item>;
  speciesDisplayName: string;
  turn: Pick<CombatTurn, "freeObjectInteractionUsed" | "actionUsed">;
  submitting?: boolean;
  onConfirm: (nextItems: InventoryItem[]) => void;
  onCancel: () => void;
}

export function CombatEquipmentChangeModal({
  initialItems,
  catalogItems,
  speciesDisplayName,
  turn,
  submitting = false,
  onConfirm,
  onCancel,
}: CombatEquipmentChangeModalProps) {
  const [draftItems, setDraftItems] = useState<InventoryItem[]>(() =>
    initialItems.map((item) => ({ ...item }))
  );

  const sortedRows = useMemo(
    () => sortInventoryForDisplay(draftItems, catalogItems, speciesDisplayName),
    [catalogItems, draftItems, speciesDisplayName]
  );

  const equippableRows = sortedRows.filter(({ item, index }) => {
    const catalog = item.itemId ? catalogItems[item.itemId] ?? null : null;
    return (
      isEquippableItem(catalog, item) &&
      canEquipInventoryItem(catalog, item, speciesDisplayName)
    );
  });

  const toggleCount = countEquipmentToggles(initialItems, draftItems, catalogItems);
  const availableInteractions = getAvailableObjectInteractions(turn);
  const costLabel = describeObjectInteractionCost(toggleCount, turn);
  const canConfirm =
    toggleCount > 0 && toggleCount <= availableInteractions && !submitting;
  const usesNaturalArmor = hasNaturalArmorSpecies(speciesDisplayName);

  function applyWeaponToggle(index: number, hand: "main" | "off", wield: boolean) {
    setDraftItems((items) => setWeaponWield(items, index, hand, wield, catalogItems));
  }

  function applyWornToggle(index: number, equipped: boolean) {
    setDraftItems((items) =>
      setItemEquipped(items, index, equipped, catalogItems, speciesDisplayName)
    );
  }

  function handleReset() {
    setDraftItems(initialItems.map((item) => ({ ...item })));
  }

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-equipment-change-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Change Equipment</p>
        <p className="retro-muted">
          Each draw, sheath, equip, or unequip uses one object interaction. Your
          first interaction each turn is free; a second costs your action.
        </p>
        {equippableRows.length === 0 ? (
          <p className="retro-muted">No equippable items in your inventory.</p>
        ) : (
          <ul className="combat-equipment-change-list">
            {equippableRows.map(({ item, index }) => {
              const catalogItem = item.itemId ? catalogItems[item.itemId] ?? null : null;
              const displayName = catalogItem?.name ?? (item.name || "Unknown item");
              const equipSlot = getItemEquipSlot(catalogItem, item);
              const isWeapon = equipSlot === "weapon";
              const isArmor = equipSlot === "armor";
              const isShield = equipSlot === "shield";
              const wieldMain =
                item.wieldMain ||
                (getEffectiveWieldMain(item, catalogItem) && !item.wieldOff);
              const wieldOff = getEffectiveWieldOff(item);
              const showOffHand = isWeapon && isOneHandedWeapon(catalogItem);
              const mainHandEnabled = canWieldMainHand(draftItems, index, catalogItems);
              const offHandEnabled = canWieldOffHand(draftItems, index, catalogItems);
              const canToggleWornGear =
                (isShield || !usesNaturalArmor) && (isArmor || isShield);

              return (
                <li key={item.id} className="combat-equipment-change-row">
                  <span className="combat-equipment-change-name">{displayName}</span>
                  <div className="combat-equipment-change-actions">
                    {isWeapon ? (
                      <>
                        {wieldMain ? (
                          <button
                            type="button"
                            className="candy-btn candy-btn-sm"
                            disabled={submitting}
                            onClick={() => applyWeaponToggle(index, "main", false)}
                          >
                            Sheath main
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="candy-btn candy-btn-sm"
                            disabled={submitting || !mainHandEnabled}
                            onClick={() => applyWeaponToggle(index, "main", true)}
                          >
                            Draw main
                          </button>
                        )}
                        {showOffHand ? (
                          wieldOff ? (
                            <button
                              type="button"
                              className="candy-btn candy-btn-sm"
                              disabled={submitting}
                              onClick={() => applyWeaponToggle(index, "off", false)}
                            >
                              Sheath off-hand
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="candy-btn candy-btn-sm"
                              disabled={submitting || !offHandEnabled}
                              onClick={() => applyWeaponToggle(index, "off", true)}
                            >
                              Draw off-hand
                            </button>
                          )
                        ) : null}
                      </>
                    ) : canToggleWornGear ? (
                      item.equipped ? (
                        <button
                          type="button"
                          className="candy-btn candy-btn-sm"
                          disabled={submitting}
                          onClick={() => applyWornToggle(index, false)}
                        >
                          Unequip
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="candy-btn candy-btn-sm"
                          disabled={submitting}
                          onClick={() => applyWornToggle(index, true)}
                        >
                          Equip
                        </button>
                      )
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {toggleCount > availableInteractions ? (
          <p className="combat-equipment-change-warning">
            Too many changes for your remaining object interactions this turn.
          </p>
        ) : costLabel ? (
          <p className="combat-equipment-change-cost">{costLabel}</p>
        ) : null}
        <div className="supply-picker-actions combat-equipment-change-footer">
          <button type="button" className="candy-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="candy-btn"
            disabled={submitting || toggleCount === 0}
            onClick={handleReset}
          >
            Reset
          </button>
          <button
            type="button"
            className="candy-btn candy-btn-primary"
            disabled={!canConfirm}
            onClick={() => onConfirm(draftItems)}
          >
            {submitting ? "…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
