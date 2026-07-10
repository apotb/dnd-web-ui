import type { InventoryItem, CharacterData } from "@/lib/schemas/character";
import type { Item } from "@/lib/schemas/item";
import { isCostlySpellMaterialItem } from "@/lib/schemas/item";
import { parseSpellComponentLetters, getSpellMaterialNotice } from "@/lib/dnd/spell-glossary";
import {
  expandMaterialItemSlugs,
  getSpellMaterialSpec,
  type SpellMaterialChoiceGroup,
  type SpellMaterialSpec,
} from "@/lib/dnd/spell-material-requirements";
import { resolveCanonicalItemSlug } from "@/lib/items/slug-aliases";

const FOCUS_ITEM_SLUGS = new Set([
  "component-pouch",
  "arcane-focus",
  "druidic-focus",
  "holy-symbol",
]);

export interface MaterialStackOption {
  inventoryItemId: string;
  itemSlug: string;
  itemName: string;
  quantityAvailable: number;
  quantityRequired: number;
}

export interface MaterialGroupAvailability {
  groupIndex: number;
  label: string;
  consumed: boolean;
  costly: boolean;
  options: MaterialStackOption[];
}

export interface SpellMaterialCastChoice {
  groupIndex: number;
  itemSlug: string;
  inventoryItemId: string;
  itemName: string;
  quantity: number;
  consumed: boolean;
}

export interface SpellMaterialCastPlan {
  materialChoices: SpellMaterialCastChoice[];
  materialSatisfiedByFocus: boolean;
}

export interface SpellMaterialEligibility {
  canCast: boolean;
  satisfiedByFocus: boolean;
  groups: MaterialGroupAvailability[];
  reason?: string;
}

function getCatalogItem(catalogItems: Record<string, Item>, slug: string): Item | null {
  return catalogItems[slug] ?? null;
}

function resolveInventoryItemName(
  invItem: InventoryItem,
  catalogItems: Record<string, Item>
): string {
  if (invItem.name.trim()) return invItem.name.trim();
  if (invItem.itemId) {
    return catalogItems[invItem.itemId]?.name ?? invItem.itemId;
  }
  return "Item";
}

function inventoryMatchesSlug(
  invItem: InventoryItem,
  slug: string,
  catalogItems: Record<string, Item>
): boolean {
  const canonical = resolveCanonicalItemSlug(slug);
  const candidates = expandMaterialItemSlugs(canonical);
  if (invItem.itemId) {
    const resolved = resolveCanonicalItemSlug(invItem.itemId);
    if (candidates.includes(resolved) || candidates.includes(invItem.itemId)) return true;
  }
  const name = invItem.name.trim().toLowerCase();
  if (!name) return false;
  return candidates.some((candidate) => {
    const catalog = catalogItems[candidate];
    return catalog?.name.trim().toLowerCase() === name;
  });
}

export function findMaterialStacks(
  inventory: InventoryItem[],
  itemSlug: string,
  catalogItems: Record<string, Item>,
  quantityRequired = 1
): MaterialStackOption[] {
  const options: MaterialStackOption[] = [];
  for (const invItem of inventory) {
    if (!inventoryMatchesSlug(invItem, itemSlug, catalogItems)) continue;
    if (invItem.quantity < quantityRequired) continue;
    options.push({
      inventoryItemId: invItem.id,
      itemSlug: invItem.itemId ?? itemSlug,
      itemName: resolveInventoryItemName(invItem, catalogItems),
      quantityAvailable: invItem.quantity,
      quantityRequired,
    });
  }
  return options;
}

export function characterHasSpellcastingFocus(
  inventory: InventoryItem[],
  catalogItems: Record<string, Item>
): boolean {
  return inventory.some((invItem) => {
    if (invItem.quantity <= 0) return false;
    if (invItem.itemId) {
      const resolved = resolveCanonicalItemSlug(invItem.itemId);
      if (FOCUS_ITEM_SLUGS.has(resolved)) return true;
    }
    const catalog = invItem.itemId
      ? catalogItems[resolveCanonicalItemSlug(invItem.itemId)]
      : null;
    return catalog?.category === "focus";
  });
}

function isGroupCostly(
  group: SpellMaterialChoiceGroup,
  catalogItems: Record<string, Item>
): boolean {
  return group.alternatives.some((alt) => {
    const slugs = expandMaterialItemSlugs(alt.itemSlug);
    return slugs.some((slug) => {
      const item = getCatalogItem(catalogItems, slug);
      return item != null && isCostlySpellMaterialItem(item);
    });
  });
}

