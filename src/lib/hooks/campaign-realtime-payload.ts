import type { Campaign } from "@/lib/types/database";

/**
 * Read a column from a Supabase realtime UPDATE payload.
 * Unchanged large JSONB columns may be omitted (Postgres TOAST); callers
 * should skip updating state when this returns undefined.
 */
export function getCampaignRealtimeColumn<K extends keyof Campaign>(
  row: Partial<Campaign>,
  key: K
): Campaign[K] | undefined {
  if (!Object.hasOwn(row, key)) return undefined;
  return row[key];
}
