"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface EnemyTokenDialogValues {
  displayName: string;
}

interface EnemyTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLabel: string;
  catalogName: string;
  initialDisplayName?: string;
  onSubmit: (values: EnemyTokenDialogValues) => void;
}

export function EnemyTokenDialog({
  open,
  onOpenChange,
  defaultLabel,
  catalogName,
  initialDisplayName = "",
  onSubmit,
}: EnemyTokenDialogProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);

  useEffect(() => {
    if (!open) return;
    setDisplayName(initialDisplayName);
  }, [open, initialDisplayName]);

  function handleSubmit() {
    onSubmit({ displayName: displayName.trim() });
    onOpenChange(false);
  }

  function handleClear() {
    setDisplayName("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit enemy token</DialogTitle>
        </DialogHeader>

        <p className="retro-muted text-sm">
          Catalog name: {catalogName}
          {defaultLabel !== catalogName ? ` · Default label: ${defaultLabel}` : null}
        </p>

        <label className="combat-marker-dialog-field">
          <span className="retro-muted">Display name</span>
          <Input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={defaultLabel}
            autoFocus
          />
        </label>
        <p className="retro-muted text-xs">
          Leave blank to use the default label. A custom name always takes priority on the board
          and in combat.
        </p>

        <div className="combat-marker-dialog-actions">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="ghost" onClick={handleClear}>
            Use default
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
