"use client";

import {
  cloneElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { HTMLAttributes, MouseEvent, ReactElement } from "react";

interface TooltipProps {
  content: string | null | undefined;
  children: ReactElement;
}

const VIEWPORT_PADDING = 8;
const OFFSET_X = 14;
const OFFSET_Y = 12;
const DEFAULT_MAX_WIDTH = 280;
const WIDTH_STEP = 48;

interface TooltipLayout {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

function maxViewportHeight(): number {
  return window.innerHeight - VIEWPORT_PADDING * 2;
}

function maxViewportWidth(): number {
  return window.innerWidth - VIEWPORT_PADDING * 2;
}

function clampTooltipPosition(
  anchor: { x: number; y: number },
  size: { width: number; height: number }
): { left: number; top: number } {
  const { x, y } = anchor;
  const { width, height } = size;

  let left = x + OFFSET_X;
  let top = y - OFFSET_Y - height;

  if (top < VIEWPORT_PADDING) {
    top = y + OFFSET_Y;
  }

  if (top + height > window.innerHeight - VIEWPORT_PADDING) {
    top = Math.max(VIEWPORT_PADDING, window.innerHeight - VIEWPORT_PADDING - height);
  }

  if (left + width > window.innerWidth - VIEWPORT_PADDING) {
    left = window.innerWidth - VIEWPORT_PADDING - width;
  }
  if (left < VIEWPORT_PADDING) {
    left = VIEWPORT_PADDING;
  }

  return { left, top };
}

/** Grow width until content fits vertically; never enable scrolling. */
function fitTooltipLayout(
  el: HTMLElement,
  anchor: { x: number; y: number }
): TooltipLayout {
  const maxHeight = maxViewportHeight();
  const maxWidth = maxViewportWidth();

  el.style.overflowY = "hidden";
  el.style.overflowX = "hidden";
  el.style.maxHeight = `${maxHeight}px`;
  el.style.width = "max-content";
  el.style.maxWidth = `${DEFAULT_MAX_WIDTH}px`;

  let maxWidthPx = Math.min(DEFAULT_MAX_WIDTH, maxWidth);
  el.style.maxWidth = `${maxWidthPx}px`;

  while (maxWidthPx < maxWidth && el.scrollHeight > maxHeight) {
    maxWidthPx = Math.min(maxWidthPx + WIDTH_STEP, maxWidth);
    el.style.maxWidth = `${maxWidthPx}px`;
  }

  if (el.scrollHeight > maxHeight) {
    maxWidthPx = maxWidth;
    el.style.maxWidth = `${maxWidth}px`;
  }

  const rect = el.getBoundingClientRect();
  const { left, top } = clampTooltipPosition(anchor, {
    width: rect.width,
    height: rect.height,
  });

  return { left, top, width: maxWidthPx, maxHeight };
}

/**
 * Wraps any single element and shows a dark floating tooltip on hover.
 * Replaces the native browser `title` attribute tooltip.
 */
export function Tooltip({ content, children }: TooltipProps) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [layout, setLayout] = useState<TooltipLayout | null>(null);
  const [mounted, setMounted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!anchor || !tooltipRef.current) {
      setLayout(null);
      return;
    }

    setLayout(fitTooltipLayout(tooltipRef.current, anchor));
  }, [anchor, content]);

  useEffect(() => {
    if (!anchor) return;

    const updateLayout = () => {
      if (!tooltipRef.current) return;
      setLayout(fitTooltipLayout(tooltipRef.current, anchor));
    };

    window.addEventListener("scroll", updateLayout, true);
    window.addEventListener("resize", updateLayout);
    return () => {
      window.removeEventListener("scroll", updateLayout, true);
      window.removeEventListener("resize", updateLayout);
    };
  }, [anchor, content]);

  if (!content) return children;

  const child = children as ReactElement<HTMLAttributes<HTMLElement>>;

  const clone = cloneElement(child, {
    title: undefined,
    onMouseEnter(e: MouseEvent<HTMLElement>) {
      setAnchor({ x: e.clientX, y: e.clientY });
      child.props.onMouseEnter?.(e);
    },
    onMouseMove(e: MouseEvent<HTMLElement>) {
      setAnchor({ x: e.clientX, y: e.clientY });
      child.props.onMouseMove?.(e);
    },
    onMouseLeave(e: MouseEvent<HTMLElement>) {
      setAnchor(null);
      setLayout(null);
      child.props.onMouseLeave?.(e);
    },
  });

  return (
    <>
      {clone}
      {anchor &&
        mounted &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{
              position: "fixed",
              pointerEvents: "none",
              zIndex: 9999,
              left: layout?.left ?? anchor.x + OFFSET_X,
              top: layout?.top ?? anchor.y + OFFSET_Y,
              visibility: layout ? "visible" : "hidden",
              background: "#1a1a1a",
              color: "#f5f5f5",
              fontSize: "12px",
              lineHeight: 1.5,
              padding: "6px 10px",
              borderRadius: "4px",
              maxWidth: layout?.width ?? DEFAULT_MAX_WIDTH,
              width: "max-content",
              maxHeight: layout?.maxHeight ?? maxViewportHeight(),
              overflow: "hidden",
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
