"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface CharacterClaimBannerProps {
  characterId: string;
  characterName: string;
  campaignId: string;
  isLoggedIn: boolean;
  canClaim: boolean;
  isOwner: boolean;
}

export function CharacterClaimBanner({
  characterId,
  characterName,
  campaignId,
  isLoggedIn,
  canClaim,
  isOwner,
}: CharacterClaimBannerProps) {
  const router = useRouter();
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function claim() {
    setClaiming(true);
    setMessage(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Sign in to claim this character.");
      setClaiming(false);
      return;
    }

    const { error } = await supabase
      .from("characters")
      .update({ owner_user_id: user.id })
      .eq("id", characterId)
      .is("owner_user_id", null);

    if (error) {
      setMessage(
        error.message.includes("row-level security") ||
          error.message.includes("duplicate key")
          ? "You can only claim one character per account."
          : error.message
      );
    } else {
      router.refresh();
    }

    setClaiming(false);
  }

  if (isOwner) {
    return (
      <p className="retro-note character-claim-banner">
        You are editing <strong>{characterName}</strong>.
      </p>
    );
  }

  if (canClaim) {
    return (
      <section className="retro-box character-claim-banner">
        <p>
          This character is unclaimed. Log in and claim it to edit your sheet.
        </p>
        <button
          type="button"
          className="candy-btn"
          onClick={claim}
          disabled={claiming}
        >
          {claiming ? "..." : `Claim ${characterName}`}
        </button>
        {message ? <p className="retro-muted">{message}</p> : null}
      </section>
    );
  }

  return null;
}
