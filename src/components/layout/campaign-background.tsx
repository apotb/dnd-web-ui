"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { Tooltip } from "@/components/ui/tooltip";

const STORAGE_KEY = "campaign-background-enabled";

function readEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "true";
    return document.documentElement.dataset.campaignBg !== "off";
  } catch {
    return true;
  }
}

function syncBackgroundDom(enabled: boolean) {
  document.documentElement.classList.toggle("campaign-bg-active", enabled);
  document.documentElement.dataset.campaignBg = enabled ? "on" : "off";
}

export function CampaignBackground() {
  const [enabled, setEnabled] = useState(readEnabled);

  useLayoutEffect(() => {
    document.documentElement.dataset.campaignBgTransitions = "true";
    syncBackgroundDom(readEnabled());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(enabled));
    syncBackgroundDom(enabled);
  }, [enabled]);

  return (
    <>
      <div className="campaign-bg" aria-hidden="true">
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
          suppressHydrationWarning
        >
          {enabled ? "◧ BG" : "◻ BG"}
        </button>
      </Tooltip>
    </>
  );
}
