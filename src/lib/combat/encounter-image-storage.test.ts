import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isEncounterOwnedImagePath } from "@/lib/combat/encounter-image-storage";

describe("isEncounterOwnedImagePath", () => {
  it("matches paths under the encounter folder", () => {
    assert.equal(
      isEncounterOwnedImagePath(
        "encounters/abc123/background-1-map.png",
        "abc123"
      ),
      true
    );
  });

  it("rejects campaign board paths", () => {
    assert.equal(
      isEncounterOwnedImagePath(
        "backgrounds/campaign-1/123-map.png",
        "abc123"
      ),
      false
    );
  });

  it("rejects another encounter's folder", () => {
    assert.equal(
      isEncounterOwnedImagePath(
        "encounters/other/background-1-map.png",
        "abc123"
      ),
      false
    );
  });
});
