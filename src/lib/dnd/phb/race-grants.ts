import { ABILITY_LABELS, SKILL_LABELS } from "@/lib/dnd/calculations";
import type { AbilityKey, SkillKey } from "@/lib/schemas/character";
import { getFeat } from "./feats";
import type { PhbRace } from "./types";

export interface RaceGrantContext {
  subraceId?: string;
  halfElfAbilityBonuses?: AbilityKey[];
  halfElfSkills?: SkillKey[];
  variantHumanAbilityBonuses?: AbilityKey[];
  variantHumanSkill?: SkillKey | "";
  variantHumanFeat?: string;
  raceLanguageChoices?: string[];
}

export interface RaceGrantLine {
  label: string;
  value: string;
}

export function getRaceGrantLines(
  race: PhbRace,
  ctx: RaceGrantContext
): RaceGrantLine[] {
  const lines: RaceGrantLine[] = [];
  const subrace = race.subraces?.find((s) => s.id === ctx.subraceId);

  lines.push({
    label: "Ability scores",
    value: describeAbilityBonuses(race, ctx, subrace),
  });

  lines.push({
    label: "Size / speed",
    value: `${race.size}, ${describeSpeed(race, ctx.subraceId)} ft`,
  });

  const skills = describeSkills(race, ctx);
  if (skills) lines.push({ label: "Skills", value: skills });

  const languages = describeLanguages(race, ctx);
  if (languages) lines.push({ label: "Languages", value: languages });

  const weapons = race.weaponProficiencies?.length
    ? race.weaponProficiencies.join(", ")
    : "";
  if (weapons) lines.push({ label: "Weapon proficiencies", value: weapons });

  const armor = race.armorProficiencies?.length
    ? race.armorProficiencies.join(", ")
    : "";
  if (armor) lines.push({ label: "Armor proficiencies", value: armor });

  const tools = race.toolProficiencies?.length
    ? race.toolProficiencies.join(", ")
    : "";
  if (tools) lines.push({ label: "Tool proficiencies", value: tools });

  if (subrace?.extras?.length) {
    lines.push({
      label: subrace.name,
      value: subrace.extras.join(" · "),
    });
  }

  if (race.traits.length) {
    lines.push({
      label: "Traits",
      value: race.traits.map((t) => t.name).join(", "),
    });
  }

  if (race.id === "human" && ctx.subraceId === "variant" && ctx.variantHumanFeat) {
    const feat = getFeat(ctx.variantHumanFeat);
    if (feat) lines.push({ label: "Feat", value: feat.name });
  }

  return lines;
}

function describeSpeed(race: PhbRace, subraceId?: string): number {
  if (race.id === "elf" && subraceId === "wood") return 35;
  return race.speed;
}

function describeAbilityBonuses(
  race: PhbRace,
  ctx: RaceGrantContext,
  subrace?: NonNullable<PhbRace["subraces"]>[number]
): string {
  if (race.id === "human" && !ctx.subraceId) {
    return "Choose standard (+1 all) or variant (+1×2, skill, feat)";
  }

  if (race.id === "human" && ctx.subraceId === "variant") {
    if (ctx.variantHumanAbilityBonuses?.length === 2) {
      return ctx.variantHumanAbilityBonuses
        .map((key) => `${ABILITY_LABELS[key]} +1`)
        .join(", ");
    }
    return "+1 to two abilities of your choice";
  }

  if (race.abilityBonus.kind === "half-elf") {
    const parts = ["CHA +2"];
    if (ctx.halfElfAbilityBonuses?.length === 2) {
      parts.push(
        ...ctx.halfElfAbilityBonuses.map((key) => `${ABILITY_LABELS[key]} +1`)
      );
    } else {
      parts.push("+1 to two other abilities of your choice");
    }
    return parts.join(", ");
  }

  if (race.abilityBonus.kind === "fixed") {
    const merged: Partial<Record<AbilityKey, number>> = {
      ...race.abilityBonus.bonuses,
    };
    if (subrace?.abilityBonus) {
      for (const [key, value] of Object.entries(subrace.abilityBonus)) {
        const k = key as AbilityKey;
        merged[k] = (merged[k] ?? 0) + value;
      }
    }
    return Object.entries(merged)
      .map(([key, value]) => `${ABILITY_LABELS[key as AbilityKey]} +${value}`)
      .join(", ");
  }

  return "—";
}

function describeSkills(race: PhbRace, ctx: RaceGrantContext): string | null {
  const parts: string[] = [];

  race.skillProficiencies?.forEach((skill) => {
    parts.push(SKILL_LABELS[skill]);
  });

  if (race.id === "half-elf") {
    if (ctx.halfElfSkills?.length) {
      parts.push(...ctx.halfElfSkills.map((s) => SKILL_LABELS[s]));
    } else {
      parts.push("two skills of your choice");
    }
  }

  if (race.id === "human" && ctx.subraceId === "variant") {
    if (ctx.variantHumanSkill) {
      parts.push(SKILL_LABELS[ctx.variantHumanSkill]);
    } else {
      parts.push("one skill of your choice");
    }
  }

  return parts.length ? parts.join(", ") : null;
}

function describeLanguages(race: PhbRace, ctx: RaceGrantContext): string | null {
  const parts = [...race.languages, ...(race.fixedLanguages ?? [])];

  const choiceCount =
    (race.languageChoices ?? 0) +
    (race.id === "elf" && ctx.subraceId === "high" ? 1 : 0);

  if (ctx.raceLanguageChoices?.length) {
    parts.push(...ctx.raceLanguageChoices);
  } else if (choiceCount > 0) {
    parts.push(
      choiceCount === 1
        ? "one language of your choice"
        : `${choiceCount} languages of your choice`
    );
  }

  return parts.length ? parts.join(", ") : null;
}
