"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface CombatBoardFullscreenProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function CombatBoardFullscreen({
  open,
  onClose,
  children,
}: CombatBoardFullscreenProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="combat-board-fullscreen-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Expanded combat board"
    >
      <button
        type="button"
        className="combat-board-fullscreen-close"
        onClick={onClose}
        aria-label="Close expanded board"
      >
        ×
      </button>
      <div className="combat-board-fullscreen-stage">{children}</div>
    </div>,
    document.body
  );
}
