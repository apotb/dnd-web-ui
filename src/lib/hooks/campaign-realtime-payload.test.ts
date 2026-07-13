import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCampaignRealtimeColumn } from "./campaign-realtime-payload";
import type { Campaign } from "@/lib/types/database";

describe("getCampaignRealtimeColumn", () => {
  it("returns the column when present in the payload", () => {
    const row: Partial<Campaign> = {
      notables_data: { notables: [], categories: [] },
    };
    assert.deepEqual(getCampaignRealtimeColumn(row, "notables_data"), {
      notables: [],
      categories: [],
    });
  });

  it("returns undefined when the column was omitted from the payload", () => {
    const row: Partial<Campaign> = {
      factions_data: { factions: [], categories: [] },
    };
    assert.equal(getCampaignRealtimeColumn(row, "notables_data"), undefined);
  });

  it("returns null when the column is explicitly null", () => {
    const row: Partial<Campaign> = { notables_data: null };
    assert.equal(getCampaignRealtimeColumn(row, "notables_data"), null);
  });
});
