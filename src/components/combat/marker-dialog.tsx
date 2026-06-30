"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resolveCombatImageUrl } from "@/lib/combat/storage";
import {
  EMPTY_ITEM_PICKER_CUSTOM_FIELDS,
  ItemPicker,
  type ItemPickerCustomFields,
} from "@/components/items/item-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Item } from "@/lib/schemas/item";

export interface MarkerDialogValues {
  name: string;
  tooltip: string;
  hasCollision: boolean;
  isObject: boolean;
  itemPickup: boolean;
  pickupItemId?: string;
  pickupQuantity: number;
  portraitFile: File | null;
  removePortrait: boolean;
}

interface MarkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  catalogItems: Record<string, Item>;
  initialName?: string;
  initialTooltip?: string;
  initialHasCollision?: boolean;
  initialIsObject?: boolean;
  initialItemPickup?: boolean;
  initialPickupItemId?: string;
  initialPickupQuantity?: number;
  initialPortraitPath?: string | null;
  onSubmit: (values: MarkerDialogValues) => void;
}

export function MarkerDialog({
  open,
  onOpenChange,
  mode,
  catalogItems,
  initialName = "",
  initialTooltip = "",
  initialHasCollision = false,
  initialIsObject = false,
  initialItemPickup = false,
  initialPickupItemId,
  initialPickupQuantity = 1,
  initialPortraitPath = null,
  onSubmit,
}: MarkerDialogProps) {
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [tooltip, setTooltip] = useState(initialTooltip);
  const [hasCollision, setHasCollision] = useState(initialHasCollision);
  const [isObject, setIsObject] = useState(initialIsObject);
  const [itemPickup, setItemPickup] = useState(initialItemPickup);
  const [pickupItemId, setPickupItemId] = useState<string | undefined>(initialPickupItemId);
  const [pickupQuantity, setPickupQuantity] = useState(initialPickupQuantity);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [customFields, setCustomFields] = useState<ItemPickerCustomFields>(
    EMPTY_ITEM_PICKER_CUSTOM_FIELDS
  );
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [removePortrait, setRemovePortrait] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const storedPortraitUrl = useMemo(
    () => resolveCombatImageUrl(supabase, initialPortraitPath),
    [supabase, initialPortraitPath]
  );

  const selectedPickupItem = pickupItemId ? catalogItems[pickupItemId] : null;

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setTooltip(initialTooltip);
    setHasCollision(initialHasCollision);
    setIsObject(initialIsObject);
    setItemPickup(initialItemPickup);
    setPickupItemId(initialPickupItemId);
    setPickupQuantity(initialPickupQuantity);
    setCustomFields(EMPTY_ITEM_PICKER_CUSTOM_FIELDS);
    setPortraitFile(null);
    setRemovePortrait(false);
    setPreviewUrl(null);
  }, [
    open,
    initialName,
    initialTooltip,
    initialHasCollision,
    initialIsObject,
    initialItemPickup,
    initialPickupItemId,
    initialPickupQuantity,
    initialPortraitPath,
  ]);

  useEffect(() => {
    if (!portraitFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(portraitFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [portraitFile]);

  const displayPortraitUrl =
    previewUrl ?? (removePortrait ? null : storedPortraitUrl);
  const trimmedName = name.trim();
  const pickupValid = !itemPickup || Boolean(pickupItemId?.trim());
  const canSubmit = trimmedName.length > 0 && pickupValid;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      name: trimmedName,
      tooltip: tooltip.trim(),
      hasCollision,
      isObject,
      itemPickup: isObject && itemPickup,
      pickupItemId: isObject && itemPickup ? pickupItemId : undefined,
      pickupQuantity: Math.max(1, pickupQuantity || 1),
      portraitFile,
      removePortrait,
    });
    onOpenChange(false);
  }

  function handleFileSelected(file: File) {
    setPortraitFile(file);
    setRemovePortrait(false);
  }

  function handleRemovePortrait() {
    setPortraitFile(null);
    setRemovePortrait(true);
  }

  function handleObjectToggle(checked: boolean) {
    setIsObject(checked);
    if (!checked) {
      setItemPickup(false);
      setPickupItemId(undefined);
    }
  }

  function handleItemPickupToggle(checked: boolean) {
    setItemPickup(checked);
    if (!checked) {
      setPickupItemId(undefined);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === "add" ? "Add marker" : "Edit marker"}</DialogTitle>
          </DialogHeader>

          <div className="combat-marker-dialog-portrait">
            <div
              className={`combat-marker-dialog-portrait-frame${
                displayPortraitUrl ? "" : " combat-marker-dialog-portrait-frame-empty"
              }`}
            >
              {displayPortraitUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayPortraitUrl}
                  alt=""
                  className="combat-marker-dialog-portrait-image"
                />
              ) : (
                <ImageIcon
                  className="combat-marker-dialog-portrait-placeholder"
                  strokeWidth={1.25}
                  aria-hidden
                />
              )}
            </div>
            <div className="combat-marker-dialog-portrait-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) handleFileSelected(file);
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                {displayPortraitUrl ? "Replace image" : "Upload image"}
              </Button>
              {displayPortraitUrl ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleRemovePortrait}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>

          <label className="combat-marker-dialog-field">
            <span className="retro-muted">Name</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Marker name"
              autoFocus
            />
          </label>

          <label className="combat-marker-dialog-field">
            <span className="retro-muted">Tooltip</span>
            <textarea
              className="candy-input combat-marker-dialog-tooltip"
              value={tooltip}
              onChange={(event) => setTooltip(event.target.value)}
              placeholder="Optional details shown on hover"
              rows={4}
            />
          </label>

          <label className="combat-marker-dialog-field combat-marker-dialog-checkbox">
            <Checkbox
              checked={hasCollision}
              onCheckedChange={(checked) => setHasCollision(checked === true)}
            />
            <span>
              <span className="retro-muted">Collision</span>
              <span className="combat-marker-dialog-checkbox-hint">
                Blocks movement pathfinding when enabled
              </span>
            </span>
          </label>

          <label className="combat-marker-dialog-field combat-marker-dialog-checkbox">
            <Checkbox
              checked={isObject}
              onCheckedChange={(checked) => handleObjectToggle(checked === true)}
            />
            <span>
              <span className="retro-muted">Object</span>
              <span className="combat-marker-dialog-checkbox-hint">
                Marker can be interacted with on the battlefield
              </span>
            </span>
          </label>

          {isObject ? (
            <div className="combat-marker-dialog-object-settings">
              <label className="combat-marker-dialog-field combat-marker-dialog-checkbox">
                <Checkbox
                  checked={itemPickup}
                  onCheckedChange={(checked) => handleItemPickupToggle(checked === true)}
                />
                <span>
                  <span className="retro-muted">Item pickup</span>
                  <span className="combat-marker-dialog-checkbox-hint">
                    Adjacent characters can pick up a catalog item
                  </span>
                </span>
              </label>

              {itemPickup ? (
                <div className="combat-marker-dialog-pickup">
                  {selectedPickupItem ? (
                    <div className="combat-marker-dialog-pickup-selected">
                      <span>{selectedPickupItem.name}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label="Clear selected item"
                        onClick={() => setPickupItemId(undefined)}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setItemPickerOpen(true)}
                    >
                      Choose catalog item
                    </Button>
                  )}

                  <label className="combat-marker-dialog-field">
                    <span className="retro-muted">Quantity</span>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={pickupQuantity}
                      onChange={(event) => {
                        const parsed = parseInt(event.target.value, 10);
                        setPickupQuantity(Number.isFinite(parsed) ? Math.max(1, parsed) : 1);
                      }}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="combat-marker-dialog-actions">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
              {mode === "add" ? "Add marker" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ItemPicker
        open={itemPickerOpen}
        onClose={() => setItemPickerOpen(false)}
        customFields={customFields}
        onCustomFieldsChange={setCustomFields}
        onSelect={(selection) => {
          if (selection.source === "catalog") {
            setPickupItemId(selection.item.slug);
          }
          setItemPickerOpen(false);
        }}
      />
    </>
  );
}
