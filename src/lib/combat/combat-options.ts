import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import type { ParsedCharacter } from "@/lib/character/utils";
import {
  ACTION_COST_LABELS,
  actionSourceBadgeLabel,
  getAllCharacterActions,
  getStandardCombatActions,
  type CharacterActionEntry,
} from "@/lib/dnd/character-actions";
import {
  deriveUnarmedStrike,
  formatAttackRollLine,
  getAllAttacks,
  type DerivedAttack,
} from "@/lib/dnd/attacks";
import {
  appendExhaustionSheetNote,
  getExhaustionAttackSaveSheetNote,
} from "@/lib/dnd/exhaustion";
import { formatAmmunitionLine, formatThrownWeaponLine } from "@/lib/dnd/ammunition";
import type { PhbClass } from "@/lib/dnd/phb/types";
import type { CharacterData } from "@/lib/schemas/character";
import type { EnemyData, EnemyNamedBlock } from "@/lib/schemas/enemy";
import { getWeaponProperties, type Item } from "@/lib/schemas/item";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import { canUseHelpAction, isTokenEngaged } from "@/lib/combat/engagement";
import { parseAttackRangeSpec } from "@/lib/combat/targeting";

export type CombatOptionKind =
  | "attack"
  | "action"
  | "bonus-action"
  | "enemy-action"
  | "movement";

export const COMBAT_MOVE_OPTION_ID = "combat:move";

export interface CombatOption {
  id: string;
  name: string;
  subtitle: string;
  tooltip: string;
  kind: CombatOptionKind;
  attack?: DerivedAttack;
  action?: CharacterActionEntry;
  enemyAction?: EnemyNamedBlock;
}

function actionSubtitle(action: CharacterActionEntry): string {
  return ACTION_COST_LABELS[action.cost];
}

function attackTypeLabel(source: DerivedAttack["source"]): string {
  if (source === "weapon" || source === "manual") return "Attack";
  if (source === "cantrip") return "Cantrip";
  return "Spell";
}

function attackOptionSubtitle(attack: DerivedAttack, kind: CombatOptionKind): string {
  const typeLabel = attackTypeLabel(attack.source);
  const rollLine = formatAttackRollLine(attack);
  const detail = `${typeLabel} · ${rollLine}`;

  if (kind === "bonus-action" || attack.isOffHand) {
    return `${ACTION_COST_LABELS["bonus-action"]} · ${detail}`;
  }

  return detail;
}

function inferEnemyActionTypeLabel(description: string): string {
  const text = description.trim();
  if (/\b(?:Melee|Ranged) Weapon Attack:/i.test(text)) return "Attack";
  if (/\b(?:Melee|Ranged) Spell Attack:/i.test(text) || /\bSpell Attack:/i.test(text)) {
    return "Spell";
  }
  return "Action";
}

function enemyActionSubtitle(description: string): string {
  return inferEnemyActionTypeLabel(description);
}

function attackSourceLabel(source: DerivedAttack["source"]): string {
  if (source === "weapon") return "Weapon";
  if (source === "cantrip") return "Cantrip";
  if (source === "spell") return "Spell";
  return "Special";
}

function formatAttackTooltip(attack: DerivedAttack, data: CharacterData): string {
  const lines: string[] = [attackSourceLabel(attack.source)];

  const rollAppliesExhaustion =
    attack.rollType === "attack" || attack.rollType == null;
  const rollLine = appendExhaustionSheetNote(
    formatAttackRollLine(attack),
    rollAppliesExhaustion ? getExhaustionAttackSaveSheetNote(data) : null
  );
  if (rollLine) lines.push(rollLine);

  const detailParts: string[] = [];
  if (attack.damageDice) {
    detailParts.push(`${attack.damageDice} ${attack.damageType}`.trim());
  }
  if (attack.range) detailParts.push(attack.range);
  if (detailParts.length > 0) lines.push(detailParts.join(" · "));

  if (
    attack.ammunitionName != null &&
    attack.ammunitionRemaining != null
  ) {
    lines.push(formatAmmunitionLine(attack.ammunitionName, attack.ammunitionRemaining));
  }

  if (
    attack.throwsWeapon &&
    attack.thrownItemName != null &&
    attack.thrownRemaining != null
  ) {
    lines.push(formatThrownWeaponLine(attack.thrownItemName, attack.thrownRemaining));
  }

  if (attack.notes.trim()) lines.push(attack.notes.trim());

  return lines.join("\n");
}

