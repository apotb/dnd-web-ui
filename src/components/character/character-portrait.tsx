"use client";

import { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getCharacterPortraitUrl,
  removeCharacterPortrait,
  uploadCharacterPortrait,
} from "@/lib/character/portrait-storage";
import { Button } from "@/components/ui/button";

interface CharacterPortraitProps {
  portraitPath: string;
  characterName: string;
  campaignId: string;
  characterId: string;
  canEdit: boolean;
  onPortraitChange: (path: string) => void;
  onPersist: (path: string) => Promise<{ error: string | null }>;
}

export function CharacterPortrait({
  portraitPath,
  characterName,
  campaignId,
  characterId,
  canEdit,
  onPortraitChange,
  onPersist,
}: CharacterPortraitProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    setImageUrl(getCharacterPortraitUrl(supabase, portraitPath));
  }, [portraitPath]);

  async function handleFile(file: File) {
    setBusy(true);
    setMessage(null);

    const supabase = createClient();
    const previousPath = portraitPath || null;
    const { path, error } = await uploadCharacterPortrait(
      supabase,
      campaignId,
      characterId,
      file
    );

    if (error || !path) {
      setMessage(error ?? "Upload failed");
      setBusy(false);
      return;
    }

    const { error: persistError } = await onPersist(path);
    if (persistError) {
      await removeCharacterPortrait(supabase, path);
      setMessage(persistError);
      setBusy(false);
      return;
    }

    onPortraitChange(path);

    if (previousPath && previousPath !== path) {
      await removeCharacterPortrait(supabase, previousPath);
    }

    setBusy(false);
  }

  async function handleRemove() {
    if (!portraitPath || !confirm("Remove this portrait?")) return;

    setBusy(true);
    setMessage(null);

    const supabase = createClient();
    const previousPath = portraitPath;

    const { error: persistError } = await onPersist("");
    if (persistError) {
      setMessage(persistError);
      setBusy(false);
      return;
    }

    onPortraitChange("");
    await removeCharacterPortrait(supabase, previousPath);
    setBusy(false);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  return (
    <div className="character-portrait">
      <div
        className="character-portrait-frame"
        aria-label={
          imageUrl
            ? `Portrait of ${characterName}`
            : `No portrait for ${characterName}`
        }
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`Portrait of ${characterName}`}
            className="character-portrait-image"
          />
        ) : (
          <div className="character-portrait-placeholder" aria-hidden>
            <User className="character-portrait-silhouette" strokeWidth={1.25} />
          </div>
        )}
      </div>

      {canEdit ? (
        <div className="character-portrait-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleFile(file);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={openFilePicker}
          >
            {busy ? "…" : imageUrl ? "Replace" : "Upload"}
          </Button>
          {imageUrl ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void handleRemove()}
            >
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p className="character-portrait-message text-destructive">{message}</p>
      ) : null}
    </div>
  );
}
