import { formatModifier, getSkillTotal, SKILL_LABELS } from "@/lib/dnd/calculations";
import type { SkillKey } from "@/lib/schemas/character";
import type { PartyAnimal, PartyData } from "@/lib/schemas/party";
import type { ParsedCharacter } from "@/lib/character/utils";

export function skillShortLabel(label: string): string {
  return label.replace(/\s/g, "").slice(0, 5);
}

export function getTopSkills(
  character: ParsedCharacter,
  count = 3
): { skill: SkillKey; label: string; total: number }[] {
  const skills = Object.keys(SKILL_LABELS) as SkillKey[];

  return skills
    .map((skill) => ({
      skill,
      label: SKILL_LABELS[skill],
      total: getSkillTotal(character.data, skill),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, count);
}

export function getCaretakerName(
  characters: ParsedCharacter[],
  caretakerCharacterId: string
): string {
  if (!caretakerCharacterId) return "—";
  return (
    characters.find((c) => c.id === caretakerCharacterId)?.name ?? "Unknown"
  );
}

export function getAnimalHandlingBonus(
  characters: ParsedCharacter[],
  caretakerCharacterId: string
): number | null {
  const caretaker = characters.find((c) => c.id === caretakerCharacterId);
  if (!caretaker) return null;
  return getSkillTotal(caretaker.data, "animalHandling");
}

export function listAnimalSupplies(partyData: PartyData, animalId: string) {
  return partyData.items
    .filter((item) => item.animalId === animalId && item.name.trim())
    .map((item) => ({
      item,
      totalWeightLb: item.weightLb * item.quantity,
    }));
}

export function listPartyAnimals(
  partyData: PartyData,
  characters: ParsedCharacter[]
) {
  return partyData.animals
    .filter((animal) => animal.name.trim())
    .map((animal) => ({
      animal,
      caretakerName: getCaretakerName(characters, animal.caretakerCharacterId),
      animalHandling: getAnimalHandlingBonus(
        characters,
        animal.caretakerCharacterId
      ),
    }));
}

export function newPartyAnimal(
  caretakerCharacterId = ""
): PartyAnimal {
  return {
    id: crypto.randomUUID(),
    name: "",
    type: "",
    caretakerCharacterId,
    carryCapacityLb: 0,
    notes: "",
  };
}

export function getPartySuppliesWeight(partyData: PartyData): number {
  return partyData.items.reduce(
    (sum, item) =>
      item.animalId ? sum + item.weightLb * item.quantity : sum,
    0
  );
}

/** Base capacity is 0; animals add carry capacity. */
export function getPartyCarryCapacity(partyData: PartyData): number {
  return partyData.animals.reduce(
    (sum, animal) => sum + animal.carryCapacityLb,
    0
  );
}

export function formatPartyWeight(
  currentLb: number,
  capacityLb: number
): string {
  return `${formatWeightLb(currentLb)} / ${formatWeightLb(capacityLb)}`;
}

function formatWeightLb(lb: number): string {
  return `${Number.isInteger(lb) ? lb : lb.toFixed(1)} lb`;
}

export function getAnimalSuppliesWeight(
  partyData: PartyData,
  animalId: string
): number {
  return partyData.items
    .filter((item) => item.animalId === animalId)
    .reduce((sum, item) => sum + item.weightLb * item.quantity, 0);
}

export function formatAnimalHeading(
  animal: PartyAnimal,
  partyData: PartyData,
  characters: ParsedCharacter[]
): string {
  const name = animal.name.trim() || "Unnamed";
  const weight = formatPartyWeight(
    getAnimalSuppliesWeight(partyData, animal.id),
    animal.carryCapacityLb
  );
  const type = animal.type.trim() || "—";
  const caretaker = getCaretakerName(characters, animal.caretakerCharacterId);
  const handling = getAnimalHandlingBonus(
    characters,
    animal.caretakerCharacterId
  );
  const handle =
    handling === null ? "—" : formatModifier(handling);

  return `${name} · ${weight} · ${type} · ${caretaker} · Handle ${handle}`;
}
