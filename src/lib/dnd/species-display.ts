import type { CreatorCatalog } from "@/lib/content/catalog";
import type { PhbSpecies } from "@/lib/dnd/phb/types";
import { getSpecies } from "@/lib/dnd/phb/species";

type SpeciesCatalog = CreatorCatalog | { species: PhbSpecies[] };

function resolveSpecies(id: string, catalog?: SpeciesCatalog) {
  const list = catalog?.species ?? [];
  return list.find((entry) => entry.id === id) ?? getSpecies(id);
}

/** Stored species display string for characters and allies (e.g. "Elf (High)"). */
export function resolveSpeciesDisplayName(
  speciesId: string,
  subspeciesId: string | undefined,
  catalog?: SpeciesCatalog
): string {
  const species = resolveSpecies(speciesId, catalog);
  if (!species) return speciesId;
  if (subspeciesId) {
    const sub = species.subspecies?.find((entry) => entry.id === subspeciesId);
    if (sub) return `${species.name} (${sub.name})`;
  }
  return species.name;
}
