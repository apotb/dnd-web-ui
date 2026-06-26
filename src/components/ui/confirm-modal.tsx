"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDisabled = false,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="supply-picker-overlay"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="supply-picker-modal retro-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title" id="confirm-modal-title">
          {title}
        </p>
        <p className="retro-muted">{description}</p>
        <div className="supply-picker-actions combat-roll-actions">
          <button
            type="button"
            className="candy-btn"
            onClick={onCancel}
            disabled={confirmDisabled}
          >
            {cancelLabel}
          </button>
          <div className="combat-roll-right-actions">
            <button
              type="button"
              className={`candy-btn${destructive ? " candy-btn-danger" : ""}`}
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
