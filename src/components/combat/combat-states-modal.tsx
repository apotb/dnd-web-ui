"use client";

import { useEffect, useMemo, useState } from "react";
import { ConditionsEditor } from "@/components/character/conditions-editor";
import { conditionsEqual } from "@/lib/combat/combat-conditions";
import { fetchCatalogConditionsClient } from "@/lib/content/catalog-client";
import type { PhbCondition } from "@/lib/dnd/conditions";

interface CombatStatesModalProps {
  tokenLabel: string;
  conditions: string[];
  protectedSlugs: string[];
  saving?: boolean;
  onCancel: () => void;
  onSave: (conditions: string[]) => void;
}

export function CombatStatesModal({
  tokenLabel,
  conditions,
  protectedSlugs,
  saving = false,
  onCancel,
  onSave,
}: CombatStatesModalProps) {
  const [catalog, setCatalog] = useState<PhbCondition[]>([]);
  const [draft, setDraft] = useState(conditions);

  useEffect(() => {
    void fetchCatalogConditionsClient().then(setCatalog);
  }, []);

  useEffect(() => {
    setDraft(conditions);
  }, [conditions]);

  const dirty = useMemo(() => !conditionsEqual(draft, conditions), [draft, conditions]);

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-roll-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">States</p>
        <p className="combat-roll-line retro-muted">{tokenLabel}</p>

        <div className="combat-roll-body">
          <ConditionsEditor
            conditions={draft}
            catalog={catalog}
            editable
            protectedSlugs={protectedSlugs}
            onChange={setDraft}
          />
        </div>

        <div className="supply-picker-actions combat-roll-actions">
          <button type="button" className="candy-btn" disabled={saving} onClick={onCancel}>
            Cancel
          </button>
          <div className="combat-roll-right-actions">
            <button
              type="button"
              className="candy-btn"
              disabled={!dirty || saving}
              onClick={() => onSave(draft)}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
