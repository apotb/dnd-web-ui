"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "campaign-background-enabled";

export function CampaignBackground() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setEnabled(stored === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }, [enabled]);

  return (
    <>
      <div
        className={`campaign-bg${enabled ? "" : " campaign-bg-hidden"}`}
        aria-hidden="true"
      >
        <div className="campaign-bg-image" />
        <div className="campaign-bg-scrim" />
      </div>

      <button
        type="button"
        className="campaign-bg-toggle"
        onClick={() => setEnabled((value) => !value)}
        aria-pressed={enabled}
        aria-label={enabled ? "Hide background" : "Show background"}
        title={enabled ? "Hide background" : "Show background"}
      >
        {enabled ? "◧ BG" : "◻ BG"}
      </button>
    </>
  );
}
