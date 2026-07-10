import type { CharacterActionEntry } from "@/lib/dnd/character-actions";
import {
  appendExhaustionSheetNote,
  getExhaustionAttackSaveSheetNote,
} from "@/lib/dnd/exhaustion";
import {
  formatAttackRollLine,
  getAttackCategoryLabel,
  getOffensiveSpellMetadata,
  type DerivedAttack,
} from "@/lib/dnd/attacks";
import { getSpell } from "@/lib/dnd/phb/spells";
import {
  createDefaultCharacterData,
  type CharacterData,
} from "@/lib/schemas/character";
import type { EnemyNamedBlock } from "@/lib/schemas/enemy";
import { formatBattleAmmunitionLine, formatThrownWeaponLine } from "@/lib/dnd/ammunition";
import { buildSpellPickerHeader, stripRedundantSpellNotes } from "@/lib/dnd/spell-display";
import * as spellGlossary from "@/lib/dnd/spell-glossary";

export interface BattleTooltipParts {
  title?: string;
  header?: string;
  metadata: string[];
  description?: string;
  footer?: string[];
}

export function formatBattleTooltip(parts: BattleTooltipParts): string {
  const lines: string[] = [];

  const title = parts.title?.trim();
  if (title) lines.push(title);

  const header = parts.header?.trim();
  if (header) lines.push(header);

  for (const line of parts.metadata) {
    const trimmed = line.trim();
    if (trimmed) lines.push(trimmed);
  }

  const description = parts.description?.trim();
  if (description) {
    if (lines.length > 0) lines.push("");
    lines.push(description);
  }

  for (const line of parts.footer ?? []) {
    const trimmed = line.trim();
    if (trimmed) lines.push(trimmed);
  }

  if (lines.length === 0) return "";
  return lines.join("\n");
}

export function formatBattleAttackRollMetadataLine(attack: DerivedAttack): string | null {
  if (attack.rollType === "auto") return "Hit: Automatic";
  if (attack.rollType === "save" && attack.saveDc != null) {
    const ability = attack.saveAbility?.trim();
    return ability ? `Save: DC ${attack.saveDc} ${ability}` : `Save: DC ${attack.saveDc}`;
  }
  const rollLine = formatAttackRollLine(attack);
  if (!rollLine) return null;
  if (rollLine === "Auto hit") return "Hit: Automatic";
  if (rollLine.includes(" save")) {
    return `Save: ${rollLine.replace(/ save$/, "")}`;
  }
  const toHit = rollLine.replace(/ to hit$/, "");
  return `To hit: ${toHit}`;
}

function stripBonusActionNote(notes: string): string {
  return notes
    .split(" · ")
    .filter((part) => part !== "Bonus action")
    .join(" · ")
    .trim();
}

function stripVersatileFromNotes(notes: string): string {
  return notes
    .split(", ")
    .filter((part) => !/^Versatile \(two-handed\):/i.test(part.trim()))
    .join(", ")
    .trim();
}

function stripIgnoresCoverFromNotes(notes: string): string {
  return notes
    .split(" · ")
    .filter((part) => !/^ignores cover$/i.test(part.trim()))
    .join(" · ")
    .trim();
}

function attackIgnoresCover(attack: DerivedAttack): boolean {
  if (attack.spellCatalogSlug) {
    const metaNotes = getOffensiveSpellMetadata(attack.spellCatalogSlug)?.notes ?? "";
    if (/ignores cover/i.test(metaNotes)) return true;
  }
  return /\bignores cover\b/i.test(attack.notes);
}

function formatBattleAttackRangeLine(attack: DerivedAttack): string | null {
  const range = attack.range?.trim();
  if (!range) return null;
  if (attackIgnoresCover(attack)) {
    return `Range: ${range} · Ignores cover`;
  }
  return `Range: ${range}`;
}

function formatBattleAttackHeader(attack: DerivedAttack): string | undefined {
  if (attack.spellCatalogSlug) {
    const catalog = getSpell(attack.spellCatalogSlug);
    if (catalog) {
      return buildSpellPickerHeader(catalog);
    }
  }
  return getAttackCategoryLabel(attack);
}

function formatAttackNotesForTooltip(
  notes: string,
  options?: { omitBonusActionNote?: boolean }
): string {
  let displayNotes = stripVersatileFromNotes(notes);
  displayNotes = stripIgnoresCoverFromNotes(displayNotes);
  if (options?.omitBonusActionNote) {
    displayNotes = stripBonusActionNote(displayNotes);
  }
  return displayNotes;
}

/** Minimal character sheet used when building attack tooltips without attacker data. */
export const battleTooltipFallbackCharacter = createDefaultCharacterData();

function formatAmmoLine(name: string, count: number): string {
  const label = count === 1 ? name : `${name}s`;
  return `Ammo: ${count} ${label}`;
}

