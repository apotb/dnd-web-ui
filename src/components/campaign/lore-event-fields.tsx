"use client";

import {
  formatHarptosDateShort,
  getFestivalById,
  HARPTOS_MONTHS,
} from "@/lib/dnd/harptos-calendar";
import {
  loreEventToHarptosDate,
  type LoreEvent,
} from "@/lib/schemas/lore-event";

export function LoreEventView({ event }: { event: LoreEvent }) {
  return (
    <div className="calendar-event-entry">
      <p className="retro-member-line">{formatLoreEventWhen(event)}</p>
      {event.text ? <p className="retro-muted">{event.text}</p> : null}
    </div>
  );
}

export function LoreEventEditor({
  event,
  onChange,
  onRemove,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
}: {
  event: LoreEvent;
  onChange: (patch: Partial<LoreEvent>) => void;
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

function formatLoreEventWhen(event: LoreEvent): string {
  return formatHarptosDateShort(loreEventToHarptosDate(event));
}
