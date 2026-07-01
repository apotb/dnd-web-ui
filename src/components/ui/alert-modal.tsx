"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface AlertModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  onClose: () => void;
}

export function AlertModal({
  open,
  title = "Notice",
  message,
  confirmLabel = "OK",
  confirmDisabled = false,
  onClose,
}: AlertModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="supply-picker-overlay"
      role="presentation"
      onClick={confirmDisabled ? undefined : onClose}
    >
      <div
        className="supply-picker-modal retro-box"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title" id="alert-modal-title">
          {title}
        </p>
        <p className="retro-muted">{message}</p>
        <div className="supply-picker-actions combat-roll-actions">
          <div className="combat-roll-right-actions" style={{ width: "100%", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="candy-btn"
              onClick={onClose}
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
