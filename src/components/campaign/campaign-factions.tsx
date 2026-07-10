"use client";

import { useEffect, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useShowDmUi } from "@/components/layout/dm-view-provider";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { LoreCategoryTabs } from "@/components/campaign/lore-category-tabs";
import { LoreEventEditor, LoreEventView } from "@/components/campaign/lore-event-fields";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeFactionsData } from "@/lib/hooks/use-realtime-factions-data";
import { useRealtimeNotablesData } from "@/lib/hooks/use-realtime-notables-data";
import { useRealtimeWorldData } from "@/lib/hooks/use-realtime-world-data";
import {
  itemCountsByCategory,
  newCategory,
} from "@/lib/schemas/lore-category";
import {
  filterFactionMembersForViewer,
  filterFactionsByCategory,
  filterFactionsForViewer,
  formatFactionMemberLine,
  moveFactionEvent,
  newFaction,
  newFactionEvent,
  sortFactionEvents,
  type Faction,
  type FactionEvent,
  type FactionsData,
} from "@/lib/schemas/factions";
import {
  filterNotablesForViewer,
  type NotablesData,
} from "@/lib/schemas/notables";
import {
  getCampaignCalendarDate,
  type WorldData,
} from "@/lib/schemas/world";

interface CampaignFactionsProps {
  campaignId: string;
  initialFactionsData: FactionsData;
  initialNotablesData: NotablesData;
  initialWorldData: WorldData;
  isDm: boolean;
  canEditFactions: boolean;
}

function factionCategoryTabStorageKey(campaignId: string) {
  return `campaign-faction-category-tab-${campaignId}`;
}

function parseStoredFactionCategory(
  stored: string | null,
  categoryIds: Set<string>
): string | null {
  if (stored === null || stored === "") return null;
  return categoryIds.has(stored) ? stored : null;
}

