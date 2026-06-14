"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "creator-intro-dismissed";

export function IntroContent({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="creator-intro-overlay" onClick={onDismiss}>
      <div
        className="creator-intro-modal retro-box"
        onClick={(e) => e.stopPropagation()}
      >
        <p>
          For whatever reason you determine, your character has decided to come
          to the distant land of Chult. After docking in Port Nyanzaru, it
          becomes clear you are not the only one to have this idea. The city is
          packed at all times of day and stays busy well into the night. Dozens
          of ships arrive and depart every day. With all the people clamoring
          for work, any job opportunity seems like a good one.
        </p>
        <p>As you pass by the taverns, you see a sign posted on a nearby wall:</p>
        <blockquote className="creator-intro-sign">
          <p>BODYGUARDS NEEDED</p>
          <p>Private memorial service. Four capable individuals required.</p>
          <p>Expected duties:</p>
          <ul>
            <li>Crowd control</li>
            <li>Estate security</li>
            <li>Protection of mourners</li>
            <li>Discretion regarding the deceased</li>
          </ul>
          <p>Bonus pay if violence occurs.</p>
          <p>No questions asked.</p>
          <p>
            Report to Kaya&apos;s House of Repose by sunset.
            <br />
            Ask for Kwalu.
          </p>
        </blockquote>
        <p>Think about these questions when designing your character:</p>
        <ol className="creator-intro-questions">
          <li>What brought you to Port Nyanzaru?</li>
          <li>Why would you accept this sketchy job?</li>
        </ol>
        <div style={{ marginTop: "16px", display: "flex", justifyContent: "center" }}>
          <button type="button" className="candy-btn" style={{ width: "auto", padding: "10px 32px" }} onClick={onDismiss}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

/** Auto-shows on first visit; use IntroContent for the manual trigger. */
export function CreatorIntroModal({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(`${STORAGE_KEY}-${campaignId}`);
    if (!dismissed) setOpen(true);
  }, [campaignId]);

  function dismiss() {
    localStorage.setItem(`${STORAGE_KEY}-${campaignId}`, "1");
    setOpen(false);
  }

  if (!open) return null;
  return <IntroContent onDismiss={dismiss} />;
}
