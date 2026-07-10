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
  getAllAttacks,
  getAttackCategoryLabel,
  hasTwoWeaponFighting,
  MELEE_REACH_FT,
  type DerivedAttack,
} from "@/lib/dnd/attacks";
import {
  canTwoWeaponFightSameTurn,
  getWieldedWeaponPair,
} from "@/lib/dnd/two-weapon-fighting";
import {
  formatBattleActionTooltip,
  formatBattleAttackTooltip,
  formatBattleEnemyActionTooltip,
  formatBattleMoveTooltip,
  formatBattleOtherActionsTooltip,
  formatBattleTooltip,
  battleTooltipFallbackCharacter,
} from "@/lib/combat/battle-tooltip";
import { canUseHelpAction, isTokenEngaged } from "@/lib/combat/engagement";
import { isBattleOver, isTokenOnMapEdge } from "@/lib/combat/battle-over";
import {
  canShowHpPoolOption,
  formatHpPoolCombatSubtitle,
  formatHpPoolCombatTooltip,
  hasHpPoolValidTarget,
  isHpPoolCombatOption,
} from "@/lib/combat/combat-mechanical-actions";
import { parseAttackRangeSpec } from "@/lib/combat/targeting";
import { featureIdFromActionId } from "@/lib/dnd/catalog-feature-mechanics";
import {
  getHpPoolRemaining,
  getResolvedMechanicalFeature,
} from "@/lib/dnd/mechanical-features";
import type { PhbClass } from "@/lib/dnd/phb/types";
import type { CharacterData } from "@/lib/schemas/character";
import type { EnemyData, EnemyNamedBlock } from "@/lib/schemas/enemy";
import {
  isEnemyMeleeParsedAction,
  isEnemyWeaponAction,
  parseEnemyActions,
  type ParsedEnemyAction,
} from "@/lib/combat/enemy-action-parser";
import {
  buildInitialMultiattackRemaining,
  getMultiattackRemainingForWeapon,
  getMultiattackSpec,
  isWeaponInMultiattackBranch,
  totalMultiattackRemaining,
  type MultiattackBranch,
  type MultiattackSpec,
} from "@/lib/combat/multiattack";
import { getWeaponProperties, type Item } from "@/lib/schemas/item";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import {
  formatDeclareCastSpellSubtitle,
  formatSpellCastCombatTooltip,
  formatSpellCombatSubtitle,
  formatSpellPickerCombatTooltip,
  formatSpellSlotSummaryFooter,
  listCombatCastableCantripSpells,
  listCombatCastableActionSpellsForPicker,
  listCombatCastableLeveledSpells,
  resolveCombatCastableSpell,
} from "@/lib/dnd/combat-spells";
import {
  EMERGE_FROM_SHELL_ACTION_ID,
  SHELL_DEFENSE_ENTER_ACTION_ID,
  canTakeReactions,
  filterOptionGroupsForTokenEffects,
  isRegisteredCombatFeatureAction,
  isRegisteredFeatureEnterAction,
  isTokenInShellDefense,
  isTokenRestrictedByEffects,
} from "@/lib/combat/feature-effects";

export { isHpPoolCombatOption, isLayOnHandsOption } from "@/lib/combat/combat-mechanical-actions";

export type CombatMechanicalKind = "hp-pool";

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
  /** Set for catalog-driven mechanical combat flows (e.g. hp-pool heal). */
  mechanicalKind?: CombatMechanicalKind;
  /** Granted feature id for mechanical combat options. */
  mechanicalFeatureId?: string;
  spellCast?: {
    spellId: string;
    characterSpellId: string;
    level: number;
    castSlotLevel: number;
    castingCost: "action" | "bonus-action";
  };
  /** Opens the leveled spell picker for action-cost spells (cantrips and bonus-action spells stay direct). */
  spellcasting?: {
    castingCost: "action";
  };
  /** Overrides default action cost (e.g. Multiattack strikes). */
  actionCostOverride?: "multiattack";
}

export const COMBAT_CAST_SPELL_ACTION_ID = "core:cast-spell";

function buildCantripCastCombatOptions(
  character: CharacterData,
  castingCost: "action" | "bonus-action"
): CombatOption[] {
  return listCombatCastableCantripSpells(character, { castingCost }).map(
    ({ spell, slug, castingCost: cost }) => ({
      id: `spell-cast:${spell.id}`,
      name: spell.name,
      subtitle: formatDeclareCastSpellSubtitle(spell, slug),
      tooltip: formatSpellCastCombatTooltip(spell, slug, character),
      kind: cost === "bonus-action" ? "bonus-action" : "action",
      spellCast: {
        spellId: slug,
        characterSpellId: spell.id,
        level: spell.level,
        castSlotLevel: 0,
        castingCost: cost,
      },
    })
  );
}

