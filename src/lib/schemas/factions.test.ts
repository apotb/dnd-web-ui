import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterFactionMembersForViewer,
  normalizeFactionsData,
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

  it("flattens legacy categorized factions into one ordered list", () => {
    const data = normalizeFactionsData({
      categories: [
        { id: "guilds", label: "Guilds", sortOrder: 0 },
        { id: "cults", label: "Cults", sortOrder: 1 },
      ],
      factions: [
        {
          id: "cult-a",
          name: "Cult A",
          type: "",
          goals: "",
          category: "cults",
          visibleToPlayers: true,
          sortOrder: 0,
          events: [],
          memberNotableIds: [],
        },
        {
          id: "guild-b",
          name: "Guild B",
          type: "",
          goals: "",
          category: "guilds",
          visibleToPlayers: true,
          sortOrder: 1,
          events: [],
          memberNotableIds: [],
        },
      ],
    });
    assert.deepEqual(data.categories, []);
    assert.deepEqual(
      data.factions.map((faction) => faction.id),
      ["guild-b", "cult-a"]
    );
    assert.equal(data.factions[0].category, "");
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
