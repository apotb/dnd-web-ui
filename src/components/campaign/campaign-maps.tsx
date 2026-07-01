"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeMapsData } from "@/lib/hooks/use-realtime-maps-data";
import {
  getCampaignMapImageUrl,
  removeCampaignMapImage,
  uploadCampaignMapImage,
} from "@/lib/maps/storage";
import {
  HexRevealMap,
  HexRevealMapFullscreen,
} from "@/components/campaign/hex-reveal-map";
import { useShowDmUi } from "@/components/layout/dm-view-provider";
import {
  MAP_MARKER_COLORS,
  clearRevealedHexes,
  getMarkersForMap,
  getRevealedHexesForMap,
  isHexRevealMap,
  newCampaignMap,
  newDefaultPartyMarker,
  newMapMarker,
  sortCampaignMaps,
  toggleRevealedHex,
  type MapMarker,
  type MapsData,
} from "@/lib/schemas/maps";

interface CampaignMapsProps {
  campaignId: string;
  initialMapsData: MapsData;
  isDm: boolean;
}

function mapTabStorageKey(campaignId: string) {
  return `campaign-map-tab-${campaignId}`;
}

export function CampaignMaps({
  campaignId,
  initialMapsData,
  isDm,
}: CampaignMapsProps) {
  const showDmUi = useShowDmUi(isDm);
  const liveMapsData = useRealtimeMapsData(campaignId, initialMapsData);
  const [draft, setDraft] = useState(liveMapsData);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadingMapId, setUploadingMapId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [restoredTab, setRestoredTab] = useState(false);

  const mapsData = showDmUi ? draft : liveMapsData;
  const sortedMaps = useMemo(() => sortCampaignMaps(mapsData.maps), [mapsData.maps]);

  useEffect(() => {
    if (!showDmUi) return;
    setDraft(liveMapsData);
  }, [liveMapsData, showDmUi]);

  useEffect(() => {
    setRestoredTab(false);
    setActiveMapId(null);
  }, [campaignId]);

  useEffect(() => {
    if (restoredTab || sortedMaps.length === 0) return;
    const stored = localStorage.getItem(mapTabStorageKey(campaignId));
    if (stored === "") {
      setActiveMapId(null);
    } else if (stored === null) {
      setActiveMapId(sortedMaps[0].id);
    } else {
      setActiveMapId(
        sortedMaps.some((map) => map.id === stored) ? stored : sortedMaps[0].id
      );
    }
    setRestoredTab(true);
  }, [campaignId, restoredTab, sortedMaps]);

  const activeMap = sortedMaps.find((map) => map.id === activeMapId) ?? null;
  const activeMarkers = activeMap
    ? getMarkersForMap(mapsData.markers, activeMap.id)
    : [];
  const activeRevealedHexes = activeMap
    ? getRevealedHexesForMap(mapsData, activeMap.id)
    : [];
  const activeHexReveal =
    activeMap && isHexRevealMap(activeMap) ? activeMap : null;

  function selectMap(mapId: string) {
    const next = activeMapId === mapId ? null : mapId;
    setActiveMapId(next);
    if (next === null) {
      setExpanded(false);
    }
    localStorage.setItem(mapTabStorageKey(campaignId), next ?? "");
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("campaigns")
      .update({ maps_data: draft })
      .eq("id", campaignId);

    setMessage(error ? error.message : "Saved");
    setSaving(false);
  }

  function updateDraft(next: MapsData) {
    setDraft(next);
  }

  async function persistMapsData(next: MapsData, feedback?: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("campaigns")
      .update({ maps_data: next })
      .eq("id", campaignId);

    if (error) {
      setMessage(error.message);
    } else if (feedback) {
      setMessage(feedback);
    }
  }

  function toggleHex(hexId: number) {
    if (!activeMap || !showDmUi) return;
    const next = toggleRevealedHex(draft, activeMap.id, hexId);
    updateDraft(next);
    void persistMapsData(next);
  }

  function resetHexFog() {
    if (!activeMap || !showDmUi) return;
    const revealedCount = getRevealedHexesForMap(draft, activeMap.id).length;
    if (revealedCount === 0) return;
    if (
      !window.confirm(
        `Reset fog on ${activeMap.name}?\n\nThis will hide all ${revealedCount} revealed hex${revealedCount === 1 ? "" : "es"}. You will need to reveal them again manually.`
      )
    ) {
      return;
    }
    const next = clearRevealedHexes(draft, activeMap.id);
    updateDraft(next);
    void persistMapsData(next, "Fog reset");
  }

  function addMap() {
    const name = window.prompt("Map name");
    if (!name?.trim()) return;
    const nextOrder =
      draft.maps.length > 0
        ? Math.max(...draft.maps.map((map) => map.sortOrder)) + 1
        : 0;
    const map = newCampaignMap(name.trim(), nextOrder);
    updateDraft({
      ...draft,
      maps: [...draft.maps, map],
      markers:
        draft.markers.length === 0
          ? [...draft.markers, newDefaultPartyMarker(map.id)]
          : draft.markers,
    });
    selectMap(map.id);
  }

  function removeMap(mapId: string) {
    const map = draft.maps.find((entry) => entry.id === mapId);
    if (!map) return;
    if (!window.confirm(`Remove map "${map.name}"?`)) return;
    const nextMaps = draft.maps.filter((entry) => entry.id !== mapId);
    const nextRevealed = { ...draft.revealedHexes };
    delete nextRevealed[mapId];
    updateDraft({
      maps: nextMaps,
      markers: draft.markers.filter((marker) => marker.mapId !== mapId),
      revealedHexes: nextRevealed,
    });
    if (activeMapId === mapId) {
      const next = sortCampaignMaps(nextMaps)[0];
      setActiveMapId(next?.id ?? null);
      localStorage.setItem(mapTabStorageKey(campaignId), next?.id ?? "");
      if (!next) setExpanded(false);
    }
    if (map.imagePath) {
      void removeCampaignMapImage(createClient(), map.imagePath);
    }
  }

  function renameMap(mapId: string) {
    const map = draft.maps.find((entry) => entry.id === mapId);
    if (!map) return;
    const name = window.prompt("Map name", map.name);
    if (!name?.trim()) return;
    updateDraft({
      ...draft,
      maps: draft.maps.map((entry) =>
        entry.id === mapId ? { ...entry, name: name.trim() } : entry
      ),
    });
  }

  function moveMap(mapId: string, direction: -1 | 1) {
    const ordered = sortCampaignMaps(draft.maps);
    const index = ordered.findIndex((map) => map.id === mapId);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return;
    const reordered = [...ordered];
    const current = reordered[index];
    const swap = reordered[swapIndex];
    reordered[index] = { ...swap, sortOrder: current.sortOrder };
    reordered[swapIndex] = { ...current, sortOrder: swap.sortOrder };
    updateDraft({ ...draft, maps: reordered });
  }

  function addMarker(mapId: string) {
    const label = window.prompt("Marker label", "Party member");
    if (!label?.trim()) return;
    updateDraft({
      ...draft,
      markers: [
        ...draft.markers,
        newMapMarker(mapId, { label: label.trim() }),
      ],
    });
  }

  function removeMarker(markerId: string) {
    updateDraft({
      ...draft,
      markers: draft.markers.filter((marker) => marker.id !== markerId),
    });
  }

  function updateMarker(markerId: string, patch: Partial<MapMarker>) {
    updateDraft({
      ...draft,
      markers: draft.markers.map((marker) =>
        marker.id === markerId ? { ...marker, ...patch } : marker
      ),
    });
  }

  function updateMarkerPosition(
    markerId: string,
    position: { x: number; y: number }
  ) {
    updateDraft({
      ...draft,
      markers: draft.markers.map((marker) =>
        marker.id === markerId ? { ...marker, ...position } : marker
      ),
    });
  }

  async function uploadMapImage(mapId: string, file: File) {
    setUploadingMapId(mapId);
    setMessage(null);
    const supabase = createClient();
    const existing = draft.maps.find((map) => map.id === mapId)?.imagePath ?? null;
    const { path, error } = await uploadCampaignMapImage(
      supabase,
      campaignId,
      mapId,
      file
    );

    if (error || !path) {
      setMessage(error ?? "Upload failed");
      setUploadingMapId(null);
      return;
    }

    const nextDraft = {
      ...draft,
      maps: draft.maps.map((map) =>
        map.id === mapId ? { ...map, imagePath: path } : map
      ),
    };
    updateDraft(nextDraft);

    if (existing && existing !== path) {
      await removeCampaignMapImage(supabase, existing);
    }

    const { error: saveError } = await supabase
      .from("campaigns")
      .update({ maps_data: nextDraft })
      .eq("id", campaignId);

    if (saveError) {
      setMessage(saveError.message);
    }

    setUploadingMapId(null);
  }

  if (sortedMaps.length === 0) {
    return (
      <section className="retro-box">
        <p className="retro-box-title">Maps</p>
        <p className="retro-muted">No maps yet.</p>
        {showDmUi ? (
          <button type="button" className="candy-btn" onClick={addMap}>
            + Add map
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <div className="retro-stack party-overview-stack">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        {sortedMaps.map((map) => (
          <button
            key={map.id}
            type="button"
            className={`candy-btn${activeMapId === map.id ? " candy-btn-active" : ""}`}
            style={{ flex: "0 1 auto" }}
            onClick={() => selectMap(map.id)}
          >
            {map.name}
          </button>
        ))}
        {showDmUi ? (
          <button
            type="button"
            className="candy-btn"
            style={{ flex: "0 1 auto" }}
            onClick={addMap}
          >
            + Add map
          </button>
        ) : null}
      </div>

      {activeMap ? (
        <section className="retro-box">
          <div className="retro-section-header">
            <p className="retro-box-title">{activeMap.name}</p>
            <div className="campaign-map-toolbar">
              <button
                type="button"
                className="candy-btn candy-btn-sm"
                onClick={() => setExpanded(true)}
                disabled={
                  activeHexReveal ? !activeHexReveal.hexLayoutId : !activeMap.imagePath
                }
              >
                Expand
              </button>
              {showDmUi && activeMap.imagePath && !activeHexReveal && (
                <MapImageUploadButton
                  uploading={uploadingMapId === activeMap.id}
                  onFile={(file) => void uploadMapImage(activeMap.id, file)}
                  label="Replace image"
                />
              )}
            </div>
          </div>

          {showDmUi ? (
            <div className="campaign-map-dm-controls">
              <button
                type="button"
                className="retro-inline-link"
                onClick={() => renameMap(activeMap.id)}
              >
                Rename
              </button>
              <button
                type="button"
                className="retro-inline-link"
                onClick={() => moveMap(activeMap.id, -1)}
              >
                Move left
              </button>
              <button
                type="button"
                className="retro-inline-link"
                onClick={() => moveMap(activeMap.id, 1)}
              >
                Move right
              </button>
              <button
                type="button"
                className="retro-inline-link"
                onClick={() => addMarker(activeMap.id)}
              >
                + Add marker
              </button>
              <button
                type="button"
                className="retro-inline-link"
                style={{ color: "#b00020" }}
                onClick={() => removeMap(activeMap.id)}
              >
                Remove map
              </button>
            </div>
          ) : null}

          {activeHexReveal?.hexLayoutId ? (
            <>
              {!showDmUi ? (
                <p className="retro-muted" style={{ marginBottom: "12px" }}>
                  {activeRevealedHexes.length} explored hex
                  {activeRevealedHexes.length === 1 ? "" : "es"}.
                </p>
              ) : null}
              {!expanded ? (
                <HexRevealMap
                  layoutId={activeHexReveal.hexLayoutId}
                  revealedHexIds={activeRevealedHexes}
                  markers={activeMarkers}
                  isDm={showDmUi}
                  onToggleHex={toggleHex}
                  onResetFog={resetHexFog}
                  onMarkerMove={updateMarkerPosition}
                />
              ) : null}
            </>
          ) : !expanded && activeMap.imagePath ? (
            <MapCanvas
              campaignId={campaignId}
              imagePath={activeMap.imagePath}
              markers={activeMarkers}
              isDm={showDmUi}
              onMarkerMove={updateMarkerPosition}
            />
          ) : showDmUi ? (
            <div className="campaign-map-empty">
              <p className="retro-muted">Upload a map image for {activeMap.name}.</p>
              <MapImageUploadButton
                uploading={uploadingMapId === activeMap.id}
                onFile={(file) => void uploadMapImage(activeMap.id, file)}
                label="Upload image"
              />
            </div>
          ) : (
            <p className="retro-muted">No map image yet.</p>
          )}

          {showDmUi && activeMarkers.length > 0 && (
            <div className="campaign-map-marker-list">
              <p className="retro-box-subtitle">Markers on this map</p>
              {activeMarkers.map((marker) => (
                <MarkerEditorRow
                  key={marker.id}
                  marker={marker}
                  onChange={(patch) => updateMarker(marker.id, patch)}
                  onRemove={() => removeMarker(marker.id)}
                />
              ))}
            </div>
          )}

          {!showDmUi && activeMarkers.length > 0 && (
            <div className="campaign-map-marker-legend">
              {activeMarkers.map((marker) => (
                <span key={marker.id} className="campaign-map-marker-chip">
                  <span
                    className="campaign-map-marker-dot"
                    style={{ backgroundColor: marker.color }}
                  />
                  {marker.label}
                </span>
              ))}
            </div>
          )}

          {showDmUi ? (
            <div className="party-inventory-save">
              <button
                type="button"
                className="candy-btn"
                onClick={save}
                disabled={saving}
              >
                {saving ? "..." : "Save maps"}
              </button>
              {message && <span className="retro-muted">{message}</span>}
            </div>
          ) : null}
        </section>
      ) : null}

      {expanded && activeHexReveal?.hexLayoutId ? (
        <HexRevealMapFullscreen
          layoutId={activeHexReveal.hexLayoutId}
          mapName={activeHexReveal.name}
          revealedHexIds={activeRevealedHexes}
          markers={activeMarkers}
          isDm={showDmUi}
          onClose={() => setExpanded(false)}
          onToggleHex={toggleHex}
          onResetFog={resetHexFog}
          onMarkerMove={updateMarkerPosition}
          onSave={showDmUi ? save : undefined}
          saving={saving}
        />
      ) : null}

      {expanded && activeMap?.imagePath && !activeHexReveal ? (
        <MapFullscreenOverlay
          campaignId={campaignId}
          imagePath={activeMap.imagePath}
          mapName={activeMap.name}
          markers={activeMarkers}
          isDm={showDmUi}
          onClose={() => setExpanded(false)}
          onMarkerMove={updateMarkerPosition}
          onSave={showDmUi ? save : undefined}
          saving={saving}
        />
      ) : null}
    </div>
  );
}

function MapImageUploadButton({
  label,
  uploading,
  onFile,
}: {
  label: string;
  uploading: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className="candy-btn candy-btn-sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "Uploading…" : label}
      </button>
    </>
  );
}

function MarkerEditorRow({
  marker,
  onChange,
  onRemove,
}: {
  marker: MapMarker;
  onChange: (patch: Partial<MapMarker>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="campaign-map-marker-row">
      <span
        className="campaign-map-marker-dot"
        style={{ backgroundColor: marker.color }}
      />
      <input
        className="candy-input campaign-map-marker-label-input"
        value={marker.label}
        onChange={(event) => onChange({ label: event.target.value })}
        aria-label="Marker label"
      />
      <select
        className="candy-input campaign-map-marker-color-select"
        value={marker.color}
        onChange={(event) => onChange({ color: event.target.value })}
        aria-label="Marker color"
      >
        {MAP_MARKER_COLORS.map((color) => (
          <option key={color.id} value={color.value}>
            {color.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="retro-inline-link"
        style={{ color: "#b00020" }}
        onClick={onRemove}
      >
        Remove
      </button>
    </div>
  );
}

interface MapCanvasProps {
  campaignId: string;
  imagePath: string;
  markers: MapMarker[];
  isDm: boolean;
  onMarkerMove?: (markerId: string, position: { x: number; y: number }) => void;
  zoom?: number;
  expanded?: boolean;
  scrollRef?: RefObject<HTMLDivElement | null>;
}

function MapCanvas({
  campaignId,
  imagePath,
  markers,
  isDm,
  onMarkerMove,
  zoom = 1,
  expanded = false,
  scrollRef,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    setImageUrl(getCampaignMapImageUrl(supabase, imagePath));
  }, [campaignId, imagePath]);

  const clampPosition = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
  }, []);

  function handleMarkerPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    markerId: string
  ) {
    if (!isDm || !onMarkerMove) return;
    const moveMarker: NonNullable<typeof onMarkerMove> = onMarkerMove;
    const target = event.currentTarget;
    event.preventDefault();
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

  return (
    <div
      ref={scrollRef}
      className={`campaign-map-viewer${expanded ? " campaign-map-viewer-expanded" : ""}`}
    >
      <div
        ref={containerRef}
        className="campaign-map-canvas"
        style={{
          width: `${zoom * 100}%`,
          ["--map-zoom" as string]: expanded ? zoom * 2 : zoom,
        }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="campaign-map-image" draggable={false} />
        ) : (
          <div className="campaign-map-image-placeholder">Loading map…</div>
        )}

        {markers.map((marker) => (
          <button
            key={marker.id}
            type="button"
            className={`campaign-map-marker${isDm ? " campaign-map-marker-draggable" : ""}`}
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
  );
}

function MapFullscreenOverlay({
  campaignId,
  imagePath,
  mapName,
  markers,
  isDm,
  onClose,
  onMarkerMove,
  onSave,
  saving = false,
}: {
  campaignId: string;
  imagePath: string;
  mapName: string;
  markers: MapMarker[];
  isDm: boolean;
  onClose: () => void;
  onMarkerMove?: (markerId: string, position: { x: number; y: number }) => void;
  onSave?: () => void;
  saving?: boolean;
}) {
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
    <div className="campaign-map-overlay" role="dialog" aria-modal="true" aria-label={`${mapName} map`}>
      <div className="campaign-map-overlay-header">
        <strong>{mapName}</strong>
        <div className="campaign-map-toolbar">
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
        <MapCanvas
          campaignId={campaignId}
          imagePath={imagePath}
          markers={markers}
          isDm={isDm}
          onMarkerMove={onMarkerMove}
          zoom={zoom}
          expanded
          scrollRef={scrollRef}
        />
      </div>
    </div>,
    document.body
  );
}
