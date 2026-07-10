import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import {
  deriveGrantedFeatures,
  featureSourceLabel,
  getCustomFeatures,
} from "@/lib/character/feature-derivation";
import {
  deriveMechanicalFeatureActions,
} from "@/lib/dnd/mechanical-features";
import type {
  ActionCost,
  CharacterAction,
  CharacterData,
} from "@/lib/schemas/character";

export type { ActionCost };

export type ActionSource = "core" | "feature" | "custom";

export interface CharacterActionEntry {
  id: string;
  name: string;
  cost: ActionCost;
  description: string;
  source: ActionSource;
  sourceLabel?: string;
  uses?: { current: number; max: number };
  restReset?: CharacterData["features"][number]["restReset"];
}

export const ACTION_COST_ORDER: ActionCost[] = [
  "action",
  "bonus-action",
  "reaction",
  "movement",
  "free",
];

export const ACTION_COST_LABELS: Record<ActionCost, string> = {
  action: "Action",
  "bonus-action": "Bonus Action",
  reaction: "Reaction",
  movement: "Movement",
  free: "Free",
};

const CORE_ACTIONS: CharacterActionEntry[] = [
  {
    id: "core:dash",
    name: "Dash",
    cost: "action",
    description: "Gain extra movement equal to your speed for this turn.",
    source: "core",
    sourceLabel: "Standard",
  },
  {
    id: "core:disengage",
    name: "Disengage",
    cost: "action",
    description:
      "Your movement does not provoke opportunity attacks for the rest of this turn.",
    source: "core",
    sourceLabel: "Standard",
  },
  {
    id: "core:stabilize",
    name: "Stabilize",
    cost: "action",
    description:
      "Use an action to stabilize a creature with 0 hit points within 5 feet (DC 10 Wisdom (Medicine) check, or spend one use of a healer's kit with no check).",
    source: "core",
    sourceLabel: "Standard",
  },
  {
    id: "core:help",
    name: "Help",
    cost: "action",
    description:
      "Grant advantage on the next ability check or attack roll an ally makes against a target within 5 feet of you before your next turn.",
    source: "core",
    sourceLabel: "Standard",
  },
  {
    id: "core:use-object",
    name: "Use an Object",
    cost: "action",
    description:
      "Interact with an object on the battlefield or change one piece of equipment (draw, sheath, equip, or unequip). Your first object interaction each turn is free; use this action to interact with an additional object or make another equipment change.",
    source: "core",
    sourceLabel: "Standard",
  },
  {
    id: "core:dodge",
    name: "Dodge",
    cost: "action",
    description:
      "Until the start of your next turn, attacks against you have disadvantage if you can see the attacker, and you have advantage on Dexterity saving throws.",
    source: "core",
    sourceLabel: "Standard",
  },
  {
    id: "core:hide",
    name: "Hide",
    cost: "action",
    description:
      "Make a Dexterity (Stealth) check to hide, following the rules for hiding.",
    source: "core",
    sourceLabel: "Standard",
  },
  {
    id: "core:ready",
    name: "Ready",
    cost: "action",
    description:
      "Prepare to act using your reaction before the start of your next turn.",
    source: "core",
    sourceLabel: "Standard",
  },
  {
    id: "core:search",
    name: "Search",
    cost: "action",
    description:
      "Devote attention to finding something, such as a hidden door or trap.",
    source: "core",
    sourceLabel: "Standard",
  },
  {
    id: "core:opportunity-attack",
    name: "Opportunity Attack",
    cost: "reaction",
    description:
      "When a hostile creature you can see moves out of your reach, make one melee attack against it.",
    source: "core",
    sourceLabel: "Standard",
  },
  {
    id: "core:move",
    name: "Move",
    cost: "movement",
    description: "Move up to your speed. You can split movement before and after an action.",
    source: "core",
    sourceLabel: "Standard",
  },
  {
    id: "core:interact",
    name: "Use an Object (1st use)",
    cost: "free",
    description:
      "Interact with one object or feature of the environment for free once on your turn.",
    source: "core",
    sourceLabel: "Standard",
  },
];

const NON_COMBAT_PANEL_ACTION_IDS = new Set([
  "core:move",
  "core:dash",
  "core:interact",
  "core:opportunity-attack",
]);