export function CampaignFactions({
  campaignId,
  initialFactionsData,
  initialNotablesData,
  initialWorldData,
  isDm,
  canEditFactions,
}: CampaignFactionsProps) {
  const showDmUi = useShowDmUi(isDm);
  const liveFactionsData = useRealtimeFactionsData(
    campaignId,
    initialFactionsData
  );
  const liveNotablesData = useRealtimeNotablesData(
    campaignId,
    initialNotablesData
  );
  const worldData = useRealtimeWorldData(campaignId, initialWorldData);
  const campaignDate = getCampaignCalendarDate(worldData);
  const [draft, setDraft] = useState(liveFactionsData);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [restoredCategoryTab, setRestoredCategoryTab] = useState(false);
  const [editing, setEditing] = useState(false);
  const [factionPendingRemoval, setFactionPendingRemoval] =
    useState<Faction | null>(null);

  const editable = canEditFactions && editing;

  useEffect(() => {
    if (!canEditFactions) return;
    setDraft(liveFactionsData);
  }, [liveFactionsData, canEditFactions]);

  useEffect(() => {
    setRestoredCategoryTab(false);
    setActiveCategory(null);
  }, [campaignId]);

  useEffect(() => {
    if (restoredCategoryTab) return;
    const categoryIds = new Set(
      liveFactionsData.categories.map((category) => category.id)
    );
    const stored = localStorage.getItem(factionCategoryTabStorageKey(campaignId));
    setActiveCategory(parseStoredFactionCategory(stored, categoryIds));
    setRestoredCategoryTab(true);
  }, [campaignId, restoredCategoryTab, liveFactionsData.categories]);

  const factionsData = editable ? draft : liveFactionsData;
  const categories = factionsData.categories;
  const categoryItemCounts = useMemo(
    () => itemCountsByCategory(factionsData.factions, categories),
    [factionsData.factions, categories]
  );
  const savedCategoriesById = useMemo(
    () =>
      new Map(
        liveFactionsData.factions.map((faction) => [faction.id, faction.category])
      ),
    [liveFactionsData.factions]
  );
  const visibleFactions = useMemo(() => {
    if (!activeCategory) return [];
    const inCategory = filterFactionsByCategory(
      factionsData.factions,
      activeCategory,
      editable ? savedCategoriesById : undefined
    );
    return filterFactionsForViewer(inCategory, showDmUi || editable);
  }, [
    activeCategory,
    editable,
    showDmUi,
    factionsData.factions,
    savedCategoriesById,
  ]);

  const pickerNotables = useMemo(
    () => filterNotablesForViewer(liveNotablesData.notables, showDmUi || editable),
    [liveNotablesData.notables, showDmUi, editable]
  );

  function selectCategory(categoryId: string | null) {
    setActiveCategory(categoryId);
    localStorage.setItem(factionCategoryTabStorageKey(campaignId), categoryId ?? "");
  }

  function addCategory(label: string) {
    if (!editable) return;
    const nextCategory = newCategory(
      label,
      draft.categories.length > 0
        ? Math.max(...draft.categories.map((category) => category.sortOrder)) + 1
        : 0
    );
    const nextDraft = {
      ...draft,
      categories: [...draft.categories, nextCategory],
    };
    setDraft(nextDraft);
    selectCategory(nextCategory.id);
  }

  function renameCategory(categoryId: string, label: string) {
    if (!editable) return;
    setDraft({
      ...draft,
      categories: draft.categories.map((category) =>
        category.id === categoryId ? { ...category, label } : category
      ),
    });
  }

  function removeCategory(categoryId: string) {
    if (!editable) return;
    if ((categoryItemCounts.get(categoryId) ?? 0) > 0) return;
    setDraft({
      ...draft,
      categories: draft.categories.filter((category) => category.id !== categoryId),
    });
    if (activeCategory === categoryId) {
      selectCategory(null);
    }
  }

  async function saveFactionsData(nextDraft: FactionsData) {
    const supabase = createClient();
    const { error } = await supabase.rpc("update_campaign_factions", {
      p_campaign_id: campaignId,
      p_factions_data: nextDraft,
    });
    return error;
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const error = await saveFactionsData(draft);
    setMessage(error ? error.message : "Saved");
    setSaving(false);
  }

  function updateFactions(nextFactions: Faction[]) {
    if (!editable) return;
    setDraft({ ...draft, factions: nextFactions });
  }

  function addFaction(placement: "top" | "bottom") {
    if (!activeCategory) return;
    const categoryFactions = filterFactionsByCategory(
      draft.factions,
      activeCategory,
      editable ? savedCategoriesById : undefined
    );
    const nextOrder =
      categoryFactions.length > 0
        ? placement === "top"
          ? Math.min(...categoryFactions.map((faction) => faction.sortOrder)) - 1
          : Math.max(...categoryFactions.map((faction) => faction.sortOrder)) + 1
        : 0;
    updateFactions([
      ...draft.factions,
      newFaction({ category: activeCategory }, nextOrder),
    ]);
  }

  function moveFaction(factionId: string, direction: -1 | 1) {
    if (!activeCategory) return;
    const ordered = filterFactionsByCategory(
      draft.factions,
      activeCategory,
      editable ? savedCategoriesById : undefined
    );
    const index = ordered.findIndex((faction) => faction.id === factionId);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return;

    const reordered = [...ordered];
    const current = reordered[index];
    const swap = reordered[swapIndex];
    reordered[index] = { ...swap, sortOrder: current.sortOrder };
    reordered[swapIndex] = { ...current, sortOrder: swap.sortOrder };

    const updatedIds = new Map(reordered.map((faction) => [faction.id, faction]));
    updateFactions(
      draft.factions.map((faction) => updatedIds.get(faction.id) ?? faction)
    );
  }

  function toggleFactionVisibility(faction: Faction) {
    updateFactions(
      draft.factions.map((entry) =>
        entry.id === faction.id
          ? { ...entry, visibleToPlayers: !entry.visibleToPlayers }
          : entry
      )
    );
  }

  function confirmRemoveFaction() {
    if (!factionPendingRemoval) return;
    updateFactions(
      draft.factions.filter((entry) => entry.id !== factionPendingRemoval.id)
    );
    setFactionPendingRemoval(null);
  }

  const removeFactionLabel =
    factionPendingRemoval?.name.trim() || "this faction";

  return (
    <div className="retro-stack party-overview-stack">
      {canEditFactions ? (
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

      <LoreCategoryTabs
        categories={categories}
        activeCategoryId={activeCategory}
        editable={editable}
        itemCountsByCategory={categoryItemCounts}
        onSelect={selectCategory}
        onAdd={addCategory}
        onRename={renameCategory}
        onRemove={removeCategory}
      />

      <div className="retro-stack notable-stack">
        {editable && activeCategory ? (
          <FactionsSaveBar
            saving={saving}
            message={message}
            onSave={save}
            onAddFaction={() => addFaction("top")}
          />
        ) : null}

        {editable && categories.length === 0 ? (
          <p className="retro-hint retro-muted">Add a category to start tracking factions.</p>
        ) : null}

        {activeCategory && visibleFactions.length === 0 ? (
          <p className="retro-hint retro-muted">No factions in this category yet.</p>
        ) : (
          visibleFactions.map((faction, index) => (
            <FactionCard
              key={faction.id}
              faction={faction}
              categories={categories}
              campaignDate={campaignDate}
              pickerNotables={pickerNotables}
              allNotables={liveNotablesData.notables}
              isDm={showDmUi}
              editable={editable}
              canMoveUp={editable && index > 0}
              canMoveDown={editable && index < visibleFactions.length - 1}
              onMoveUp={() => moveFaction(faction.id, -1)}
              onMoveDown={() => moveFaction(faction.id, 1)}
              onChange={(next) =>
                updateFactions(
                  draft.factions.map((entry) =>
                    entry.id === faction.id ? next : entry
                  )
                )
              }
              onToggleVisibility={
                editable && showDmUi
                  ? () => toggleFactionVisibility(faction)
                  : undefined
              }
              onRemove={() => setFactionPendingRemoval(faction)}
            />
          ))
        )}

        {editable && activeCategory ? (
          <FactionsSaveBar
            saving={saving}
            message={message}
            onSave={save}
            onAddFaction={() => addFaction("bottom")}
          />
        ) : null}
      </div>

      <ConfirmModal
        open={factionPendingRemoval !== null}
        title="Remove faction?"
        description={`Remove ${removeFactionLabel}? This cannot be undone.`}
        confirmLabel="Remove"
        destructive
        onCancel={() => setFactionPendingRemoval(null)}
        onConfirm={confirmRemoveFaction}
      />
    </div>
  );
}

function FactionsSaveBar({
  saving,
  message,
  onSave,
  onAddFaction,
}: {
  saving: boolean;
  message: string | null;
  onSave: () => void;
  onAddFaction?: () => void;
}) {
  return (
    <div className="party-inventory-save">
      {onAddFaction ? (
        <button type="button" className="candy-btn" onClick={onAddFaction}>
          + Add faction
        </button>
      ) : null}
      <button
        type="button"
        className="candy-btn"
        onClick={onSave}
        disabled={saving}
      >
        {saving ? "..." : "Save factions"}
      </button>
      {message ? <span className="retro-muted">{message}</span> : null}
    </div>
  );
}

function FactionCard({
  faction,
  categories,
  campaignDate,
  pickerNotables,
  allNotables,
  isDm,
  editable,
  onChange,
  onRemove,
  onToggleVisibility,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
}: {
  faction: Faction;
  categories: FactionsData["categories"];
  campaignDate: ReturnType<typeof getCampaignCalendarDate>;
  pickerNotables: ReturnType<typeof filterNotablesForViewer>;
  allNotables: ReturnType<typeof filterNotablesForViewer>;
  isDm: boolean;
  editable: boolean;
  onChange: (faction: Faction) => void;
  onRemove: () => void;
  onToggleVisibility?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const events = sortFactionEvents(faction.events);
  const [memberToAdd, setMemberToAdd] = useState("");
  const visibleMembers = filterFactionMembersForViewer(
    faction.memberNotableIds,
    allNotables,
    isDm || editable
  );
  const availableMembers = pickerNotables.filter(
    (notable) => !faction.memberNotableIds.includes(notable.id)
  );

  function addEvent() {
    const nextOrder =
      faction.events.length > 0
        ? Math.min(...faction.events.map((event) => event.sortOrder)) - 1
        : 0;
    onChange({
      ...faction,
      events: [
        newFactionEvent(campaignDate, { sortOrder: nextOrder }),
        ...faction.events,
      ],
    });
  }

  function moveEvent(eventId: string, direction: -1 | 1) {
    onChange({
      ...faction,
      events: moveFactionEvent(faction.events, eventId, direction),
    });
  }

  function updateEvent(eventId: string, patch: Partial<FactionEvent>) {
    onChange({
      ...faction,
      events: faction.events.map((event) =>
        event.id === eventId ? { ...event, ...patch } : event
      ),
    });
  }

  function removeEvent(eventId: string) {
    onChange({
      ...faction,
      events: faction.events.filter((event) => event.id !== eventId),
    });
  }

  function addMember() {
    if (!memberToAdd || faction.memberNotableIds.includes(memberToAdd)) return;
    onChange({
      ...faction,
      memberNotableIds: [...faction.memberNotableIds, memberToAdd],
    });
    setMemberToAdd("");
  }

  function removeMember(notableId: string) {
    onChange({
      ...faction,
      memberNotableIds: faction.memberNotableIds.filter((id) => id !== notableId),
    });
  }

  return (
    <section
      className={`retro-box${editable && !faction.visibleToPlayers ? " notable-card-dm-hidden" : ""}`}
    >
      {editable ? (
        <>
          {!faction.visibleToPlayers ? (
            <p className="notable-hidden-label">Hidden from players</p>
          ) : null}
          <div className="notable-card-title-fields">
            <div>
              <label className="candy-label">Name</label>
              <input
                className="candy-input"
                value={faction.name}
                onChange={(event) =>
                  onChange({ ...faction, name: event.target.value })
                }
              />
            </div>
            <div>
              <label className="candy-label">Type</label>
              <input
                className="candy-input"
                value={faction.type}
                onChange={(event) =>
                  onChange({ ...faction, type: event.target.value })
                }
              />
            </div>
            <div>
              <label className="candy-label">Goals</label>
              <textarea
                className="candy-input"
                rows={2}
                value={faction.goals}
                onChange={(event) =>
                  onChange({ ...faction, goals: event.target.value })
                }
              />
            </div>
            <div>
              <label className="candy-label">Category</label>
              <select
                className="candy-input"
                value={faction.category}
                onChange={(event) =>
                  onChange({ ...faction, category: event.target.value })
                }
              >
                {categories.map((category) => (
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
          {isDm && !faction.visibleToPlayers ? (
            <p className="notable-hidden-label">Hidden from players</p>
          ) : null}
          <p className="retro-box-title">
            {faction.name.trim() || "Unnamed faction"}
          </p>
          {faction.type ? <p className="retro-muted">{faction.type}</p> : null}
          {faction.goals ? <p className="retro-muted">{faction.goals}</p> : null}
        </>
      )}

      <div className="faction-members-section">
        <p className="candy-label">Members</p>
        {visibleMembers.length === 0 ? (
          <p className="retro-muted">No members yet.</p>
        ) : (
          <ul className="faction-member-list">
            {visibleMembers.map((notable) => (
              <li key={notable.id} className="faction-member-row">
                <span>{formatFactionMemberLine(notable)}</span>
                {editable ? (
                  <button
                    type="button"
                    className="retro-inline-link"
                    style={{ color: "#b00020" }}
                    onClick={() => removeMember(notable.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {editable ? (
          <div className="faction-member-add-row">
            <select
              className="candy-input"
              value={memberToAdd}
              onChange={(event) => setMemberToAdd(event.target.value)}
            >
              <option value="">Select notable…</option>
              {availableMembers.map((notable) => (
                <option key={notable.id} value={notable.id}>
                  {formatFactionMemberLine(notable)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="candy-btn candy-btn-sm"
              disabled={!memberToAdd}
              onClick={addMember}
            >
              + Add member
            </button>
          </div>
        ) : null}
      </div>

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
                <LoreEventEditor
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
                <LoreEventView key={event.id} event={event} />
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
              {faction.visibleToPlayers ? "Hide" : "Reveal"}
            </button>
          ) : null}
          <button
            type="button"
            className="retro-inline-link"
            style={{ color: "#b00020" }}
            onClick={onRemove}
          >
            Remove faction
          </button>
        </p>
      ) : null}
    </section>
  );
}