function formatActionTooltip(action: CharacterActionEntry): string {
  const lines = [`${ACTION_COST_LABELS[action.cost]} · ${actionSourceBadgeLabel(action)}`];
  if (action.description.trim()) lines.push(action.description.trim());
  if (action.uses) {
    const rest =
      action.restReset && action.restReset !== "none"
        ? ` (${action.restReset} rest)`
        : "";
    lines.push(`Uses: ${action.uses.current}/${action.uses.max}${rest}`);
  }
  return lines.join("\n");
}

function formatEnemyActionTooltip(action: EnemyNamedBlock): string {
  return action.description.trim() || action.name.trim() || "No description.";
}

const CORE_MOVE_ACTION: CharacterActionEntry = {
  id: "core:move",
  name: "Move",
  cost: "movement",
  description: "Move up to your speed. You can split movement before and after an action.",
  source: "core",
  sourceLabel: "Standard",
};

export function buildMoveCombatOption(context: {
  remainingFeet: number;
  speedFeet: number;
  dashAvailableFeet: number | null;
  dashUsed: boolean;
}): CombatOption {
  let tooltip = formatActionTooltip(CORE_MOVE_ACTION);
  if (!context.dashUsed && context.dashAvailableFeet != null) {
    tooltip += `\nDash: +${Math.max(0, context.dashAvailableFeet - context.remainingFeet)} ft available`;
  }
  if (context.dashUsed) {
    tooltip += "\nDash has been used this turn.";
  }

  return {
    id: COMBAT_MOVE_OPTION_ID,
    name: CORE_MOVE_ACTION.name,
    subtitle: `${ACTION_COST_LABELS.movement} · ${context.remainingFeet} ft left`,
    tooltip,
    kind: "movement",
    action: CORE_MOVE_ACTION,
  };
}

function attackToCombatOption(
  attack: DerivedAttack,
  data: CharacterData,
  kind: CombatOptionKind
): CombatOption {
  let tooltip = formatAttackTooltip(attack, data);
  if (attack.isOffHand) {
    tooltip = `Bonus action · Two-weapon fighting\n${tooltip}`;
  }

  return {
    id: `attack:${attack.id}`,
    name: attack.name,
    subtitle: attackOptionSubtitle(attack, kind),
    tooltip,
    kind,
    attack,
  };
}

export function isMainHandWeaponAttackOption(option: CombatOption): boolean {
  return Boolean(
    option.attack?.source === "weapon" &&
      !option.attack.isOffHand &&
      option.kind === "attack"
  );
}

export const COMBAT_DISENGAGE_ACTION_ID = "core:disengage";

export function isDisengageActionOption(option: CombatOption): boolean {
  return option.action?.id === COMBAT_DISENGAGE_ACTION_ID;
}

export const COMBAT_DASH_ACTION_ID = "core:dash";

export function isDashActionOption(option: CombatOption): boolean {
  return option.action?.id === COMBAT_DASH_ACTION_ID;
}

export const COMBAT_HELP_ACTION_ID = "core:help";

export function isHelpActionOption(option: CombatOption): boolean {
  return option.action?.id === COMBAT_HELP_ACTION_ID;
}

const COMBAT_CONFIRM_ACTION_IDS = new Set([
  "core:dodge",
  "core:hide",
  "core:ready",
  "core:search",
  "core:use-object",
]);

export function isConfirmActionOption(option: CombatOption): boolean {
  return option.action?.id != null && COMBAT_CONFIRM_ACTION_IDS.has(option.action.id);
}

