"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { User } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { createClient } from "@/lib/supabase/client";
import {
  getNotablePortraitUrl,
  hasNotablePortrait,
  removeNotablePortrait,
  uploadNotablePortrait,
} from "@/lib/campaign/notable-portrait-storage";
import { useRealtimeNotablesData } from "@/lib/hooks/use-realtime-notables-data";
import { useRealtimeWorldData } from "@/lib/hooks/use-realtime-world-data";
import {
  formatHarptosDateShort,
  getFestivalById,
  HARPTOS_MONTHS,
} from "@/lib/dnd/harptos-calendar";
import {
  DEFAULT_NOTABLE_CATEGORY,
  filterNotablesByCategory,
  filterNotablesForViewer,
  moveNotableEvent,
  newNotable,
  newNotableEvent,
  NOTABLE_CATEGORIES,
  formatNotableNameLine,
  notableEventToHarptosDate,
  sortNotableEvents,
  type Notable,
  type NotableCategory,
  type NotableEvent,
  type NotablesData,
} from "@/lib/schemas/notables";
import {
  getCampaignCalendarDate,
  type WorldData,
} from "@/lib/schemas/world";

interface CampaignNotablesProps {
  campaignId: string;
  initialNotablesData: NotablesData;
  initialWorldData: WorldData;
  isDm: boolean;
  canEditNotables: boolean;
}

function notableCategoryTabStorageKey(campaignId: string) {
  return `campaign-notable-category-tab-${campaignId}`;
}

function parseStoredNotableCategory(stored: string | null): NotableCategory | null {
  if (stored === null || stored === "") return null;
  return NOTABLE_CATEGORIES.some((category) => category.id === stored)
    ? (stored as NotableCategory)
    : null;
}