function buildLeveledSpellCastCombatOptions(
  character: CharacterData,
  castingCost: "action" | "bonus-action"
): CombatOption[] {
  return listCombatCastableLeveledSpells(character, { castingCost }).map((entry) => ({
    id: `spell-cast:${entry.spell.id}`,
    name: entry.spell.name,
    subtitle: formatDeclareCastSpellSubtitle(entry.spell, entry.slug, {
      omitSpellLevel: entry.castingCost === "bonus-action",
    }),
    tooltip: formatSpellPickerCombatTooltip(entry, character),
    kind: entry.castingCost === "bonus-action" ? "bonus-action" : "action",
    spellCast: {
      spellId: entry.slug,
      characterSpellId: entry.spell.id,
      level: entry.spell.level,
      castSlotLevel: 0,
      castingCost: entry.castingCost,
    },
  }));
}

function buildCastSpellCombatOption(character: CharacterData): CombatOption | null {
  const cantrips = listCombatCastableCantripSpells(character, { castingCost: "action" });
  const leveled = listCombatCastableLeveledSpells(character, { castingCost: "action" });
  if (cantrips.length === 0 && leveled.length === 0) return null;

  const tooltipLines = ["Choose a prepared spell or utility cantrip."];
  if (leveled.length > 0) {
    tooltipLines.push(formatSpellSlotSummaryFooter(character.spells.slots));
  }

  return {
    id: `action:${COMBAT_CAST_SPELL_ACTION_ID}`,
    name: "Cast a Spell",
    subtitle: ACTION_COST_LABELS.action,
    tooltip: tooltipLines.join("\n"),
    kind: "action",
    spellcasting: { castingCost: "action" },
  };
}

export function isSpellCastOption(option: CombatOption): boolean {
  return option.spellCast != null;
}

export function isSpellcastingEntryOption(option: CombatOption): boolean {
  return option.spellcasting != null;
}

function actionSubtitle(action: CharacterActionEntry): string {
  return ACTION_COST_LABELS[action.cost];
}

function attackOptionSubtitle(attack: DerivedAttack, remaining?: number): string {
  const range = attack.range?.trim() || null;
  if (attack.rollType === "save" && attack.saveDc != null) {
    const ability = attack.saveAbility?.trim();
    const base = ability
      ? `Save · DC ${attack.saveDc} ${ability}`
      : `Save · DC ${attack.saveDc}`;
    return remaining != null ? `${base} · ${remaining} left` : base;
  }
  if (attack.source === "cantrip") {
    return formatSpellCombatSubtitle(0, range);
  }
  if (attack.source === "spell") {
    return formatSpellCombatSubtitle(
      attack.castSlotLevel ?? attack.spellLevel ?? 1,
      range
    );
  }
  const category = getAttackCategoryLabel(attack);
  const base = range ? `${category} · ${range}` : category;
  return remaining != null ? `${base} · ${remaining} left` : base;
}

const CORE_MOVE_ACTION: CharacterActionEntry = {
  id: "core:move",
  name: "Move",
  cost: "movement",
  description: "Move up to your speed. You can split movement before and after an action.",
  source: "core",
  sourceLabel: "Standard",
};

const CORE_DASH_ACTION: CharacterActionEntry = {
  id: "core:dash",
  name: "Dash",
  cost: "action",
  description: "Gain extra movement equal to your speed for this turn.",
  source: "core",
  sourceLabel: "Standard",
};

export function buildMoveCombatOption(context: {
  remainingFeet: number;
  speedFeet: number;
  dashAvailableFeet: number | null;
  dashUsed: boolean;
}): CombatOption {
  return {
    id: COMBAT_MOVE_OPTION_ID,
    name: CORE_MOVE_ACTION.name,
    subtitle: `${ACTION_COST_LABELS.movement} · ${context.remainingFeet} ft left`,
    tooltip: formatBattleMoveTooltip(context),
    kind: "movement",
    action: CORE_MOVE_ACTION,
  };
}