/** Standard actions shown in the combat action panel (excludes movement, interact, OA). */
export function getStandardCombatActions(): CharacterActionEntry[] {
  return CORE_ACTIONS.filter((action) => !NON_COMBAT_PANEL_ACTION_IDS.has(action.id));
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** Infer action economy cost from feature description text. */
export function inferActionCost(description: string): ActionCost | null {
  const text = description.toLowerCase();

  const patterns: Array<{ cost: ActionCost; regex: RegExp }> = [
    { cost: "bonus-action", regex: /\bas a bonus action\b/ },
    { cost: "bonus-action", regex: /\bbonus action to\b/ },
    { cost: "reaction", regex: /\buse your reaction\b/ },
    { cost: "reaction", regex: /\bas a reaction\b/ },
    { cost: "reaction", regex: /\busing your reaction\b/ },
    { cost: "action", regex: /\bas an action\b/ },
    { cost: "action", regex: /\bas a action\b/ },
    { cost: "free", regex: /\bfree action\b/ },
  ];

  let earliest: { cost: ActionCost; index: number } | null = null;
  for (const { cost, regex } of patterns) {
    const match = regex.exec(text);
    if (match == null) continue;
    if (earliest == null || match.index < earliest.index) {
      earliest = { cost, index: match.index };
    }
  }

  return earliest?.cost ?? null;
}

export function resolveFeatureActionCost(feature: {
  usesAction?: boolean;
  actionCost?: ActionCost;
  description: string;
}): ActionCost | null {
  if (feature.usesAction) {
    return feature.actionCost ?? "action";
  }
  return inferActionCost(feature.description);
}

function featureToAction(
  feature: {
    id?: string;
    name: string;
    description: string;
    usesAction?: boolean;
    actionCost?: ActionCost;
    uses?: { current: number; max: number };
    restReset?: CharacterData["features"][number]["restReset"];
  },
  source: Extract<ActionSource, "feature" | "custom">,
  sourceLabel: string
): CharacterActionEntry | null {
  const cost = resolveFeatureActionCost(feature);
  if (!cost) return null;

  return {
    id: `feature:${feature.id ?? slugify(feature.name)}`,
    name: feature.name,
    cost,
    description: feature.description,
    source,
    sourceLabel,
    uses: feature.uses,
    restReset: feature.restReset,
  };
}

function deriveFeatureActions(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): CharacterActionEntry[] {
  const granted = deriveGrantedFeatures(data, catalogs);
  const custom = getCustomFeatures(data, catalogs);
  const actions: CharacterActionEntry[] = [];
  const seen = new Set<string>();

  for (const feature of granted) {
    const action = featureToAction(
      feature,
      "feature",
      featureSourceLabel(feature.source)
    );
    if (!action) continue;

    const key = `${action.cost}:${action.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push(action);
  }

  for (const feature of custom) {
    const action = featureToAction(feature, "custom", "Custom");
    if (!action) continue;

    const key = `${action.cost}:${action.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push(action);
  }

  return actions;
}

function customStoredActions(
  actions: CharacterAction[]
): CharacterActionEntry[] {
  return actions.map((action) => ({
    id: action.id,
    name: action.name,
    cost: action.cost,
    description: action.description,
    source: "custom" as const,
    sourceLabel: "Custom",
  }));
}

function addCharacterAction(
  merged: CharacterActionEntry[],
  seenKeys: Set<string>,
  seenIds: Set<string>,
  action: CharacterActionEntry,
  replaceExisting = false
) {
  if (seenIds.has(action.id)) {
    if (!replaceExisting) return;
    const index = merged.findIndex((entry) => entry.id === action.id);
    if (index >= 0) merged[index] = action;
    return;
  }

  const key = `${action.cost}:${action.name.toLowerCase()}`;
  if (seenKeys.has(key)) return;

  seenIds.add(action.id);
  seenKeys.add(key);
  merged.push(action);
}

/** Core PHB actions, feature-granted actions, and stored custom actions. */
export function getAllCharacterActions(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): CharacterActionEntry[] {
  const mechanicalActions = deriveMechanicalFeatureActions(data, catalogs);
  const featureActions = deriveFeatureActions(data, catalogs);
  const custom = customStoredActions(data.customActions ?? []);
  const seenKeys = new Set(CORE_ACTIONS.map((a) => `${a.cost}:${a.name.toLowerCase()}`));
  const seenIds = new Set(CORE_ACTIONS.map((a) => a.id));

  const nonStandard: CharacterActionEntry[] = [];

  for (const action of mechanicalActions) {
    addCharacterAction(nonStandard, seenKeys, seenIds, action, true);
  }
  for (const action of featureActions) {
    addCharacterAction(nonStandard, seenKeys, seenIds, action);
  }
  for (const action of custom) {
    addCharacterAction(nonStandard, seenKeys, seenIds, action);
  }

  return [...nonStandard, ...CORE_ACTIONS];
}

export function getActionSheetSection(action: CharacterActionEntry): ActionCost {
  if (action.id === "core:dash") return "movement";
  return action.cost;
}

function movementSectionSort(
  a: CharacterActionEntry,
  b: CharacterActionEntry
): number {
  const order = (id: string) => {
    if (id === "core:move") return 0;
    if (id === "core:dash") return 1;
    return 2;
  };
  const diff = order(a.id) - order(b.id);
  if (diff !== 0) return diff;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function groupActionsByCost(
  actions: CharacterActionEntry[]
): Map<ActionCost, CharacterActionEntry[]> {
  const grouped = new Map<ActionCost, CharacterActionEntry[]>();
  for (const cost of ACTION_COST_ORDER) {
    grouped.set(cost, []);
  }
  for (const action of actions) {
    grouped.get(action.cost)?.push(action);
  }
  return grouped;
}

/** Group actions for the character sheet Actions card (Dash appears under Movement, after Move). */
export function groupActionsBySheetSection(
  actions: CharacterActionEntry[]
): Map<ActionCost, CharacterActionEntry[]> {
  const grouped = new Map<ActionCost, CharacterActionEntry[]>();
  for (const cost of ACTION_COST_ORDER) {
    grouped.set(cost, []);
  }
  for (const action of actions) {
    grouped.get(getActionSheetSection(action))?.push(action);
  }
  grouped.get("movement")?.sort(movementSectionSort);
  return grouped;
}

export function actionSourceBadgeLabel(action: CharacterActionEntry): string {
  if (action.source === "core") return "Standard";
  return action.sourceLabel ?? (action.source === "feature" ? "Feature" : "Custom");
}
