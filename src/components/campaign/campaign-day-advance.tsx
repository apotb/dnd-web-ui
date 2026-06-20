"use client";

import { useState } from "react";
import { buildNextWorldData } from "@/lib/campaign/advance-day";
import { formatHarptosDate } from "@/lib/dnd/harptos-calendar";
import { useRealtimeWorldData } from "@/lib/hooks/use-realtime-world-data";
import { getCampaignCalendarDate, type WorldData } from "@/lib/schemas/world";
import { createClient } from "@/lib/supabase/client";

interface CampaignDayAdvanceProps {
  campaignId: string;
  initialWorldData: WorldData;
}

export function CampaignDayAdvance({
  campaignId,
  initialWorldData,
}: CampaignDayAdvanceProps) {
  const worldData = useRealtimeWorldData(campaignId, initialWorldData);
  const today = getCampaignCalendarDate(worldData);
  const [advancing, setAdvancing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function advanceDay() {
    setAdvancing(true);
    setMessage(null);

    const nextWorldData = buildNextWorldData(worldData);
    const supabase = createClient();
    const { error } = await supabase
      .from("campaigns")
      .update({ world_data: nextWorldData })
      .eq("id", campaignId);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(
        `Now ${formatHarptosDate(nextWorldData.calendar)} — characters need food and water.`
      );
    }

    setAdvancing(false);
  }

  return (
    <section className="retro-box campaign-day-advance">
      <p className="retro-box-title">Today</p>
      <p className="campaign-day-advance-date">{formatHarptosDate(today)}</p>
      <button
        type="button"
        className="candy-btn campaign-day-advance-btn"
        onClick={advanceDay}
        disabled={advancing}
      >
        {advancing ? "..." : "Next Day"}
      </button>
      {message ? <p className="retro-muted">{message}</p> : null}
    </section>
  );
}