function buildStandardActionOptions(
  turn: {
    actionUsed: boolean;
    dashUsed: boolean;
  },
  isEngaged: boolean,
  canUseHelp: boolean
): CombatOption[] {
  if (turn.actionUsed) return [];

  return getStandardCombatActions()
    .filter(
      (action) =>
        action.cost === "action" &&
        (action.id !== COMBAT_DASH_ACTION_ID || !turn.dashUsed) &&
        (action.id !== COMBAT_DISENGAGE_ACTION_ID || isEngaged) &&
        (action.id !== COMBAT_HELP_ACTION_ID || canUseHelp)
    )
    .map((action) => ({
      id: `action:${action.id}`,
      name: action.name,
      subtitle: actionSubtitle(action),
      tooltip: formatActionTooltip(action),
      kind: "action" as const,
      action,
    }));
}

const MELEE_REACH_FT = 10;

function isMeleeAttackRange(attack: DerivedAttack): boolean {
  const spec = parseAttackRangeSpec(attack);
  return !spec.isAoe && spec.maxFt <= MELEE_REACH_FT;
}

export function isMeleeOpportunityAttack(
  attack: DerivedAttack,
  catalogItems: Record<string, Item> = {}
): boolean {
  if (attack.isOffHand) return false;

  if (attack.source === "weapon" && attack.itemId) {
    const catalogItem = catalogItems[attack.itemId];
    const weaponProps = catalogItem ? getWeaponProperties(catalogItem) : null;
    if (weaponProps) {
      return weaponProps.weaponRange === "melee";
    }
  }

  if (attack.source === "cantrip" || attack.source === "spell") {
    if (attack.rollType === "save" || attack.rollType === "auto") return false;
    return isMeleeAttackRange(attack);
  }

  return isMeleeAttackRange(attack);
}

export function getOpportunityAttackOptionsForCharacter(
  character: ParsedCharacter,
  catalogItems: Record<string, Item>,
  classCatalog: PhbClass[]
): CombatOption[] {
  const attacks = [
    ...getAllAttacks(character.data, catalogItems, classCatalog),
    deriveUnarmedStrike(character.data),
  ];
  return attacks
    .filter((attack) => isMeleeOpportunityAttack(attack, catalogItems))
    .map((attack) => attackToCombatOption(attack, character.data, "attack"));
}

function isEnemyMeleeAction(description: string): boolean {
  return /\bMelee Weapon Attack:/i.test(description);
}

export function getOpportunityAttackOptionsForToken(
  token: CombatToken,
  context: {
    character: ParsedCharacter | null;
    enemyData: EnemyData | null;
    catalogItems: Record<string, Item>;
    classCatalog: PhbClass[];
  }
): CombatOption[] {
  if (context.character) {
    return getOpportunityAttackOptionsForCharacter(
      context.character,
      context.catalogItems,
      context.classCatalog
    );
  }

  if (context.enemyData) {
    return context.enemyData.actions
      .filter((action) => isEnemyMeleeAction(action.description))
      .map((action, index) => ({
        id: `enemy-action:${index}:${action.name}`,
        name: action.name || "Attack",
        subtitle: enemyActionSubtitle(action.description),
        tooltip: formatEnemyActionTooltip(action),
        kind: "enemy-action" as const,
        enemyAction: action,
      }));
  }

  return [];
}

function buildPartyOptionGroups(
  character: ParsedCharacter,
  catalogItems: Record<string, Item>,
  classCatalog: PhbClass[],
  featureCatalogs: FeatureCatalogs,
  turn: {
    actionUsedForTwoWeapon: boolean;
    actionUsed: boolean;
    bonusActionUsed: boolean;
    dashUsed: boolean;
  },
  isEngaged: boolean,
  canUseHelp: boolean
): { actions: CombatOption[]; bonusActions: CombatOption[] } {
  const attacks = getAllAttacks(character.data, catalogItems, classCatalog);
  const characterActions = getAllCharacterActions(character.data, featureCatalogs).filter(
    (action) => action.id !== "core:move"
  );

  const mainHandAttacks = attacks.filter((attack) => !attack.isOffHand);
  const offHandAttacks = attacks.filter((attack) => attack.isOffHand);

  const attackOptions: CombatOption[] = turn.actionUsed
    ? []
    : mainHandAttacks.map((attack) => attackToCombatOption(attack, character.data, "attack"));

  const actionOptions: CombatOption[] = buildStandardActionOptions(
    turn,
    isEngaged,
    canUseHelp
  );

  const bonusActionOptions: CombatOption[] = turn.bonusActionUsed
    ? []
    : characterActions
        .filter((action) => action.cost === "bonus-action")
        .map((action) => ({
          id: `bonus-action:${action.id}`,
          name: action.name,
          subtitle: actionSubtitle(action),
          tooltip: formatActionTooltip(action),
          kind: "bonus-action",
          action,
        }));

  const offHandAttackOptions: CombatOption[] =
    !turn.bonusActionUsed && turn.actionUsedForTwoWeapon && !turn.dashUsed
      ? offHandAttacks.map((attack) =>
          attackToCombatOption(attack, character.data, "bonus-action")
        )
      : [];

  return {
    actions: [...attackOptions, ...actionOptions],
    bonusActions: [...bonusActionOptions, ...offHandAttackOptions],
  };
}