function canWaiveSpecWithFocus(
  spec: SpellMaterialSpec,
  catalogItems: Record<string, Item>
): boolean {
  if (!spec.focusWaivable) return false;
  if (spec.choiceGroups.length === 0) return true;
  return spec.choiceGroups.every((group) => !isGroupCostly(group, catalogItems));
}

function resolveUnmappedEligibility(
  components: string,
  inventory: InventoryItem[],
  catalogItems: Record<string, Item>
): SpellMaterialEligibility {
  const letters = parseSpellComponentLetters(components);
  if (!letters.includes("M")) {
    return { canCast: true, satisfiedByFocus: false, groups: [] };
  }

  const notice = getSpellMaterialNotice(components);
  if (!notice) {
    return {
      canCast: characterHasSpellcastingFocus(inventory, catalogItems),
      satisfiedByFocus: characterHasSpellcastingFocus(inventory, catalogItems),
      groups: [],
      reason: characterHasSpellcastingFocus(inventory, catalogItems)
        ? undefined
        : "Requires a spellcasting focus or component pouch.",
    };
  }

  if (notice.costly) {
    return {
      canCast: false,
      satisfiedByFocus: false,
      groups: [],
      reason: "Missing costly spell material item in catalog mapping.",
    };
  }

  const hasFocus = characterHasSpellcastingFocus(inventory, catalogItems);
  return {
    canCast: hasFocus,
    satisfiedByFocus: hasFocus,
    groups: [],
    reason: hasFocus ? undefined : "Requires a spellcasting focus or component pouch.",
  };
}

export function resolveMaterialAvailability(
  inventory: InventoryItem[],
  spec: SpellMaterialSpec,
  catalogItems: Record<string, Item>
): MaterialGroupAvailability[] {
  return spec.choiceGroups.map((group, groupIndex) => {
    const options: MaterialStackOption[] = [];
    for (const alt of group.alternatives) {
      const quantity = alt.quantity ?? 1;
      options.push(
        ...findMaterialStacks(inventory, alt.itemSlug, catalogItems, quantity)
      );
    }
    const unique = new Map<string, MaterialStackOption>();
    for (const option of options) {
      unique.set(`${option.inventoryItemId}:${option.itemSlug}`, option);
    }
    return {
      groupIndex,
      label: group.label,
      consumed: group.consumed,
      costly: isGroupCostly(group, catalogItems),
      options: [...unique.values()],
    };
  });
}

export function resolveSpellMaterialEligibility(
  inventory: InventoryItem[],
  spellSlug: string,
  catalogItems: Record<string, Item>,
  components?: string
): SpellMaterialEligibility {
  const spec = getSpellMaterialSpec(spellSlug);
  if (!spec) {
    return resolveUnmappedEligibility(components ?? "", inventory, catalogItems);
  }

  const hasFocus = characterHasSpellcastingFocus(inventory, catalogItems);
  if (spec.choiceGroups.length === 0) {
    const canCast = spec.focusWaivable ? hasFocus : true;
    return {
      canCast,
      satisfiedByFocus: spec.focusWaivable && hasFocus,
      groups: [],
      reason: canCast ? undefined : "Requires a spellcasting focus or component pouch.",
    };
  }

  const groups = resolveMaterialAvailability(inventory, spec, catalogItems);
  const canWaive = canWaiveSpecWithFocus(spec, catalogItems) && hasFocus;
  if (canWaive) {
    return { canCast: true, satisfiedByFocus: true, groups };
  }

  const allGroupsSatisfied = groups.every((group) => group.options.length > 0);
  return {
    canCast: allGroupsSatisfied,
    satisfiedByFocus: false,
    groups,
    reason: allGroupsSatisfied
      ? undefined
      : "Missing required spell material components in inventory.",
  };
}

