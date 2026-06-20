"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface CharacterDeleteButtonProps {
  characterId: string;
  campaignId: string;
  characterName: string;
}

export function CharacterDeleteButton({
  characterId,
  campaignId,
  characterName,
}: CharacterDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("characters").delete().eq("id", characterId);
    setOpen(false);
    router.push(`/campaigns/${campaignId}/characters`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className="retro-inline-link text-sm"
        onClick={() => setOpen(true)}
      >
        delete
      </button>
      {open ? (
        <div className="supply-picker-overlay" onClick={() => setOpen(false)}>
          <div
            className="supply-picker-modal retro-box"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="retro-box-title">Delete character?</p>
            <p className="retro-muted">
              This will permanently delete <strong>{characterName}</strong>.
              This cannot be undone.
            </p>
            <div
              className="supply-picker-actions"
              style={{ gap: "8px", justifyContent: "flex-end" }}
            >
              <button
                type="button"
                className="candy-btn"
                onClick={() => setOpen(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="candy-btn"
                onClick={() => void confirmDelete()}
                disabled={deleting}
              >
                {deleting ? "..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