export function buildDashCombatOption(context: {
  speedFeet: number;
  dashUsed: boolean;
}): CombatOption {
  const additionalFooter = !context.dashUsed
    ? [`Grants: +${context.speedFeet} ft movement this turn`]
    : ["Dash: used this turn"];

  return {
    id: `action:${COMBAT_DASH_ACTION_ID}`,
    name: CORE_DASH_ACTION.name,
    subtitle: actionSubtitle(CORE_DASH_ACTION),
    tooltip: formatBattleActionTooltip(CORE_DASH_ACTION, { additionalFooter }),
    kind: "movement",
    action: CORE_DASH_ACTION,
  };
}

function effectiveWeaponDamageDice(
  attack: DerivedAttack,
  kind: CombatOptionKind,
  twf: boolean
): string {
  if (attack.source !== "weapon") return attack.damageDice;
  if (kind === "action") return attack.damageDice;
  if (kind === "bonus-action") {
    return twf
      ? attack.damageDice
      : attack.damageDiceWithoutMod ?? attack.damageDice;
  }
  return attack.damageDice;
}

function attackWithDamageForKind(
  attack: DerivedAttack,
  kind: CombatOptionKind,
  twf: boolean
): DerivedAttack {
  const damageDice = effectiveWeaponDamageDice(attack, kind, twf);
  if (damageDice === attack.damageDice) return attack;
  return { ...attack, damageDice };
}

function attackToCombatOption(
  attack: DerivedAttack,
  data: CharacterData,
  kind: CombatOptionKind,
  twf = false
): CombatOption {
  const displayAttack = attackWithDamageForKind(attack, kind, twf);
  let tooltip = formatBattleAttackTooltip(displayAttack, data, { omitBonusActionNote: true });
  if (kind === "bonus-action" && attack.source === "weapon") {
    tooltip = formatBattleTooltip({
      header: "Two-weapon fighting",
      metadata: [],
      footer: [tooltip],
    });
  }

  return {
    id: `attack:${attack.id}`,
    name: attack.name,
    subtitle: attackOptionSubtitle(displayAttack),
    tooltip,
    kind,
    attack: displayAttack,
  };
}

export function isWieldedMainHandWeaponAttack(attack: DerivedAttack): boolean {
  return attack.source === "weapon" && !attack.isOffHand;
}

export function isWeaponActionAttackOption(option: CombatOption): boolean {
  return Boolean(
    option.attack?.source === "weapon" && option.kind === "attack"
  );
}

export const COMBAT_LEAVE_AREA_ACTION_ID = "core:leave-area";

const LEAVE_AREA_ACTION: CharacterActionEntry = {
  id: COMBAT_LEAVE_AREA_ACTION_ID,
  name: "Leave Area",
  cost: "action",
  description: "Leave the battlefield and remove your character from the board.",
  source: "core",
  sourceLabel: "Standard",
};

export function buildLeaveAreaOption(): CombatOption {
  return {
    id: `action:${COMBAT_LEAVE_AREA_ACTION_ID}`,
    name: LEAVE_AREA_ACTION.name,
    subtitle: actionSubtitle(LEAVE_AREA_ACTION),
    tooltip: formatBattleActionTooltip(LEAVE_AREA_ACTION),
    kind: "action",
    action: LEAVE_AREA_ACTION,
  };
}

