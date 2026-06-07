"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CreateCampaignForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createCampaign() {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("DM Login required.");
      setLoading(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("campaigns")
      .insert({ name: name.trim(), created_by: user.id })
      .select("id")
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not create campaign.");
      setLoading(false);
      return;
    }

    router.push(`/campaigns/${data.id}`);
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="retro-box">
      <label className="candy-label" htmlFor="campaign-name">
        Campaign name
      </label>
      <input
        id="campaign-name"
        className="candy-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {error && <p className="candy-error">{error}</p>}
      <button
        type="button"
        className="candy-btn"
        onClick={createCampaign}
        disabled={loading || !name.trim()}
      >
        {loading ? "..." : "Create campaign"}
      </button>
    </div>
  );
}