export function buildMaterialCastPlan(
  inventory: InventoryItem[],
  spellSlug: string,
  catalogItems: Record<string, Item>,
  selections: Array<{ groupIndex: number; inventoryItemId: string }>,
  components?: string
): { plan: SpellMaterialCastPlan | null; error?: string } {
  const eligibility = resolveSpellMaterialEligibility(
    inventory,
    spellSlug,
    catalogItems,
    components
  );

  if (eligibility.satisfiedByFocus) {
    return {
      plan: {
        materialChoices: [],
        materialSatisfiedByFocus: true,
      },
    };
  }

  if (!eligibility.canCast) {
    return { plan: null, error: eligibility.reason ?? "Cannot cast spell." };
  }

  const spec = getSpellMaterialSpec(spellSlug);
  if (!spec || spec.choiceGroups.length === 0) {
    return {
      plan: {
        materialChoices: [],
        materialSatisfiedByFocus: false,
      },
    };
  }

  const choices: SpellMaterialCastChoice[] = [];
  for (let groupIndex = 0; groupIndex < spec.choiceGroups.length; groupIndex += 1) {
    const group = spec.choiceGroups[groupIndex]!;
    const selection = selections.find((entry) => entry.groupIndex === groupIndex);
    if (!selection) {
      return { plan: null, error: `Choose a material for: ${group.label}.` };
    }

    const groupAvailability = eligibility.groups.find(
      (entry) => entry.groupIndex === groupIndex
    );
    const option = groupAvailability?.options.find(
      (entry) => entry.inventoryItemId === selection.inventoryItemId
    );
    if (!option) {
      return { plan: null, error: `Invalid material selection for: ${group.label}.` };
    }

    choices.push({
      groupIndex,
      itemSlug: option.itemSlug,
      inventoryItemId: option.inventoryItemId,
      itemName: option.itemName,
      quantity: option.quantityRequired,
      consumed: group.consumed,
    });
  }

  return {
    plan: {
      materialChoices: choices,
      materialSatisfiedByFocus: false,
    },
  };
}

export function autoResolveMaterialSelections(
  inventory: InventoryItem[],
  spellSlug: string,
  catalogItems: Record<string, Item>,
  components?: string
): { selections: Array<{ groupIndex: number; inventoryItemId: string }>; error?: string } {
  const eligibility = resolveSpellMaterialEligibility(
    inventory,
    spellSlug,
    catalogItems,
    components
  );
  if (eligibility.satisfiedByFocus) {
    return { selections: [] };
  }
  if (!eligibility.canCast) {
    return { selections: [], error: eligibility.reason ?? "Cannot cast spell." };
  }
  const selections: Array<{ groupIndex: number; inventoryItemId: string }> = [];
  for (const group of eligibility.groups) {
    if (group.options.length === 0) {
      return { selections: [], error: `Missing material for: ${group.label}.` };
    }
    if (group.options.length > 1) {
      return {
        selections: [],
        error: `Choose a material for: ${group.label}.`,
      };
    }
    selections.push({
      groupIndex: group.groupIndex,
      inventoryItemId: group.options[0]!.inventoryItemId,
    });
  }
  return { selections };
}

export function consumeSpellMaterials(
  inventory: InventoryItem[],
  choices: SpellMaterialCastChoice[]
): InventoryItem[] {
  if (choices.length === 0) return inventory;

  const toConsume = choices.filter((choice) => choice.consumed);
  if (toConsume.length === 0) return inventory;

  return inventory
    .map((invItem) => {
      const consumption = toConsume.find(
        (choice) => choice.inventoryItemId === invItem.id
      );
      if (!consumption) return invItem;
      return {
        ...invItem,
        quantity: Math.max(0, invItem.quantity - consumption.quantity),
      };
    })
    .filter((invItem) => invItem.quantity > 0 || !invItem.itemId);
}

export function formatSpellMaterialConsumptionSummary(
  plan: SpellMaterialCastPlan | null | undefined
): string | null {
  if (!plan) return null;
  if (plan.materialSatisfiedByFocus) {
    return "Materials satisfied by spellcasting focus or component pouch.";
  }
  const consumed = plan.materialChoices.filter((choice) => choice.consumed);
  if (consumed.length === 0) return null;
  return `Consumes: ${consumed
    .map((choice) => `${choice.itemName}${choice.quantity > 1 ? ` ×${choice.quantity}` : ""}`)
    .join(", ")}`;
}

export function characterCanCastSpellMaterials(
  character: CharacterData,
  spellSlug: string,
  catalogItems: Record<string, Item>,
  components?: string
): boolean {
  return resolveSpellMaterialEligibility(
    character.inventory.items,
    spellSlug,
    catalogItems,
    components
  ).canCast;
}
