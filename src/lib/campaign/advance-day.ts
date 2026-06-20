import { addDays } from "@/lib/dnd/harptos-calendar";
import type { WorldData } from "@/lib/schemas/world";
import { getCampaignCalendarDate } from "@/lib/schemas/world";

export function buildNextWorldData(worldData: WorldData): WorldData {
  const today = getCampaignCalendarDate(worldData);
  return {
    ...worldData,
    calendar: addDays(today, 1),
    dailySuppliesActive: true,
  };
}
