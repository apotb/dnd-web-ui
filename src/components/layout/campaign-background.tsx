"use client";

import { useEffect, useState } from "react";
import { Tooltip } from "@/components/ui/tooltip";

const STORAGE_KEY = "campaign-background-enabled";

export function CampaignBackground() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial = stored !== null ? stored === "true" : true;
    setEnabled(initial);
    document.documentElement.classList.toggle("campaign-bg-active", initial);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(enabled));
    document.documentElement.classList.toggle("campaign-bg-active", enabled);
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

      <Tooltip content={enabled ? "Hide background" : "Show background"}>
        <button
          type="button"
          className="campaign-bg-toggle"
          onClick={() => setEnabled((value) => !value)}
          aria-pressed={enabled}
          aria-label={enabled ? "Hide background" : "Show background"}
        >
          {enabled ? "◧ BG" : "◻ BG"}
        </button>
      </Tooltip>
    </>
  );
}