export function CampaignNotables({
  campaignId,
  initialNotablesData,
  initialWorldData,
  isDm,
  canEditNotables,
}: CampaignNotablesProps) {
  const liveNotablesData = useRealtimeNotablesData(
    campaignId,
    initialNotablesData
  );
  const worldData = useRealtimeWorldData(campaignId, initialWorldData);
  const campaignDate = getCampaignCalendarDate(worldData);
  const [draft, setDraft] = useState(liveNotablesData);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<NotableCategory | null>(
    null
  );
  const [restoredCategoryTab, setRestoredCategoryTab] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notablePendingRemoval, setNotablePendingRemoval] =
    useState<Notable | null>(null);
  const [removingNotable, setRemovingNotable] = useState(false);

  const editable = canEditNotables && editing;

  useEffect(() => {
    if (!canEditNotables) return;
    setDraft(liveNotablesData);
  }, [liveNotablesData, canEditNotables]);

  useEffect(() => {
    setRestoredCategoryTab(false);
    setActiveCategory(null);
  }, [campaignId]);

  useEffect(() => {
    if (restoredCategoryTab) return;
    const stored = localStorage.getItem(notableCategoryTabStorageKey(campaignId));
    setActiveCategory(parseStoredNotableCategory(stored));
    setRestoredCategoryTab(true);
  }, [campaignId, restoredCategoryTab]);

  const notablesData = (editable ? draft : liveNotablesData) ?? { notables: [] };
  const savedCategoriesById = useMemo(
    () =>
      new Map(
        liveNotablesData.notables.map((notable) => [notable.id, notable.category])
      ),
    [liveNotablesData.notables]
  );
  const visibleNotables = useMemo(() => {
    if (!activeCategory) return [];
    const inCategory = filterNotablesByCategory(
      notablesData.notables,
      activeCategory,
      editable ? savedCategoriesById : undefined
    );
    return filterNotablesForViewer(inCategory, isDm || editable);
  }, [
    activeCategory,
    editable,
    isDm,
    notablesData.notables,
    savedCategoriesById,
  ]);

  function selectCategory(category: NotableCategory) {
    const next = activeCategory === category ? null : category;
    setActiveCategory(next);
    localStorage.setItem(notableCategoryTabStorageKey(campaignId), next ?? "");
  }

  async function saveNotablesData(nextDraft: NotablesData) {
    const supabase = createClient();
    const { error } = await supabase.rpc("update_campaign_notables", {
      p_campaign_id: campaignId,
      p_notables_data: nextDraft,
    });
    return error;
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const error = await saveNotablesData(draft);

    setMessage(error ? error.message : "Saved");
    setSaving(false);
  }

  function updateNotables(nextNotables: Notable[]) {
    if (!editable) return;
    setDraft({ ...draft, notables: nextNotables });
  }

  function addNotable(placement: "top" | "bottom") {
    const category = activeCategory ?? DEFAULT_NOTABLE_CATEGORY;
    const categoryNotables = filterNotablesByCategory(
      draft.notables,
      category,
      editable ? savedCategoriesById : undefined
    );
    const nextOrder =
      categoryNotables.length > 0
        ? placement === "top"
          ? Math.min(...categoryNotables.map((notable) => notable.sortOrder)) - 1
          : Math.max(...categoryNotables.map((notable) => notable.sortOrder)) + 1
        : 0;
    updateNotables([
      ...draft.notables,
      newNotable({ category }, nextOrder),
    ]);
  }

  function moveNotable(notableId: string, direction: -1 | 1) {
    const category = activeCategory ?? DEFAULT_NOTABLE_CATEGORY;
    const ordered = filterNotablesByCategory(
      draft.notables,
      category,
      editable ? savedCategoriesById : undefined
    );
    const index = ordered.findIndex((notable) => notable.id === notableId);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return;

    const reordered = [...ordered];
    const current = reordered[index];
    const swap = reordered[swapIndex];
    reordered[index] = { ...swap, sortOrder: current.sortOrder };
    reordered[swapIndex] = { ...current, sortOrder: swap.sortOrder };

    const updatedIds = new Map(reordered.map((notable) => [notable.id, notable]));
    updateNotables(
      draft.notables.map(
        (notable) => updatedIds.get(notable.id) ?? notable
      )
    );
  }

  async function persistNotable(next: Notable) {
    const nextDraft = {
      ...draft,
      notables: draft.notables.map((entry) =>
        entry.id === next.id ? next : entry
      ),
    };
    setDraft(nextDraft);

    const error = await saveNotablesData(nextDraft);
    if (error) setMessage(error.message);
  }

  function toggleNotableVisibility(notable: Notable) {
    updateNotables(
      draft.notables.map((entry) =>
        entry.id === notable.id
          ? { ...entry, visibleToPlayers: !entry.visibleToPlayers }
          : entry
      )
    );
  }

  async function confirmRemoveNotable() {
    if (!notablePendingRemoval) return;
    setRemovingNotable(true);

    if (notablePendingRemoval.portraitPath) {
      await removeNotablePortrait(
        createClient(),
        notablePendingRemoval.portraitPath
      );
    }

    updateNotables(
      draft.notables.filter((entry) => entry.id !== notablePendingRemoval.id)
    );
    setRemovingNotable(false);
    setNotablePendingRemoval(null);
  }

  const removeNotableLabel =
    formatNotableNameLine(notablePendingRemoval ?? { name: "", species: "" }) ||
    "this notable";

  return (
    <div className="retro-stack party-overview-stack">
      {canEditNotables ? (
        <label
          className={`notable-editing-toggle candy-btn cursor-pointer select-none w-fit${editing ? " candy-btn-active" : ""}`}
          style={{ flex: "0 1 auto" }}
        >
          <Checkbox
            checked={editing}
            onCheckedChange={(checked) => setEditing(checked === true)}
          />
          <span>Editing</span>
        </label>
      ) : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        {NOTABLE_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`candy-btn${activeCategory === category.id ? " candy-btn-active" : ""}`}
            style={{ flex: "0 1 auto" }}
            onClick={() => selectCategory(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="retro-stack notable-stack">
        {editable ? (
          <NotablesSaveBar
            saving={saving}
            message={message}
            onSave={save}
            onAddNotable={() => addNotable("top")}
          />
        ) : null}

        {activeCategory && visibleNotables.length === 0 ? (
          <p className="retro-muted">No notables in this category yet.</p>
        ) : (
          visibleNotables.map((notable, index) => (
            <NotableCard
              key={notable.id}
              campaignId={campaignId}
              notable={notable}
              campaignDate={campaignDate}
              isDm={isDm}
              editable={editable}
              canMoveUp={editable && index > 0}
              canMoveDown={editable && index < visibleNotables.length - 1}
              onMoveUp={() => moveNotable(notable.id, -1)}
              onMoveDown={() => moveNotable(notable.id, 1)}
              onChange={(next) =>
                updateNotables(
                  draft.notables.map((entry) =>
                    entry.id === notable.id ? next : entry
                  )
                )
              }
              onPersist={editable ? persistNotable : undefined}
              onToggleVisibility={
                editable ? () => toggleNotableVisibility(notable) : undefined
              }
              onRemove={() => setNotablePendingRemoval(notable)}
            />
          ))
        )}

        {editable ? (
          <NotablesSaveBar
            saving={saving}
            message={message}
            onSave={save}
            onAddNotable={() => addNotable("bottom")}
          />
        ) : null}
      </div>

      <ConfirmModal
        open={notablePendingRemoval !== null}
        title="Remove notable?"
        description={`Remove ${removeNotableLabel}? This cannot be undone.`}
        confirmLabel={removingNotable ? "Removing…" : "Remove"}
        confirmDisabled={removingNotable}
        destructive
        onCancel={() => {
          if (removingNotable) return;
          setNotablePendingRemoval(null);
        }}
        onConfirm={() => void confirmRemoveNotable()}
      />
    </div>
  );
}

function NotablesSaveBar({
  saving,
  message,
  onSave,
  onAddNotable,
}: {
  saving: boolean;
  message: string | null;
  onSave: () => void;
  onAddNotable?: () => void;
}) {
  return (
    <div className="party-inventory-save">
      {onAddNotable ? (
        <button type="button" className="candy-btn" onClick={onAddNotable}>
          + Add notable
        </button>
      ) : null}
      <button
        type="button"
        className="candy-btn"
        onClick={onSave}
        disabled={saving}
      >
        {saving ? "..." : "Save notables"}
      </button>
      {message ? <span className="retro-muted">{message}</span> : null}
    </div>
  );
}

function NotableCard({
  campaignId,
  notable,
  campaignDate,
  isDm,
  editable,
  onChange,
  onRemove,
  onPersist,
  onToggleVisibility,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
}: {
  campaignId: string;
  notable: Notable;
  campaignDate: ReturnType<typeof getCampaignCalendarDate>;
  isDm: boolean;
  editable: boolean;
  onChange: (notable: Notable) => void;
  onRemove: () => void;
  onPersist?: (notable: Notable) => Promise<void>;
  onToggleVisibility?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const events = sortNotableEvents(notable.events);
  const showPortrait = isDm || hasNotablePortrait(notable) || editable;

  function addEvent() {
    const nextOrder =
      notable.events.length > 0
        ? Math.min(...notable.events.map((event) => event.sortOrder)) - 1
        : 0;
    onChange({
      ...notable,
      events: [
        newNotableEvent(campaignDate, { sortOrder: nextOrder }),
        ...notable.events,
      ],
    });
  }

  function moveEvent(eventId: string, direction: -1 | 1) {
    onChange({
      ...notable,
      events: moveNotableEvent(notable.events, eventId, direction),
    });
  }

  function updateEvent(eventId: string, patch: Partial<NotableEvent>) {
    onChange({
      ...notable,
      events: notable.events.map((event) =>
        event.id === eventId ? { ...event, ...patch } : event
      ),
    });
  }

  function removeEvent(eventId: string) {
    onChange({
      ...notable,
      events: notable.events.filter((event) => event.id !== eventId),
    });
  }

  return (
    <section
      className={`retro-box${editable && !notable.visibleToPlayers ? " notable-card-dm-hidden" : ""}`}
    >
      <div className="notable-card-header">
        <div className="notable-card-fields">
          {editable ? (
            <>
              {!notable.visibleToPlayers ? (
                <p className="notable-hidden-label">Hidden from players</p>
              ) : null}
              <div className="notable-card-title-fields">
              <div>
                <label className="candy-label">Name</label>
                <input
                  className="candy-input"
                  value={notable.name}
                  onChange={(event) =>
                    onChange({ ...notable, name: event.target.value })
                  }
                />
              </div>
              <div>
                <label className="candy-label">Species</label>
                <input
                  className="candy-input"
                  value={notable.species}
                  onChange={(event) =>
                    onChange({ ...notable, species: event.target.value })
                  }
                />
              </div>
              <div>
                <label className="candy-label">Role</label>
                <input
                  className="candy-input"
                  value={notable.role}
                  onChange={(event) =>
                    onChange({ ...notable, role: event.target.value })
                  }
                />
              </div>
              <div>
                <label className="candy-label">Category</label>
                <select
                  className="candy-input"
                  value={notable.category}
                  onChange={(event) =>
                    onChange({
                      ...notable,
                      category: event.target.value as NotableCategory,
                    })
                  }
                >
                  {NOTABLE_CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              </div>
            </>
          ) : (
            <>
              {isDm && !notable.visibleToPlayers ? (
                <p className="notable-hidden-label">Hidden from players</p>
              ) : null}
              <p className="retro-box-title">
                {formatNotableNameLine(notable) || "Unnamed notable"}
              </p>
              {notable.role ? (
                <p className="retro-muted">{notable.role}</p>
              ) : null}
            </>
          )}

          <div className="notable-events-section">
            {editable ? (
              <p className="retro-edit-link notable-events-add">
                <button
                  type="button"
                  className="retro-inline-link"
                  onClick={addEvent}
                >
                  + Add event
                </button>
              </p>
            ) : null}

            {events.length === 0 ? (
              editable ? null : <p className="retro-muted">No events yet.</p>
            ) : (
              <div className="calendar-event-list">
                {events.map((event, index) =>
                  editable ? (
                    <NotableEventEditor
                      key={event.id}
                      event={event}
                      canMoveUp={index > 0}
                      canMoveDown={index < events.length - 1}
                      onMoveUp={() => moveEvent(event.id, -1)}
                      onMoveDown={() => moveEvent(event.id, 1)}
                      onChange={(patch) => updateEvent(event.id, patch)}
                      onRemove={() => removeEvent(event.id)}
                    />
                  ) : (
                    <NotableEventView key={event.id} event={event} />
                  )
                )}
              </div>
            )}
          </div>

          {editable ? (
            <p className="retro-edit-link notable-card-actions">
              <button
                type="button"
                className="retro-inline-link"
                disabled={!canMoveUp}
                onClick={onMoveUp}
              >
                Move up
              </button>
              <button
                type="button"
                className="retro-inline-link"
                disabled={!canMoveDown}
                onClick={onMoveDown}
              >
                Move down
              </button>
              {onToggleVisibility ? (
                <button
                  type="button"
                  className="retro-inline-link"
                  onClick={onToggleVisibility}
                >
                  {notable.visibleToPlayers ? "Hide" : "Reveal"}
                </button>
              ) : null}
              <button
                type="button"
                className="retro-inline-link"
                style={{ color: "#b00020" }}
                onClick={onRemove}
              >
                Remove notable
              </button>
            </p>
          ) : null}
        </div>

        {showPortrait ? (
          <NotablePortrait
            campaignId={campaignId}
            notable={notable}
            editable={editable}
            onChange={onChange}
            onPersist={onPersist}
          />
        ) : null}
      </div>
    </section>
  );
}

function NotableEventView({ event }: { event: NotableEvent }) {
  return (
    <div className="calendar-event-entry">
      <p className="retro-member-line">{formatNotableEventWhen(event)}</p>
      {event.text ? <p className="retro-muted">{event.text}</p> : null}
    </div>
  );
}

function NotableEventEditor({
  event,
  onChange,
  onRemove,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
}: {
  event: NotableEvent;
  onChange: (patch: Partial<NotableEvent>) => void;
  onRemove: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div className="calendar-event-entry">
      <div className="calendar-event-header">
        <label className="candy-label">Date</label>
        <span className="notable-event-editor-actions">
          <button
            type="button"
            className="retro-inline-link"
            disabled={!canMoveUp}
            onClick={onMoveUp}
          >
            Move up
          </button>
          <button
            type="button"
            className="retro-inline-link"
            disabled={!canMoveDown}
            onClick={onMoveDown}
          >
            Move down
          </button>
          <button
            type="button"
            className="retro-inline-link"
            style={{ color: "#b00020" }}
            onClick={onRemove}
          >
            Remove
          </button>
        </span>
      </div>
      <div className="calendar-event-date-row">
        {event.festival ? (
          <div className="calendar-event-festival-label">
            <label className="candy-label">Festival</label>
            <p className="retro-member-line">
              {getFestivalById(event.festival)?.name ?? event.festival}
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className="candy-label">Month</label>
              <select
                className="candy-input"
                value={event.month}
                onChange={(changeEvent) =>
                  onChange({ month: Number(changeEvent.target.value) })
                }
              >
                {HARPTOS_MONTHS.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="candy-label">Day</label>
              <input
                className="candy-input"
                type="number"
                min={1}
                max={30}
                value={event.day}
                onChange={(changeEvent) =>
                  onChange({ day: Number(changeEvent.target.value) || 1 })
                }
              />
            </div>
          </>
        )}
        <div>
          <label className="candy-label">Year</label>
          <input
            className="candy-input"
            type="number"
            min={0}
            value={event.year}
            onChange={(changeEvent) =>
              onChange({ year: Number(changeEvent.target.value) || 0 })
            }
          />
        </div>
      </div>
      <label className="candy-label">Event</label>
      <textarea
        className="candy-input notable-event-text"
        rows={2}
        value={event.text}
        onChange={(changeEvent) =>
          onChange({ text: changeEvent.target.value })
        }
      />
    </div>
  );
}

function NotablePortrait({
  campaignId,
  notable,
  editable,
  onChange,
  onPersist,
}: {
  campaignId: string;
  notable: Notable;
  editable: boolean;
  onChange: (notable: Notable) => void;
  onPersist?: (notable: Notable) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [storedUrl, setStoredUrl] = useState<string | null>(null);
  const externalUrl = notable.portraitUrl.trim() || null;
  const displayUrl = storedUrl ?? externalUrl;

  useEffect(() => {
    const path = notable.portraitPath.trim();
    if (!path) {
      setStoredUrl(null);
      return;
    }
    setStoredUrl(getNotablePortraitUrl(createClient(), path));
  }, [notable.portraitPath]);

  async function handleFile(file: File) {
    setUploading(true);
    setMessage(null);

    const supabase = createClient();
    const previousPath = notable.portraitPath.trim() || null;
    const { path, error } = await uploadNotablePortrait(
      supabase,
      campaignId,
      notable.id,
      file
    );

    if (error || !path) {
      setMessage(error ?? "Upload failed");
      setUploading(false);
      return;
    }

    const nextNotable = {
      ...notable,
      portraitPath: path,
      portraitUrl: "",
    };
    onChange(nextNotable);
    if (onPersist) await onPersist(nextNotable);

    if (previousPath && previousPath !== path) {
      await removeNotablePortrait(supabase, previousPath);
    }

    setUploading(false);
  }

  async function handleRemove() {
    if (!hasNotablePortrait(notable)) return;
    if (!window.confirm("Remove this portrait?")) return;

    setUploading(true);
    setMessage(null);

    const supabase = createClient();
    const previousPath = notable.portraitPath.trim() || null;

    const nextNotable = {
      ...notable,
      portraitPath: "",
      portraitUrl: "",
    };
    onChange(nextNotable);
    if (onPersist) await onPersist(nextNotable);

    if (previousPath) {
      const error = await removeNotablePortrait(supabase, previousPath);
      if (error) setMessage(error);
    }

    setUploading(false);
  }

  return (
    <div className="notable-portrait">
      <div
        className={`notable-portrait-frame${displayUrl ? "" : " notable-portrait-frame-empty"}`}
      >
        {displayUrl ? (
          <NotablePortraitImage
            url={displayUrl}
            name={notable.name}
            external={!storedUrl}
          />
        ) : (
          <div className="character-portrait-placeholder" aria-hidden>
            <User className="character-portrait-silhouette" strokeWidth={1.25} />
          </div>
        )}
      </div>

      {editable ? (
        <div className="character-portrait-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleFile(file);
            }}
          />
          <button
            type="button"
            className="candy-btn candy-btn-sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "…" : displayUrl ? "Replace" : "Upload"}
          </button>
          {displayUrl ? (
            <button
              type="button"
              className="retro-inline-link"
              disabled={uploading}
              onClick={() => void handleRemove()}
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p className="character-portrait-message text-destructive">{message}</p>
      ) : null}
    </div>
  );
}

function NotablePortraitImage({
  url,
  name,
  external = false,
}: {
  url: string;
  name: string;
  external?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="notable-portrait-placeholder" aria-hidden>
        <span className="retro-muted" style={{ fontSize: "10px", padding: "8px" }}>
          Portrait unavailable
        </span>
      </div>
    );
  }

  return (
    // Fandom CDN blocks hotlinked images unless referer is stripped.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name ? `Portrait of ${name}` : ""}
      className="notable-portrait-image"
      referrerPolicy={external ? "no-referrer" : undefined}
      onError={() => setFailed(true)}
    />
  );
}

function formatNotableEventWhen(event: NotableEvent): string {
  return formatHarptosDateShort(notableEventToHarptosDate(event));
}