function buildEnemyStatBlockOptions(
  enemyData: EnemyData,
  actionUsed: boolean
): CombatOption[] {
  if (actionUsed) return [];
  return enemyData.actions.map((action, index) => ({
    id: `enemy-action:${index}:${action.name}`,
    name: action.name || "Action",
    subtitle: enemyActionSubtitle(action.description),
    tooltip: formatEnemyActionTooltip(action),
    kind: "enemy-action" as const,
    enemyAction: action,
  }));
}

function buildNpcOptionGroups(
  enemyData: EnemyData | null,
  turn: {
    actionUsed: boolean;
    dashUsed: boolean;
  },
  isEngaged: boolean,
  canUseHelp: boolean
): CombatOptionGroups {
  const statBlockActions = enemyData
    ? buildEnemyStatBlockOptions(enemyData, turn.actionUsed)
    : [];
  const standardActions = buildStandardActionOptions(turn, isEngaged, canUseHelp);

  return {
    actions: [...statBlockActions, ...standardActions],
    bonusActions: [],
  };
}


export interface CombatOptionGroups {
  actions: CombatOption[];
  bonusActions: CombatOption[];
}

export function isAttackTargetingOption(option: CombatOption): boolean {
  return (
    option.kind === "attack" ||
    option.kind === "enemy-action" ||
    (option.kind === "bonus-action" && !!option.attack)
  );
}

export function isImplementedCombatOption(option: CombatOption): boolean {
  return (
    isAttackTargetingOption(option) ||
    isHelpActionOption(option) ||
    isDisengageActionOption(option) ||
    isDashActionOption(option) ||
    isConfirmActionOption(option)
  );
}

export function getCombatOptionGroupsForToken(
  token: CombatToken,
  context: {
    character: ParsedCharacter | null;
    enemyData: EnemyData | null;
    catalogItems: Record<string, Item>;
    classCatalog: PhbClass[];
    featureCatalogs: FeatureCatalogs;
    actionUsedForTwoWeapon: boolean;
    actionUsed: boolean;
    bonusActionUsed: boolean;
    dashUsed: boolean;
    combatState: CombatState;
    token: CombatToken;
  }
): CombatOptionGroups {
  if (token.kind === "party" && context.character) {
    return buildPartyOptionGroups(
      context.character,
      context.catalogItems,
      context.classCatalog,
      context.featureCatalogs,
      {
        actionUsedForTwoWeapon: context.actionUsedForTwoWeapon,
        actionUsed: context.actionUsed,
        bonusActionUsed: context.bonusActionUsed,
        dashUsed: context.dashUsed,
      },
      isTokenEngaged(context.token, context.combatState),
      canUseHelpAction(context.token, context.combatState)
    );
  }

  if (token.kind === "enemy" && context.enemyData) {
    return buildNpcOptionGroups(
      context.enemyData,
      {
        actionUsed: context.actionUsed,
        dashUsed: context.dashUsed,
      },
      isTokenEngaged(context.token, context.combatState),
      canUseHelpAction(context.token, context.combatState)
    );
  }

  if (token.kind === "ally") {
    return buildNpcOptionGroups(
      context.enemyData,
      {
        actionUsed: context.actionUsed,
        dashUsed: context.dashUsed,
      },
      isTokenEngaged(context.token, context.combatState),
      canUseHelpAction(context.token, context.combatState)
    );
  }

  return { actions: [], bonusActions: [] };
}
