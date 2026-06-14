import { ABILITY_LABELS, SKILL_LABELS } from "@/lib/dnd/calculations";
import type { AbilityKey, SkillKey } from "@/lib/schemas/character";
import { getFeat } from "./feats";
import type { PhbSpecies } from "./types";

export interface SpeciesGrantContext {
  subspeciesId?: string;
  halfElfAbilityBonuses?: AbilityKey[];
  speciesSkillChoices?: SkillKey[];
  speciesWeaponChoices?: string[];
  speciesToolChoice?: string;
  speciesSkillOrTool?: "skill" | "tool" | "";
  variantHumanAbilityBonuses?: AbilityKey[];
  variantHumanSkill?: SkillKey | "";
  variantHumanFeat?: string;
  speciesLanguageChoices?: string[];
}

export interface SpeciesGrantLine {
  label: string;
  value: string;
}

export function getSpeciesGrantLines(
  species: PhbSpecies,
  ctx: SpeciesGrantContext
): SpeciesGrantLine[] {
  const lines: SpeciesGrantLine[] = [];
  const subspecies = species.subspecies?.find((s) => s.id === ctx.subspeciesId);

  lines.push({
    label: "Ability scores",
    value: describeAbilityBonuses(species, ctx, subspecies),
  });

  lines.push({
    label: "Size / speed",
    value: `${species.size}, ${describeSpeed(species, ctx.subspeciesId)} ft`,
  });

  const skills = describeSkills(species, ctx);
  if (skills) lines.push({ label: "Skills", value: skills });

  const languages = describeLanguages(species, ctx);
  if (languages) lines.push({ label: "Languages", value: languages });

  const weapons = [
    ...(species.weaponProficiencies ?? []),
    ...(subspecies?.weaponProficiencies ?? []),
    ...(ctx.speciesWeaponChoices ?? []),
  ];
  if (weapons.length) {
    lines.push({ label: "Weapon proficiencies", value: weapons.join(", ") });
  }

  const armor = [
    ...(species.armorProficiencies ?? []),
    ...(subspecies?.armorProficiencies ?? []),
  ];
  if (armor.length) {
    lines.push({ label: "Armor proficiencies", value: armor.join(", ") });
  }

  const tools = [
    ...(species.toolProficiencies ?? []),
    ...(ctx.speciesToolChoice ? [ctx.speciesToolChoice] : []),
  ];
  if (tools.length) {
    lines.push({ label: "Tool proficiencies", value: tools.join(", ") });
  }

  if (subspecies?.extras?.length) {
    lines.push({
      label: subspecies.name,
      value: subspecies.extras.join(" · "),
    });
  }

  if (species.traits.length) {
    lines.push({
      label: "Traits",
      value: species.traits.map((t) => t.name).join(", "),
    });
  }

  if (species.id === "human" && ctx.subspeciesId === "variant" && ctx.variantHumanFeat) {
    const feat = getFeat(ctx.variantHumanFeat);
    if (feat) lines.push({ label: "Feat", value: feat.name });
  }

  return lines;
}

function describeSpeed(species: PhbSpecies, subspeciesId?: string): number {
  if (species.id === "elf" && subspeciesId === "wood") return 35;
  return species.speed;
}

function describeAbilityBonuses(
  species: PhbSpecies,
  ctx: SpeciesGrantContext,
  subspecies?: NonNullable<PhbSpecies["subspecies"]>[number]
): string {
  if (species.id === "human" && !ctx.subspeciesId) {
    return "Choose standard (+1 all) or variant (+1×2, skill, feat)";
  }

  if (species.id === "human" && ctx.subspeciesId === "variant") {
    if (ctx.variantHumanAbilityBonuses?.length === 2) {
      return ctx.variantHumanAbilityBonuses
        .map((key) => `${ABILITY_LABELS[key]} +1`)
        .join(", ");
    }
    return "+1 to two abilities of your choice";
  }

  if (species.abilityBonus.kind === "half-elf") {
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

  if (species.abilityBonus.kind === "fixed") {
    const merged: Partial<Record<AbilityKey, number>> = {
      ...species.abilityBonus.bonuses,
    };
    if (subspecies?.abilityBonus) {
      for (const [key, value] of Object.entries(subspecies.abilityBonus)) {
        const k = key as AbilityKey;
        merged[k] = (merged[k] ?? 0) + value;
      }
    }
    return Object.entries(merged)
      .filter(([, value]) => value !== 0)
      .map(([key, value]) => {
        const label = ABILITY_LABELS[key as AbilityKey];
        return value > 0 ? `${label} +${value}` : `${label} ${value}`;
      })
      .join(", ");
  }

  return "—";
}

function describeSkills(species: PhbSpecies, ctx: SpeciesGrantContext): string | null {
  const parts: string[] = [];

  species.skillProficiencies?.forEach((skill) => {
    parts.push(SKILL_LABELS[skill]);
  });

  if (species.skillOrToolChoice) {
    if (ctx.speciesSkillOrTool === "skill" && ctx.speciesSkillChoices?.length) {
      parts.push(...ctx.speciesSkillChoices.map((s) => SKILL_LABELS[s]));
    } else if (ctx.speciesSkillOrTool === "tool" && ctx.speciesToolChoice) {
      parts.push(`tool: ${ctx.speciesToolChoice}`);
    } else {
      parts.push("one skill or tool of your choice");
    }
  } else if (species.skillChoices) {
    if (ctx.speciesSkillChoices?.length) {
      parts.push(...ctx.speciesSkillChoices.map((s) => SKILL_LABELS[s]));
    } else {
      parts.push(
        species.skillChoices.count === 1
          ? "one skill of your choice"
          : `${species.skillChoices.count} skills of your choice`
      );
    }
  }

  if (species.id === "human" && ctx.subspeciesId === "variant") {
    if (ctx.variantHumanSkill) {
      parts.push(SKILL_LABELS[ctx.variantHumanSkill]);
    } else {
      parts.push("one skill of your choice");
    }
  }

  return parts.length ? parts.join(", ") : null;
}

function describeLanguages(species: PhbSpecies, ctx: SpeciesGrantContext): string | null {
  const parts = [...species.languages, ...(species.fixedLanguages ?? [])];

  const choiceCount =
    (species.languageChoices ?? 0) +
    (species.id === "elf" && ctx.subspeciesId === "high" ? 1 : 0);

  if (ctx.speciesLanguageChoices?.length) {
    parts.push(...ctx.speciesLanguageChoices);
  } else if (choiceCount > 0) {
    parts.push(
      choiceCount === 1
        ? "one language of your choice"
        : `${choiceCount} languages of your choice`
    );
  }

  return parts.length ? parts.join(", ") : null;
}