export function isLeaveAreaOption(option: CombatOption): boolean {
  return option.action?.id === COMBAT_LEAVE_AREA_ACTION_ID;
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

export const COMBAT_USE_OBJECT_ACTION_ID = "core:use-object";

export const COMBAT_USE_OBJECT_OPTION_ID = `action:${COMBAT_USE_OBJECT_ACTION_ID}`;

export function isUseObjectActionOption(option: CombatOption): boolean {
  return option.action?.id === COMBAT_USE_OBJECT_ACTION_ID;
}

const COMBAT_MERGED_OTHER_ACTION_IDS = new Set([
  "core:dodge",
  "core:hide",
  "core:ready",
  "core:search",
]);

export const COMBAT_OTHER_ACTIONS_ACTION_ID = "core:other-actions";

const CORE_OTHER_ACTIONS_ACTION: CharacterActionEntry = {
  id: COMBAT_OTHER_ACTIONS_ACTION_ID,
  name: "Other Actions",
  cost: "action",
  description:
    "Dodge, Hide, Ready, or Search. Declare which action you are taking to the DM.",
  source: "core",
  sourceLabel: "Standard",
};

export function getCombatOtherActionEntries(): CharacterActionEntry[] {
  return getStandardCombatActions().filter((action) =>
    COMBAT_MERGED_OTHER_ACTION_IDS.has(action.id)
  );
}

export function isOtherActionsOption(option: CombatOption): boolean {
  return option.action?.id === COMBAT_OTHER_ACTIONS_ACTION_ID;
}

export function isShellDefenseEnterOption(option: CombatOption): boolean {
  return option.action?.id === SHELL_DEFENSE_ENTER_ACTION_ID;
}

export function isEmergeFromShellOption(option: CombatOption): boolean {
  return option.action?.id === EMERGE_FROM_SHELL_ACTION_ID;
}

function buildHpPoolOption(
  featureId: string,
  character: ParsedCharacter,
  action: CharacterActionEntry,
  token: CombatToken,
  combatState: CombatState,
  partyCharacters: ParsedCharacter[],
  turn: { actionUsed: boolean },
  featureCatalogs: FeatureCatalogs,
  battleOver = false
): CombatOption | null {
  if (!canShowHpPoolOption(token, turn, battleOver)) return null;
  if (
    !hasHpPoolValidTarget(
      featureId,
      token,
      character,
      combatState,
      partyCharacters,
      featureCatalogs
    )
  ) {
    return null;
  }

  const poolRemaining = getHpPoolRemaining(character.data, featureId, featureCatalogs);

  return {
    id: `action:${action.id}`,
    name: action.name,
    subtitle: formatHpPoolCombatSubtitle(action.cost, poolRemaining),
    tooltip: formatHpPoolCombatTooltip(action, poolRemaining),
    kind: "action",
    action,
    mechanicalKind: "hp-pool",
    mechanicalFeatureId: featureId,
  };
}

function buildRegisteredFeatureActionOptions(
  character: ParsedCharacter,
  characterActions: CharacterActionEntry[],
  turn: { actionUsed: boolean },
  token: CombatToken,
  combatState: CombatState,
  partyCharacters: ParsedCharacter[],
  featureCatalogs: FeatureCatalogs,
  battleOver = false
): CombatOption[] {
  if (battleOver || turn.actionUsed || isTokenInShellDefense(token)) return [];

  const options: CombatOption[] = [];
  const seenHpPool = new Set<string>();

  for (const action of characterActions) {
    const featureId = featureIdFromActionId(action.id);
    if (featureId) {
      const resolved = getResolvedMechanicalFeature(
        character.data,
        featureId,
        featureCatalogs
      );
      if (resolved?.kind === "hp-pool" && resolved.usesAction) {
        if (seenHpPool.has(featureId)) continue;
        seenHpPool.add(featureId);
        const hpPool = buildHpPoolOption(
          featureId,
          character,
          action,
          token,
          combatState,
          partyCharacters,
          turn,
          featureCatalogs,
          battleOver
        );
        if (hpPool) options.push(hpPool);
        continue;
      }
    }

    if (!isRegisteredFeatureEnterAction(action.id)) continue;

    options.push({
      id: `action:${action.id}`,
      name: action.name,
      subtitle: actionSubtitle(action),
      tooltip: formatBattleActionTooltip(action),
      kind: "action" as const,
      action,
    });
  }

  return options;
}

function buildStandardActionOptions(
  turn: {
    actionUsed: boolean;
    dashUsed: boolean;
    freeObjectInteractionUsed: boolean;
  },
  isEngaged: boolean,
  canUseHelp: boolean,
  canUseObject: boolean,
  battleOver = false
): CombatOption[] {
  const options = getStandardCombatActions()
    .filter(
      (action) =>
        action.cost === "action" &&
        !COMBAT_MERGED_OTHER_ACTION_IDS.has(action.id) &&
        (action.id !== COMBAT_USE_OBJECT_ACTION_ID || canUseObject) &&
        (action.id === COMBAT_USE_OBJECT_ACTION_ID || !turn.actionUsed) &&
        (action.id !== COMBAT_DISENGAGE_ACTION_ID || isEngaged) &&
        (action.id !== COMBAT_HELP_ACTION_ID || canUseHelp)
    )
    .map((action) => ({
      id: `action:${action.id}`,
      name: action.name,
      subtitle: actionSubtitle(action),
      tooltip: formatBattleActionTooltip(action),
      kind: "action" as const,
      action,
    }));

  if (!turn.actionUsed) {
    options.push({
      id: `action:${COMBAT_OTHER_ACTIONS_ACTION_ID}`,
      name: CORE_OTHER_ACTIONS_ACTION.name,
      subtitle: actionSubtitle(CORE_OTHER_ACTIONS_ACTION),
      tooltip: formatBattleOtherActionsTooltip(getCombatOtherActionEntries()),
      kind: "action",
      action: CORE_OTHER_ACTIONS_ACTION,
    });
  }

  return options;
}

function isMeleeAttackRange(attack: DerivedAttack): boolean {
  const spec = parseAttackRangeSpec(attack);
  return !spec.isAoe && spec.maxFt <= MELEE_REACH_FT;
}

export function isMeleeOpportunityAttack(
  attack: DerivedAttack,
  catalogItems: Record<string, Item> = {}
): boolean {
  if (attack.source === "weapon" && attack.itemId) {
    if (attack.throwsWeapon) return false;
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

function getOpportunityAttackAttacks(
  character: CharacterData,
  catalogItems: Record<string, Item>,
  classCatalog: PhbClass[]
): DerivedAttack[] {
  return getAllAttacks(character, catalogItems, classCatalog);
}

export function getOpportunityAttackOptionsForCharacter(
  character: ParsedCharacter,
  catalogItems: Record<string, Item>,
  classCatalog: PhbClass[]
): CombatOption[] {
  return getOpportunityAttackAttacks(character.data, catalogItems, classCatalog)
    .filter((attack) => isMeleeOpportunityAttack(attack, catalogItems))
    .map((attack) => attackToCombatOption(attack, character.data, "attack"));
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
  if (!canTakeReactions(token)) return [];

  if (context.character) {
    return getOpportunityAttackOptionsForCharacter(
      context.character,
      context.catalogItems,
      context.classCatalog
    );
  }

  if (context.enemyData) {
    return parseEnemyActions(context.enemyData.actions)
      .filter(isEnemyMeleeParsedAction)
      .flatMap((parsed) => {
        if (!parsed.attack) return [];
        const attacks =
          parsed.kind === "weapon-dual" && parsed.dualAttacks
            ? [parsed.dualAttacks.melee]
            : [parsed.attack];
        return attacks.map((attack) => buildEnemyAttackOption(attack));
      });
  }

  return [];
}

function buildPartyOptionGroups(
  character: ParsedCharacter,
  catalogItems: Record<string, Item>,
  classCatalog: PhbClass[],
  featureCatalogs: FeatureCatalogs,
  token: CombatToken,
  combatState: CombatState,
  partyCharacters: ParsedCharacter[],
  turn: {
    actionUsedForTwoWeapon: boolean;
    twoWeaponFightingUsedOffHand: boolean | null;
    actionUsed: boolean;
    bonusActionUsed: boolean;
    dashUsed: boolean;
    freeObjectInteractionUsed: boolean;
  },
  isEngaged: boolean,
  canUseHelp: boolean,
  canUseObject: boolean,
  options?: { battleOver?: boolean }
): CombatOptionGroups {
  if (isTokenRestrictedByEffects(token)) {
    return filterOptionGroupsForTokenEffects(
      token,
      { actions: [], multiattackActions: [], bonusActions: [] },
      turn
    ) as CombatOptionGroups;
  }

  const attacks = getAllAttacks(character.data, catalogItems, classCatalog);
  const characterActions = getAllCharacterActions(character.data, featureCatalogs).filter(
    (action) => action.id !== "core:move"
  );
  const twf = hasTwoWeaponFighting(character.data, classCatalog);

  const weaponAttacks = attacks.filter((attack) => attack.source === "weapon");
  // Cantrips stay as direct buttons; leveled spells use the Cast a Spell picker.
  const spellAttacks = attacks.filter((attack) => attack.source === "cantrip");
  const naturalAttacks = attacks.filter((attack) => attack.source === "natural");

  const mainHandWeaponAttacks = weaponAttacks.filter((attack) => !attack.isOffHand);
  const offHandWeaponAttacks = weaponAttacks.filter((attack) => attack.isOffHand);

  const { main: mainWeapon, off: offWeapon } = getWieldedWeaponPair(
    character.data,
    catalogItems
  );
  const bothHandsWielded = mainWeapon != null && offWeapon != null;

  const hasMainHandWielded = mainWeapon != null;
  const hasAnyWeaponWielded = mainWeapon != null || offWeapon != null;

  const wieldedWeaponAttacks = bothHandsWielded
    ? [...mainHandWeaponAttacks, ...offHandWeaponAttacks]
    : hasMainHandWielded
      ? mainHandWeaponAttacks
      : offHandWeaponAttacks.length > 0
        ? offHandWeaponAttacks
        : mainHandWeaponAttacks;

  const actionNaturalAttacks = naturalAttacks.filter(
    (attack) =>
      !attack.bonusActionOnly &&
      (attack.alwaysAvailable || !hasAnyWeaponWielded)
  );

  const actionPanelAttacks = [
    ...wieldedWeaponAttacks,
    ...spellAttacks,
    ...actionNaturalAttacks,
  ];

  const castSpellOption =
    options?.battleOver || turn.actionUsed
      ? null
      : buildCastSpellCombatOption(character.data);

  const attackOptions: CombatOption[] =
    options?.battleOver || turn.actionUsed
      ? []
      : actionPanelAttacks.map((attack) =>
          attackToCombatOption(attack, character.data, "attack", twf)
        );

  const actionOptions: CombatOption[] = [
    ...(castSpellOption ? [castSpellOption] : []),
    ...buildRegisteredFeatureActionOptions(
      character,
      characterActions,
      turn,
      token,
      combatState,
      partyCharacters,
      featureCatalogs,
      options?.battleOver
    ),
    ...buildStandardActionOptions(
      turn,
      isEngaged,
      canUseHelp,
      canUseObject,
      options?.battleOver
    ),
  ];

  const bonusActionOptions: CombatOption[] = turn.bonusActionUsed
    ? []
    : characterActions
        .filter(
          (action) =>
            action.cost === "bonus-action" && !isRegisteredFeatureEnterAction(action.id)
        )
        .map((action) => ({
          id: `bonus-action:${action.id}`,
          name: action.name,
          subtitle: actionSourceBadgeLabel(action),
          tooltip: formatBattleActionTooltip(action),
          kind: "bonus-action",
          action,
        }));

  const twfSameTurn = canTwoWeaponFightSameTurn(
    character.data,
    catalogItems,
    classCatalog
  );

  const bonusWeaponAttacks =
    turn.twoWeaponFightingUsedOffHand != null
      ? weaponAttacks.filter(
          (attack) => attack.isOffHand !== turn.twoWeaponFightingUsedOffHand
        )
      : [];

  const offHandAttackOptions: CombatOption[] =
    !turn.bonusActionUsed &&
    turn.actionUsedForTwoWeapon &&
    twfSameTurn &&
    turn.twoWeaponFightingUsedOffHand != null &&
    !turn.dashUsed
      ? bonusWeaponAttacks.map((attack) =>
          attackToCombatOption(attack, character.data, "bonus-action", twf)
        )
      : [];

  const bonusNaturalAttacks = naturalAttacks.filter((attack) => {
    if (!attack.bonusActionOnly) return false;
    if (attack.monkBonusUnarmed) return turn.actionUsed;
    return true;
  });

  const bonusNaturalAttackOptions: CombatOption[] =
    options?.battleOver || turn.bonusActionUsed
      ? []
      : bonusNaturalAttacks.map((attack) =>
          attackToCombatOption(attack, character.data, "bonus-action", twf)
        );

  const cantripBonusCastOptions =
    options?.battleOver || turn.bonusActionUsed
      ? []
      : buildCantripCastCombatOptions(character.data, "bonus-action");
  const bonusLeveledSpellCastOptions =
    options?.battleOver || turn.bonusActionUsed
      ? []
      : buildLeveledSpellCastCombatOptions(character.data, "bonus-action");

  return {
    actions: [...attackOptions, ...actionOptions],
    multiattackActions: [],
    bonusActions: options?.battleOver
      ? []
      : [
          ...bonusLeveledSpellCastOptions,
          ...cantripBonusCastOptions,
          ...bonusActionOptions,
          ...offHandAttackOptions,
          ...bonusNaturalAttackOptions,
        ],
  };
}

function buildEnemyAttackOption(
  attack: DerivedAttack,
  options?: { actionCostOverride?: "multiattack"; remaining?: number }
): CombatOption {
  return {
    id: `attack:${attack.id}`,
    name: attack.name,
    subtitle: attackOptionSubtitle(attack, options?.remaining),
    tooltip: formatBattleAttackTooltip(attack, battleTooltipFallbackCharacter),
    kind: "attack",
    attack,
    actionCostOverride: options?.actionCostOverride,
  };
}

function buildEnemyOtherActionOption(action: EnemyNamedBlock, index: number): CombatOption {
  return {
    id: `action:enemy:${index}:${action.name}`,
    name: action.name || "Action",
    subtitle: ACTION_COST_LABELS.action,
    tooltip: formatBattleEnemyActionTooltip(action),
    kind: "action",
    action: {
      id: `enemy:${index}:${action.name}`,
      name: action.name || "Action",
      cost: "action",
      description: action.description,
      source: "custom",
      sourceLabel: "Stat block",
    },
  };
}

function isParsedActionInMultiattackBranch(
  parsed: ParsedEnemyAction,
  branch: MultiattackBranch
): boolean {
  if (!isEnemyWeaponAction(parsed)) return false;
  return isWeaponInMultiattackBranch(parsed, branch);
}

function buildNpcOptionGroups(
  enemyData: EnemyData | null,
  turn: {
    actionUsed: boolean;
    dashUsed: boolean;
    freeObjectInteractionUsed: boolean;
    multiattackBranchIndex: number | null;
    multiattackRemaining: Record<string, number>;
  },
  isEngaged: boolean,
  canUseHelp: boolean,
  canUseObject: boolean
): CombatOptionGroups {
  const standardActions = buildStandardActionOptions(turn, isEngaged, canUseHelp, canUseObject);

  if (!enemyData || turn.actionUsed) {
    return {
      actions: standardActions,
      multiattackActions: [],
      bonusActions: [],
    };
  }

  const parsedActions = parseEnemyActions(enemyData.actions);
  const multiattackSpec = getMultiattackSpec(enemyData.actions);
  const effectiveBranchIndex =
    turn.multiattackBranchIndex ??
    (multiattackSpec && multiattackSpec.branches.length === 1 ? 0 : null);
  const activeBranch =
    effectiveBranchIndex != null && multiattackSpec
      ? multiattackSpec.branches[effectiveBranchIndex]
      : null;
  const effectiveRemaining =
    Object.keys(turn.multiattackRemaining).length > 0
      ? turn.multiattackRemaining
      : activeBranch
        ? buildInitialMultiattackRemaining(activeBranch, parsedActions)
        : {};
  const multiattackActive =
    multiattackSpec != null &&
    !turn.actionUsed &&
    effectiveBranchIndex != null &&
    totalMultiattackRemaining(effectiveRemaining) > 0;

  const actionOptions: CombatOption[] = [];
  const multiattackOptions: CombatOption[] = [];

  for (const parsed of parsedActions) {
    if (parsed.kind === "multiattack") continue;

    if (parsed.attack) {
      const attacks: DerivedAttack[] =
        parsed.kind === "weapon-dual" && parsed.dualAttacks
          ? activeBranch?.categoryFilter === "ranged"
            ? [parsed.dualAttacks.ranged]
            : [parsed.dualAttacks.melee]
          : [parsed.attack];

      for (const attack of attacks) {
        const inMultiattackBranch =
          activeBranch != null && isParsedActionInMultiattackBranch(parsed, activeBranch);

        if (multiattackActive && inMultiattackBranch) {
          const remaining = getMultiattackRemainingForWeapon(
            effectiveRemaining,
            parsed.action.name,
            parsed
          );
          if (remaining > 0) {
            multiattackOptions.push(
              buildEnemyAttackOption(attack, {
                actionCostOverride: "multiattack",
                remaining,
              })
            );
          }
        } else if (!inMultiattackBranch || !multiattackSpec) {
          actionOptions.push(buildEnemyAttackOption(attack));
        }
      }
      continue;
    }

    actionOptions.push(buildEnemyOtherActionOption(parsed.action, parsed.index));
  }

  return {
    actions: [...actionOptions, ...standardActions],
    multiattackActions: multiattackOptions,
    multiattackBranches: multiattackSpec?.branches,
    multiattackPreamble: multiattackSpec?.preamble,
    bonusActions: [],
  };
}


export interface CombatOptionGroups {
  actions: CombatOption[];
  multiattackActions: CombatOption[];
  multiattackBranches?: MultiattackBranch[];
  multiattackPreamble?: string;
  bonusActions: CombatOption[];
}

export function isAttackTargetingOption(option: CombatOption): boolean {
  return (
    option.kind === "attack" ||
    (option.kind === "bonus-action" && !!option.attack)
  );
}

export function isHpPoolCombatOptionKind(option: CombatOption): boolean {
  return option.mechanicalKind === "hp-pool";
}

export function isEnemyStatBlockActionOption(option: CombatOption): boolean {
  return option.kind === "action" && option.id.startsWith("action:enemy:");
}

export function isImplementedCombatOption(option: CombatOption): boolean {
  return (
    isAttackTargetingOption(option) ||
    isSpellCastOption(option) ||
    isSpellcastingEntryOption(option) ||
    isHelpActionOption(option) ||
    isDisengageActionOption(option) ||
    isDashActionOption(option) ||
    isUseObjectActionOption(option) ||
    isOtherActionsOption(option) ||
    isLeaveAreaOption(option) ||
    isShellDefenseEnterOption(option) ||
    isEmergeFromShellOption(option) ||
    isHpPoolCombatOptionKind(option) ||
    isEnemyStatBlockActionOption(option) ||
    (option.action != null && isRegisteredCombatFeatureAction(option.action.id))
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
    twoWeaponFightingUsedOffHand: boolean | null;
    actionUsed: boolean;
    bonusActionUsed: boolean;
    dashUsed: boolean;
    freeObjectInteractionUsed: boolean;
    combatState: CombatState;
    token: CombatToken;
    partyCharacters?: ParsedCharacter[];
    canUseObject: boolean;
    battleOver?: boolean;
  }
): CombatOptionGroups {
  const battleOver = context.battleOver ?? isBattleOver(context.combatState);

  if (token.kind === "party" && context.character) {
    const groups = buildPartyOptionGroups(
      context.character,
      context.catalogItems,
      context.classCatalog,
      context.featureCatalogs,
      token,
      context.combatState,
      context.partyCharacters ?? [],
      {
        actionUsedForTwoWeapon: context.actionUsedForTwoWeapon,
        twoWeaponFightingUsedOffHand: context.twoWeaponFightingUsedOffHand,
        actionUsed: context.actionUsed,
        bonusActionUsed: context.bonusActionUsed,
        dashUsed: context.dashUsed,
        freeObjectInteractionUsed: context.freeObjectInteractionUsed,
      },
      isTokenEngaged(context.token, context.combatState),
      canUseHelpAction(context.token, context.combatState),
      context.canUseObject,
      { battleOver }
    );

    if (battleOver && isTokenOnMapEdge(token, context.combatState)) {
      return {
        ...groups,
        actions: [buildLeaveAreaOption(), ...groups.actions],
      };
    }

    return groups;
  }

  const multiattackTurn = {
    actionUsed: context.actionUsed,
    dashUsed: context.dashUsed,
    freeObjectInteractionUsed: context.freeObjectInteractionUsed,
    multiattackBranchIndex: context.combatState.turn.multiattackBranchIndex ?? null,
    multiattackRemaining: context.combatState.turn.multiattackRemaining ?? {},
  };

  if (token.kind === "enemy" && context.enemyData) {
    if (battleOver) {
      return { actions: [], multiattackActions: [], bonusActions: [] };
    }
    return buildNpcOptionGroups(
      context.enemyData,
      multiattackTurn,
      isTokenEngaged(context.token, context.combatState),
      canUseHelpAction(context.token, context.combatState),
      false
    );
  }

  if (token.kind === "ally") {
    if (battleOver) {
      return { actions: [], multiattackActions: [], bonusActions: [] };
    }
    return buildNpcOptionGroups(
      context.enemyData,
      multiattackTurn,
      isTokenEngaged(context.token, context.combatState),
      canUseHelpAction(context.token, context.combatState),
      false
    );
  }

  return { actions: [], multiattackActions: [], bonusActions: [] };
}

/** Resolve a derived attack from a stored combat option id (e.g. for pending-attack review UI). */
export function findDerivedAttackByOptionId(
  optionId: string,
  token: CombatToken,
  character: ParsedCharacter | null,
  catalogItems: Record<string, Item>,
  classCatalog: PhbClass[],
  enemyData?: EnemyData | null
): DerivedAttack | null {
  if (!optionId.startsWith("attack:")) return null;
  const attackId = optionId.slice("attack:".length);
  if (token.kind === "party" && character) {
    const attacks = getOpportunityAttackAttacks(
      character.data,
      catalogItems,
      classCatalog
    );
    return attacks.find((attack) => attack.id === attackId) ?? null;
  }
  if ((token.kind === "enemy" || token.kind === "ally") && enemyData) {
    for (const parsed of parseEnemyActions(enemyData.actions)) {
      if (parsed.attack?.id === attackId) return parsed.attack;
      if (parsed.dualAttacks?.melee.id === attackId) return parsed.dualAttacks.melee;
      if (parsed.dualAttacks?.ranged.id === attackId) return parsed.dualAttacks.ranged;
    }
  }
  return null;
}
