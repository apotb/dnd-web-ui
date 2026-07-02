"use client";

import { useEffect, useState } from "react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useShowDmUi } from "@/components/layout/dm-view-provider";
import { formatHarptosDate } from "@/lib/dnd/harptos-calendar";
import { useRealtimeSoulmongerData } from "@/lib/hooks/use-realtime-soulmonger-data";
import {
  newSoulmongerSoul,
  type SoulmongerData,
} from "@/lib/schemas/soulmonger";
import { createClient } from "@/lib/supabase/client";

interface CampaignSoulmongerProps {
  campaignId: string;
  initialSoulmongerData: SoulmongerData;
  isDm: boolean;
}

type PendingSoulRemoval = {
  id: string;
  name: string;
  source: "active" | "devoured";
};

export function CampaignSoulmonger({
  campaignId,
  initialSoulmongerData,
  isDm,
}: CampaignSoulmongerProps) {
  const showDmUi = useShowDmUi(isDm);
  const liveSoulmongerData = useRealtimeSoulmongerData(
    campaignId,
    initialSoulmongerData
  );
  const [draft, setDraft] = useState(liveSoulmongerData);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] =
    useState<PendingSoulRemoval | null>(null);

  useEffect(() => {
    if (!showDmUi) return;
    setDraft(liveSoulmongerData);
  }, [liveSoulmongerData, showDmUi]);

  if (!showDmUi) return null;

  async function save() {
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("campaigns")
      .update({ soulmonger_data: draft })
      .eq("id", campaignId);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Saved");
    }
    setSaving(false);
  }

  function addSoul() {
    const nextSortOrder =
      draft.active.reduce(
        (max, soul) => Math.max(max, soul.sortOrder),
        -1
      ) + 1;
    setDraft({
      ...draft,
      active: [...draft.active, newSoulmongerSoul("", nextSortOrder)],
    });
  }

  function updateSoulName(id: string, name: string) {
    setDraft({
      ...draft,
      active: draft.active.map((soul) =>
        soul.id === id ? { ...soul, name } : soul
      ),
    });
  }

  function requestRemoveSoul(
    id: string,
    name: string,
    source: PendingSoulRemoval["source"]
  ) {
    setPendingRemoval({ id, name, source });
  }

  function confirmRemoveSoul() {
    if (!pendingRemoval) return;

    if (pendingRemoval.source === "active") {
      setDraft({
        ...draft,
        active: draft.active.filter((entry) => entry.id !== pendingRemoval.id),
      });
    } else {
      setDraft({
        ...draft,
        devoured: draft.devoured.filter(
          (entry) => entry.id !== pendingRemoval.id
        ),
      });
    }

    setPendingRemoval(null);
  }

  const devouredSouls = [...draft.devoured].sort((a, b) => {
    const dateCompare =
      b.devouredOn.year - a.devouredOn.year ||
      b.devouredOn.month - a.devouredOn.month ||
      b.devouredOn.day - a.devouredOn.day;
    if (dateCompare !== 0) return dateCompare;
    return a.name.localeCompare(b.name);
  });

  const pendingRemovalLabel =
    pendingRemoval?.name.trim() || "this soul";

  return (
    <section className="retro-box soulmonger-section">
      <div className="retro-section-header">
        <p className="retro-box-title">Soulmonger</p>
        <button type="button" className="retro-inline-link" onClick={addSoul}>
          + Add soul
        </button>
      </div>

      <p className="retro-muted soulmonger-intro">
        Track souls held in the Soulmonger. Each day you advance the calendar,
        roll a d20 for each active soul — a 1 means devoured.
      </p>

      {draft.active.length === 0 ? (
        <p className="retro-muted">No active souls.</p>
      ) : (
        <ul className="soulmonger-active-list">
          {draft.active.map((soul) => (
            <li key={soul.id} className="soulmonger-active-row">
              <input
                className="candy-input soulmonger-name-input"
                type="text"
                value={soul.name}
                placeholder="Soul name"
                onChange={(event) => updateSoulName(soul.id, event.target.value)}
              />
              <button
                type="button"
                className="retro-inline-link soulmonger-remove-btn"
                onClick={() =>
                  requestRemoveSoul(
                    soul.id,
                    soul.name,
                    "active"
                  )
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="soulmonger-save">
        <button
          type="button"
          className="candy-btn"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? "..." : "Save Soulmonger"}
        </button>
        {message ? <span className="retro-muted">{message}</span> : null}
      </div>

      {devouredSouls.length > 0 ? (
        <div className="soulmonger-devoured">
          <p className="retro-box-title">Devoured</p>
          <ul className="soulmonger-devoured-list">
            {devouredSouls.map((soul) => (
              <li key={soul.id} className="soulmonger-devoured-row">
                <div className="soulmonger-devoured-info">
                  <strong>{soul.name.trim() || "Unnamed soul"}</strong>
                  <span className="retro-muted">
                    {formatHarptosDate(soul.devouredOn)}
                  </span>
                </div>
                <button
                  type="button"
                  className="retro-inline-link soulmonger-remove-btn"
                  onClick={() =>
                    requestRemoveSoul(
                      soul.id,
                      soul.name,
                      "devoured"
                    )
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ConfirmModal
        open={pendingRemoval !== null}
        title={
          pendingRemoval?.source === "devoured"
            ? "Remove devoured soul?"
            : "Remove soul?"
        }
        description={
          pendingRemoval?.source === "devoured"
            ? `Remove ${pendingRemovalLabel} from the devoured list? This cannot be undone.`
            : `Remove ${pendingRemovalLabel} from the Soulmonger? This cannot be undone.`
        }
        confirmLabel="Remove"
        destructive
        onCancel={() => setPendingRemoval(null)}
        onConfirm={confirmRemoveSoul}
      />
    </section>
  );
}
