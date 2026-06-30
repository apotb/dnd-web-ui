"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { HexLayout } from "@/lib/maps/layouts/types";
import type { MapMarker } from "@/lib/schemas/maps";

interface HexRevealMapProps {
  layoutId: string;
  revealedHexIds: number[];
  markers: MapMarker[];
  isDm: boolean;
  expanded?: boolean;
  scrollRef?: RefObject<HTMLDivElement | null>;
  zoom?: number;
  onToggleHex?: (hexId: number) => void;
  onResetFog?: () => void;
  onMarkerMove?: (markerId: string, position: { x: number; y: number }) => void;
}

export function HexRevealMap({
  layoutId,
  revealedHexIds,
  markers,
  isDm,
  expanded = false,
  scrollRef,
  zoom = 1,
  onToggleHex,
  onResetFog,
  onMarkerMove,
}: HexRevealMapProps) {
  const [layout, setLayout] = useState<HexLayout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetch(`/api/map-layouts/${layoutId}`)
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? `Failed to load layout (${response.status})`);
        }
        return response.json() as Promise<HexLayout>;
      })
      .then((data) => {
        if (!cancelled) {
          setLayout(data);
          setLoading(false);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load hex layout"
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [layoutId]);

  const clampPosition = useCallback((clientX: number, clientY: number) => {
    const container = canvasRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
  }, []);

  const handleHexClick = useCallback(
    (hexId: number) => {
      if (!isDm || !onToggleHex) return;
      onToggleHex(hexId);
    },
    [isDm, onToggleHex]
  );

  function handleMarkerPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    markerId: string
  ) {
    if (!isDm || !onMarkerMove) return;
    const moveMarker: NonNullable<typeof onMarkerMove> = onMarkerMove;
    const target = event.currentTarget;
    event.preventDefault();
    event.stopPropagation();
    target.setPointerCapture(event.pointerId);

    function onPointerMove(moveEvent: PointerEvent) {
      const position = clampPosition(moveEvent.clientX, moveEvent.clientY);
      if (position) moveMarker(markerId, position);
    }

    function onPointerUp(upEvent: PointerEvent) {
      target.releasePointerCapture(upEvent.pointerId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  if (loading) {
    return <p className="retro-muted">Loading hex map…</p>;
  }

  if (error || !layout) {
    return (
      <p className="retro-muted">
        {error ?? "Hex layout unavailable."}
      </p>
    );
  }

  const [minX, minY, viewWidth, viewHeight] = layout.viewBox;
  const viewerClass = expanded
    ? "campaign-map-viewer hex-reveal-map-viewer campaign-map-viewer-expanded"
    : "hex-reveal-map-frame";

  return (
    <div className={expanded ? "hex-reveal-map hex-reveal-map-expanded" : "hex-reveal-map"}>
      {isDm && onResetFog && !expanded ? (
        <div className="hex-reveal-map-toolbar">
          <button
            type="button"
            className="candy-btn candy-btn-sm"
            onClick={onResetFog}
          >
            Reset fog
          </button>
          <span className="retro-muted">
            {revealedHexIds.length} hex{revealedHexIds.length === 1 ? "" : "es"} revealed
          </span>
        </div>
      ) : null}

      <div ref={expanded ? scrollRef : undefined} className={viewerClass}>
        <div
          ref={canvasRef}
          className="hex-reveal-map-canvas"
          style={
            expanded
              ? {
                  width: `${zoom * 100}%`,
                  aspectRatio: `${viewWidth} / ${viewHeight}`,
                  ["--map-zoom" as string]: zoom * 2,
                }
              : { aspectRatio: `${viewWidth} / ${viewHeight}` }
          }
        >
          <svg
            className="hex-reveal-map-svg"
            viewBox={`${minX} ${minY} ${viewWidth} ${viewHeight}`}
            preserveAspectRatio="xMidYMid meet"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            role="img"
            aria-label={`${layout.name} hex map`}
          >
            <image
              width={layout.image.width}
              height={layout.image.height}
              href={layout.image.href}
              xlinkHref={layout.image.href}
              transform={layout.image.transform ?? undefined}
              overflow="visible"
            />
            {layout.hexes.map((hex) => (
              <polygon
                key={hex.id}
                className={`hex-reveal-fog${
                  revealedHexIds.includes(hex.id) ? " hex-reveal-fog-off" : ""
                }${isDm ? " hex-reveal-fog-interactive" : ""}`}
                points={hex.points}
                onClick={() => handleHexClick(hex.id)}
              />
            ))}
          </svg>

          {markers.map((marker) => (
            <button
              key={marker.id}
              type="button"
              className={`campaign-map-marker${
                isDm ? " campaign-map-marker-draggable" : ""
              }`}
              style={{
                left: `${marker.x * 100}%`,
                top: `${marker.y * 100}%`,
                backgroundColor: marker.color,
              }}
              onPointerDown={(event) => handleMarkerPointerDown(event, marker.id)}
              aria-label={marker.label}
            >
              <span className="campaign-map-marker-label">{marker.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface HexRevealMapFullscreenProps {
  layoutId: string;
  mapName: string;
  revealedHexIds: number[];
  markers: MapMarker[];
  isDm: boolean;
  onClose: () => void;
  onToggleHex?: (hexId: number) => void;
  onResetFog?: () => void;
  onMarkerMove?: (markerId: string, position: { x: number; y: number }) => void;
  onSave?: () => void;
  saving?: boolean;
}

export function HexRevealMapFullscreen({
  layoutId,
  mapName,
  revealedHexIds,
  markers,
  isDm,
  onClose,
  onToggleHex,
  onResetFog,
  onMarkerMove,
  onSave,
  saving = false,
}: HexRevealMapFullscreenProps) {
  const [zoom, setZoom] = useState(1);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function changeZoom(next: number) {
    const el = scrollRef.current;
    const prev = zoom;
    setZoom(next);
    if (!el || next === prev) return;
    requestAnimationFrame(() => {
      const ratio = next / prev;
      const centerX = el.scrollLeft + el.clientWidth / 2;
      const centerY = el.scrollTop + el.clientHeight / 2;
      el.scrollLeft = centerX * ratio - el.clientWidth / 2;
      el.scrollTop = centerY * ratio - el.clientHeight / 2;
    });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="campaign-map-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${mapName} hex map`}
    >
      <div className="campaign-map-overlay-header">
        <strong>{mapName}</strong>
        <div className="campaign-map-toolbar">
          {isDm && onResetFog ? (
            <button
              type="button"
              className="candy-btn candy-btn-sm"
              onClick={onResetFog}
            >
              Reset fog
            </button>
          ) : null}
          <button
            type="button"
            className="candy-btn candy-btn-sm"
            onClick={() => changeZoom(Math.max(1, zoom - 0.25))}
            disabled={zoom <= 1}
          >
            −
          </button>
          <span className="retro-muted">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="candy-btn candy-btn-sm"
            onClick={() => changeZoom(Math.min(3, zoom + 0.25))}
            disabled={zoom >= 3}
          >
            +
          </button>
          {isDm && onSave ? (
            <button
              type="button"
              className="candy-btn candy-btn-sm"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "..." : "Save map"}
            </button>
          ) : null}
          <button type="button" className="candy-btn candy-btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="campaign-map-overlay-body">
        <HexRevealMap
          layoutId={layoutId}
          revealedHexIds={revealedHexIds}
          markers={markers}
          isDm={isDm}
          expanded
          scrollRef={scrollRef}
          zoom={zoom}
          onToggleHex={onToggleHex}
          onMarkerMove={onMarkerMove}
        />
      </div>
    </div>,
    document.body
  );
}
