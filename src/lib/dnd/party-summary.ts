import { getSkillTotal, SKILL_LABELS } from "@/lib/dnd/calculations";
import type { SkillKey } from "@/lib/schemas/character";
import type { ParsedCharacter } from "@/lib/character/utils";

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

export function aggregatePartyInventory(characters: ParsedCharacter[]) {
  const currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  const items: { characterName: string; name: string; quantity: number }[] =
    [];

  for (const character of characters) {
    const c = character.data.inventory.currency;
    currency.cp += c.cp;
    currency.sp += c.sp;
    currency.ep += c.ep;
    currency.gp += c.gp;
    currency.pp += c.pp;

    for (const item of character.data.inventory.items) {
      if (!item.name.trim()) continue;
      items.push({
        characterName: character.name,
        name: item.name,
        quantity: item.quantity,
      });
    }
  }

  return { currency, items };
}

export function formatCurrency(currency: {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}) {
  const parts = [
    currency.pp ? `${currency.pp} pp` : "",
    currency.gp ? `${currency.gp} gp` : "",
    currency.ep ? `${currency.ep} ep` : "",
    currency.sp ? `${currency.sp} sp` : "",
    currency.cp ? `${currency.cp} cp` : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "None";
}