export function buildBattleAttackTooltipParts(
  attack: DerivedAttack,
  data: CharacterData,
  options?: { omitBonusActionNote?: boolean }
): BattleTooltipParts {
  const metadata: string[] = [];

  const rollAppliesExhaustion =
    attack.rollType === "attack" || attack.rollType == null;
  const rollLine = appendExhaustionSheetNote(
    formatBattleAttackRollMetadataLine(attack),
    rollAppliesExhaustion ? getExhaustionAttackSaveSheetNote(data) : null
  );
  if (rollLine) metadata.push(rollLine);

  if (attack.damageDice) {
    metadata.push(`Damage: ${`${attack.damageDice} ${attack.damageType}`.trim()}`);
  }

  if (attack.versatileDamageDice) {
    metadata.push(
      `Versatile: ${`${attack.versatileDamageDice} ${attack.damageType}`.trim()}`
    );
  }

  if (attack.range?.trim()) {
    const rangeLine = formatBattleAttackRangeLine(attack);
    if (rangeLine) metadata.push(rangeLine);
  }

  if (attack.ammunitionName != null && attack.ammunitionRemaining != null) {
    if (attack.ammunitionCapacity != null && attack.ammunitionCapacity > 0) {
      metadata.push(
        formatBattleAmmunitionLine(
          attack.ammunitionName,
          attack.ammunitionRemaining,
          attack.ammunitionCapacity
        )
      );
    } else {
      metadata.push(formatAmmoLine(attack.ammunitionName, attack.ammunitionRemaining));
    }
  }

  if (
    attack.throwsWeapon &&
    attack.thrownItemName != null &&
    attack.thrownRemaining != null
  ) {
    metadata.push(formatThrownWeaponLine(attack.thrownItemName, attack.thrownRemaining));
  }

  if (attack.spellCatalogSlug) {
    const catalog = getSpell(attack.spellCatalogSlug);
    const materialLine = catalog?.components
      ? spellGlossary.formatSpellMaterialLine(catalog.components)
      : null;
    if (materialLine) metadata.push(materialLine);
  }

  let description: string | undefined;
  const footer: string[] = [];

  if (attack.spellCatalogSlug) {
    const catalog = getSpell(attack.spellCatalogSlug);
    description = catalog?.description?.trim() || undefined;
  }

  const notes = attack.notes.trim();
  if (notes) {
    let displayNotes = formatAttackNotesForTooltip(notes, options);
    if (attack.spellCatalogSlug) {
      const catalog = getSpell(attack.spellCatalogSlug);
      if (catalog) {
        displayNotes = stripRedundantSpellNotes(displayNotes, catalog);
      }
    }
    if (displayNotes) {
      if (description) {
        footer.push(displayNotes);
      } else {
        description = displayNotes;
      }
    }
  }

  return {
    title:
      attack.spellCatalogSlug || attack.source === "cantrip" || attack.source === "spell"
        ? attack.name.trim() || undefined
        : undefined,
    header: formatBattleAttackHeader(attack),
    metadata,
    description,
    footer: footer.length > 0 ? footer : undefined,
  };
}

export function formatBattleAttackTooltip(
  attack: DerivedAttack,
  data: CharacterData,
  options?: { omitBonusActionNote?: boolean }
): string {
  return formatBattleTooltip(buildBattleAttackTooltipParts(attack, data, options));
}

export function formatBattleActionTooltip(
  action: CharacterActionEntry,
  options?: { additionalFooter?: string[] }
): string {
  const footer: string[] = [...(options?.additionalFooter ?? [])];
  if (action.uses) {
    const rest =
      action.restReset && action.restReset !== "none"
        ? ` (${action.restReset} rest)`
        : "";
    footer.push(`Uses: ${action.uses.current}/${action.uses.max}${rest}`);
  }

  return formatBattleTooltip({
    metadata: [],
    description: action.description.trim() || undefined,
    footer: footer.length > 0 ? footer : undefined,
  });
}

export function formatBattleEnemyActionTooltip(action: EnemyNamedBlock): string {
  return action.description.trim() || action.name.trim() || "No description.";
}

export function formatBattleHpPoolTooltip(
  action: CharacterActionEntry,
  poolRemaining: number
): string {
  return formatBattleTooltip({
    metadata: [`Pool: ${poolRemaining} HP remaining`],
    description: action.description.trim() || undefined,
  });
}

export interface BattleMoveTooltipContext {
  remainingFeet: number;
  speedFeet: number;
  dashAvailableFeet: number | null;
  dashUsed: boolean;
}

const CORE_MOVE_DESCRIPTION =
  "Move up to your speed. You can split movement before and after an action.";

export function formatBattleMoveTooltip(context: BattleMoveTooltipContext): string {
  const footer: string[] = [];
  if (!context.dashUsed && context.dashAvailableFeet != null) {
    footer.push(
      `Dash: +${Math.max(0, context.dashAvailableFeet - context.remainingFeet)} ft available`
    );
  }
  if (context.dashUsed) {
    footer.push("Dash: used this turn");
  }

  return formatBattleTooltip({
    metadata: [],
    description: CORE_MOVE_DESCRIPTION,
    footer: footer.length > 0 ? footer : undefined,
  });
}

export function formatBattleOtherActionsTooltip(
  entries: CharacterActionEntry[]
): string {
  const blocks = entries.map((entry) => {
    const description = entry.description.trim();
    if (!description) return entry.name;
    return formatBattleTooltip({
      header: entry.name,
      metadata: [],
      description,
    });
  });
  return blocks.join("\n\n");
}
