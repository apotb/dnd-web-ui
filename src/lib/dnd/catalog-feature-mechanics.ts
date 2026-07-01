import { z } from "zod";
import { actionCostSchema, restResetTypeSchema } from "@/lib/schemas/character";
import type { ActionCost, CharacterData, Feature } from "@/lib/schemas/character";
import { abilityModifier } from "@/lib/dnd/calculations";

export interface MechanicsFormulaContext {
  level: number;
  data: CharacterData;
}

export const maxFormulaSchema = z.union([
  z.literal("5 * level"),
  z.literal("level"),
  z.literal("chaMod"),
  z.number().int().min(0),
]);

export type MaxFormula = z.infer<typeof maxFormulaSchema>;

export const catalogUsesMechanicsSchema = z.object({
  kind: z.literal("uses"),
  restReset: restResetTypeSchema.default("long"),
  max: z.union([z.number().int().min(0), z.literal("chaMod")]).default(1),
  usesAction: z.boolean().optional(),
  actionCost: actionCostSchema.optional(),
});

export const catalogHpPoolMechanicsSchema = z.object({
  kind: z.literal("hp-pool"),
  restReset: restResetTypeSchema.default("long"),
  maxFormula: maxFormulaSchema.default("5 * level"),
  usesAction: z.boolean().default(true),
  actionCost: actionCostSchema.default("action"),
  heal: z
    .object({
      touchRangeFt: z.number().int().min(0).default(5),
      targets: z.enum(["allies-and-self"]).default("allies-and-self"),
    })
    .optional(),
  cure: z
    .object({
      cost: z.number().int().min(1).default(5),
      conditions: z.array(z.string()).default(["poisoned"]),
    })
    .optional(),
});

export const catalogActionOnlyMechanicsSchema = z.object({
  kind: z.literal("action-only"),
  actionCost: actionCostSchema.default("action"),
});

export const catalogFeatureMechanicsSchema = z.discriminatedUnion("kind", [
  catalogUsesMechanicsSchema,
  catalogHpPoolMechanicsSchema,
  catalogActionOnlyMechanicsSchema,
]);

export type CatalogFeatureMechanics = z.infer<typeof catalogFeatureMechanicsSchema>;

export const catalogFeatureEntrySchema = z.object({
  name: z.string(),
  description: z.string(),
  slug: z.string().optional(),
  mechanics: catalogFeatureMechanicsSchema.optional(),
});

export type CatalogFeatureEntry = z.infer<typeof catalogFeatureEntrySchema>;

export type ResolvedMechanicsKind =
  | "uses"
  | "hp-pool"
  | "action-only"
  | "short-rest-slots"
  | "short-rest-heal";

export interface ResolvedHpPoolConfig {
  cureCost: number;
  cureConditions: string[];
  touchRangeFt: number;
}

export interface ResolvedMechanicalFeature {
  id: string;
  kind: ResolvedMechanicsKind;
  restReset: Feature["restReset"];
  maxValue: (ctx: MechanicsFormulaContext) => number;
  usesAction: boolean;
  actionCost: ActionCost;
  actionName: string;
  actionDescription: string;
  hpPool?: ResolvedHpPoolConfig;
  source: "catalog" | "code";
}

export function slugifyFeatureName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function catalogFeatureId(
  source: string,
  entry: Pick<CatalogFeatureEntry, "name" | "slug">
): string {
  const slug = entry.slug?.trim() || slugifyFeatureName(entry.name);
  return `granted:${source}:${slug}`;
}

export function parseCatalogFeatureEntry(raw: unknown): CatalogFeatureEntry | null {
  const parsed = catalogFeatureEntrySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseCatalogFeatureMechanics(raw: unknown): CatalogFeatureMechanics | null {
  const parsed = catalogFeatureMechanicsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function evaluateMaxFormula(
  formula: MaxFormula,
  ctx: MechanicsFormulaContext
): number {
  if (typeof formula === "number") return formula;
  switch (formula) {
    case "5 * level":
      return 5 * ctx.level;
    case "level":
      return ctx.level;
    case "chaMod":
      return Math.max(1, abilityModifier(ctx.data.abilityScores.cha));
    default:
      return 0;
  }
}

export function evaluateUsesMax(
  max: number | "chaMod",
  ctx: MechanicsFormulaContext
): number {
  if (max === "chaMod") {
    return Math.max(1, abilityModifier(ctx.data.abilityScores.cha));
  }
  return max;
}

export function resolveMechanicsFromCatalog(
  featureId: string,
  entry: CatalogFeatureEntry,
  mechanics: CatalogFeatureMechanics
): ResolvedMechanicalFeature {
  if (mechanics.kind === "uses") {
    return {
      id: featureId,
      source: "catalog",
      actionName: entry.name,
      actionDescription: entry.description,
      kind: "uses",
      restReset: mechanics.restReset,
      usesAction: mechanics.usesAction ?? false,
      actionCost: mechanics.actionCost ?? "action",
      maxValue: (ctx) => evaluateUsesMax(mechanics.max, ctx),
    };
  }

  if (mechanics.kind === "action-only") {
    return {
      id: featureId,
      source: "catalog",
      actionName: entry.name,
      actionDescription: entry.description,
      kind: "action-only",
      restReset: "none",
      usesAction: true,
      actionCost: mechanics.actionCost,
      maxValue: () => 0,
    };
  }

  const cure = mechanics.cure;
  return {
    id: featureId,
    source: "catalog",
    actionName: entry.name,
    actionDescription: entry.description,
    kind: "hp-pool",
    restReset: mechanics.restReset,
    usesAction: mechanics.usesAction ?? true,
    actionCost: mechanics.actionCost ?? "action",
    maxValue: (ctx) => evaluateMaxFormula(mechanics.maxFormula, ctx),
    hpPool: {
      cureCost: cure?.cost ?? 0,
      cureConditions: cure?.conditions ?? [],
      touchRangeFt: mechanics.heal?.touchRangeFt ?? 5,
    },
  };
}

export function featureActionId(featureId: string): string {
  return `feature:${featureId}`;
}

export function isHpPoolFeatureAction(actionId: string): boolean {
  return actionId.startsWith("feature:granted:");
}

export function featureIdFromActionId(actionId: string): string | null {
  if (!actionId.startsWith("feature:")) return null;
  return actionId.slice("feature:".length);
}
