import { FAVORED_ENEMIES } from "./classes";

/** Ranger favored enemy option that requires picking two humanoid species. */
export const TWO_HUMANOID_SPECIES_OPTION = "Two humanoid species";

const LEGACY_TWO_HUMANOID_RACES_OPTION = "Two humanoid races";

export interface HumanoidSpeciesOption {
  id: string;
  name: string;
}

/** Common humanoid species for Ranger favored enemy (PHB / MM). */
export const FAVORED_HUMANOID_SPECIES: HumanoidSpeciesOption[] = [
  { id: "aarakocra", name: "Aarakocra" },
  { id: "bugbear", name: "Bugbears" },
  { id: "bullywug", name: "Bullywugs" },
  { id: "derro", name: "Derro" },
  { id: "drow", name: "Drow" },
  { id: "duergar", name: "Duergar" },
  { id: "elf", name: "Elves" },
  { id: "githyanki", name: "Githyanki" },
  { id: "githzerai", name: "Githzerai" },
  { id: "gnoll", name: "Gnolls" },
  { id: "gnome", name: "Gnomes" },
  { id: "goblin", name: "Goblins" },
  { id: "grimlock", name: "Grimlocks" },
  { id: "half-orc", name: "Half-orcs" },
  { id: "halfling", name: "Halflings" },
  { id: "hobgoblin", name: "Hobgoblins" },
  { id: "human", name: "Humans" },
  { id: "kenku", name: "Kenku" },
  { id: "kobold", name: "Kobolds" },
  { id: "kuo-toa", name: "Kuo-toa" },
  { id: "lizardfolk", name: "Lizardfolk" },
  { id: "merfolk", name: "Merfolk" },
  { id: "orc", name: "Orcs" },
  { id: "quaggoth", name: "Quaggoths" },
  { id: "sahuagin", name: "Sahuagin" },
  { id: "tabaxi", name: "Tabaxi" },
  { id: "tortle", name: "Tortles" },
  { id: "troglodyte", name: "Troglodytes" },
  { id: "yuan-ti", name: "Yuan-ti" },
];

const BY_ID = new Map(FAVORED_HUMANOID_SPECIES.map((r) => [r.id, r]));
const BY_NAME = new Map(
  FAVORED_HUMANOID_SPECIES.map((r) => [r.name.toLowerCase(), r])
);

export function getHumanoidSpeciesName(id: string): string {
  return BY_ID.get(id)?.name ?? id;
}

export function resolveHumanoidSpeciesId(value: string): string | null {
  const key = value.trim().toLowerCase();
  if (BY_ID.has(key)) return key;
  const byName = BY_NAME.get(key);
  if (byName) return byName.id;
  return null;
}

export function searchHumanoidSpecies(
  query: string,
  limit = 40
): HumanoidSpeciesOption[] {
  const q = query.trim().toLowerCase();
  const pool = q
    ? FAVORED_HUMANOID_SPECIES.filter((r) => r.name.toLowerCase().includes(q))
    : FAVORED_HUMANOID_SPECIES;
  return pool.slice(0, limit);
}

export function formatFavoredEnemyDisplay(
  enemy: string,
  humanoidSpeciesIds: string[] = []
): string {
  if (!enemy) return "";
  if (enemy !== TWO_HUMANOID_SPECIES_OPTION) return enemy;
  if (humanoidSpeciesIds.length === 0) return TWO_HUMANOID_SPECIES_OPTION;
  const names = humanoidSpeciesIds.map(getHumanoidSpeciesName);
  return `${TWO_HUMANOID_SPECIES_OPTION}: ${names.join(", ")}`;
}

/** Parse legacy favored enemy text into type + humanoid ids. */
export function parseFavoredEnemyLegacy(description: string): {
  enemy: string;
  humanoidSpeciesIds: string[];
} {
  const trimmed = description.trim();
  if (!trimmed) return { enemy: "", humanoidSpeciesIds: [] };

  const legacyPrefix = `${LEGACY_TWO_HUMANOID_RACES_OPTION}:`;
  if (trimmed.startsWith(legacyPrefix)) {
    const rest = trimmed.slice(legacyPrefix.length).trim();
    const ids = rest
      .split(/,\s*/)
      .map((part) => resolveHumanoidSpeciesId(part))
      .filter((id): id is string => !!id);
    return { enemy: TWO_HUMANOID_SPECIES_OPTION, humanoidSpeciesIds: ids };
  }

  if (trimmed === LEGACY_TWO_HUMANOID_RACES_OPTION) {
    return { enemy: TWO_HUMANOID_SPECIES_OPTION, humanoidSpeciesIds: [] };
  }

  const prefix = `${TWO_HUMANOID_SPECIES_OPTION}:`;
  if (trimmed.startsWith(prefix)) {
    const rest = trimmed.slice(prefix.length).trim();
    const ids = rest
      .split(/,\s*/)
      .map((part) => resolveHumanoidSpeciesId(part))
      .filter((id): id is string => !!id);
    return { enemy: TWO_HUMANOID_SPECIES_OPTION, humanoidSpeciesIds: ids };
  }

  if (trimmed === TWO_HUMANOID_SPECIES_OPTION) {
    return { enemy: TWO_HUMANOID_SPECIES_OPTION, humanoidSpeciesIds: [] };
  }

  if (FAVORED_ENEMIES.includes(trimmed as (typeof FAVORED_ENEMIES)[number])) {
    return { enemy: trimmed, humanoidSpeciesIds: [] };
  }

  const parts = trimmed.split(/,\s*/);
  if (parts.length >= 2) {
    const ids = parts
      .map((part) => resolveHumanoidSpeciesId(part))
      .filter((id): id is string => !!id);
    if (ids.length >= 2) {
      return { enemy: TWO_HUMANOID_SPECIES_OPTION, humanoidSpeciesIds: ids.slice(0, 2) };
    }
  }

  const asId = resolveHumanoidSpeciesId(trimmed);
  if (asId) {
    return { enemy: TWO_HUMANOID_SPECIES_OPTION, humanoidSpeciesIds: [asId] };
  }

  return { enemy: trimmed, humanoidSpeciesIds: [] };
}
