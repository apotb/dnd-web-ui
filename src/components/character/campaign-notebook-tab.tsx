"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

interface CampaignNotebookTabProps {
  campaignId: string;
  userId: string | null;
  canUseNotebook: boolean;
}

export function CampaignNotebookTab({
  campaignId,
  userId,
  canUseNotebook,
}: CampaignNotebookTabProps) {
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);

  const dirty = savedContent !== null && content !== savedContent;

  useEffect(() => {
    if (!userId || !canUseNotebook) return;

    const key = `${campaignId}:${userId}`;
    if (loadedFor.current === key) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSaveMessage(null);

    const supabase = createClient();
    supabase
      .from("campaign_notebooks")
      .select("content")
      .eq("campaign_id", campaignId)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLoadError(error.message);
          setSavedContent(null);
        } else {
          const loaded = data?.content ?? "";
          setContent(loaded);
          setSavedContent(loaded);
          loadedFor.current = key;
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId, userId, canUseNotebook]);

  const save = useCallback(async () => {
    if (!userId || !canUseNotebook || loading) return;

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    const supabase = createClient();
    const { error } = await supabase.from("campaign_notebooks").upsert(
      {
        user_id: userId,
        campaign_id: campaignId,
        content,
      },
      { onConflict: "user_id,campaign_id" }
    );

    if (error) {
      setSaveError(error.message);
    } else {
      setSavedContent(content);
      setSaveMessage("Saved");
    }

    setSaving(false);
  }, [campaignId, content, canUseNotebook, loading, userId]);

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;

    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
      } catch {
        return;
      }

      if (
        !window.confirm(
          "You have unsaved changes. Leave without saving?"
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  function SaveButton() {
    return (
      <button
        type="button"
        className="candy-btn"
        style={{ width: "auto" }}
        disabled={loading || saving || !dirty}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save notes"}
      </button>
    );
  }

  if (!userId) {
    return (
      <p className="text-sm text-muted-foreground">
        You need to log in to use this feature.
      </p>
    );
  }

  if (!canUseNotebook) {
    return (
      <p className="text-sm text-muted-foreground">
        Claim a character in this campaign to use your notebook.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SaveButton />
        {dirty ? (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        ) : null}
        {saveMessage ? (
          <span className="text-xs text-muted-foreground">{saveMessage}</span>
        ) : null}
        {saveError ? (
          <span className="text-xs text-destructive">{saveError}</span>
        ) : null}
      </div>

      <Textarea
        rows={20}
        className="min-h-[320px] resize-y"
        value={content}
        disabled={loading}
        placeholder={loading ? "Loading…" : "Campaign notes…"}
        onChange={(e) => {
          setContent(e.target.value);
          setSaveMessage(null);
          setSaveError(null);
        }}
      />

      {loadError ? (
        <p className="text-xs text-destructive">Could not load notes: {loadError}</p>
      ) : null}

      <SaveButton />
    </div>
  );
}
