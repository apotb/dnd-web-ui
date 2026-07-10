import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterFactionMembersForViewer,
  parseFactionsData,
} from "./factions";
import type { Notable } from "./notables";

const notables: Notable[] = [
  {
    id: "visible-npc",
    name: "Visible NPC",
    species: "Human",
    role: "Guide",
    portraitPath: "",
    portraitUrl: "",
    category: "minor-characters",
    visibleToPlayers: true,
    sortOrder: 0,
    events: [],
  },
  {
    id: "hidden-npc",
    name: "Hidden NPC",
    species: "Elf",
    role: "Spy",
    portraitPath: "",
    portraitUrl: "",
    category: "minor-characters",
    visibleToPlayers: false,
    sortOrder: 1,
    events: [],
  },
];

describe("factions", () => {
  it("parses empty factions data with no categories", () => {
    const data = parseFactionsData({});
    assert.deepEqual(data.categories, []);
    assert.deepEqual(data.factions, []);
  });

  it("filters hidden notable members for players", () => {
    const members = filterFactionMembersForViewer(
      ["visible-npc", "hidden-npc", "missing-npc"],
      notables,
      false
    );
    assert.equal(members.length, 1);
    assert.equal(members[0].id, "visible-npc");
  });

  it("shows all notable members for DM", () => {
    const members = filterFactionMembersForViewer(
      ["visible-npc", "hidden-npc"],
      notables,
      true
    );
    assert.equal(members.length, 2);
  });
});
