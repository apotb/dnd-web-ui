"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resolveCombatImageUrl } from "@/lib/combat/storage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface MarkerDialogValues {
  name: string;
  tooltip: string;
  hasCollision: boolean;
  portraitFile: File | null;
  removePortrait: boolean;
}

interface MarkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  initialName?: string;
  initialTooltip?: string;
  initialHasCollision?: boolean;
  initialPortraitPath?: string | null;
  onSubmit: (values: MarkerDialogValues) => void;
}

export function MarkerDialog({
  open,
  onOpenChange,
  mode,
  initialName = "",
  initialTooltip = "",
  initialHasCollision = false,
  initialPortraitPath = null,
  onSubmit,
}: MarkerDialogProps) {
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [tooltip, setTooltip] = useState(initialTooltip);
  const [hasCollision, setHasCollision] = useState(initialHasCollision);
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [removePortrait, setRemovePortrait] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const storedPortraitUrl = useMemo(
    () => resolveCombatImageUrl(supabase, initialPortraitPath),
    [supabase, initialPortraitPath]
  );

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setTooltip(initialTooltip);
    setHasCollision(initialHasCollision);
    setPortraitFile(null);
    setRemovePortrait(false);
    setPreviewUrl(null);
  }, [open, initialName, initialTooltip, initialHasCollision, initialPortraitPath]);

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
  const canSubmit = trimmedName.length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      name: trimmedName,
      tooltip: tooltip.trim(),
      hasCollision,
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

  return (
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
  );
}
