"use client";

import { cloneElement, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { HTMLAttributes, MouseEvent, ReactElement } from "react";

interface TooltipProps {
  content: string | null | undefined;
  children: ReactElement;
}

/**
 * Wraps any single element and shows a dark floating tooltip on hover.
 * Replaces the native browser `title` attribute tooltip.
 */
export function Tooltip({ content, children }: TooltipProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!content) return children;

  const child = children as ReactElement<HTMLAttributes<HTMLElement>>;

  const clone = cloneElement(child, {
    title: undefined,
    onMouseEnter(e: MouseEvent<HTMLElement>) {
      setPos({ x: e.clientX, y: e.clientY });
      child.props.onMouseEnter?.(e);
    },
    onMouseMove(e: MouseEvent<HTMLElement>) {
      setPos({ x: e.clientX, y: e.clientY });
      child.props.onMouseMove?.(e);
    },
    onMouseLeave(e: MouseEvent<HTMLElement>) {
      setPos(null);
      child.props.onMouseLeave?.(e);
    },
  });

  return (
    <>
      {clone}
      {pos &&
        mounted &&
        createPortal(
          <div
            style={{
              position: "fixed",
              pointerEvents: "none",
              zIndex: 9999,
              left: pos.x + 14,
              top: pos.y - 12,
              transform: "translateY(-100%)",
              background: "#1a1a1a",
              color: "#f5f5f5",
              fontSize: "12px",
              lineHeight: 1.5,
              padding: "6px 10px",
              borderRadius: "4px",
              maxWidth: "280px",
              whiteSpace: "pre-line",
              boxShadow: "0 3px 10px rgba(0,0,0,0.45)",
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
