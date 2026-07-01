"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTION_COST_LABELS,
  ACTION_COST_ORDER,
} from "@/lib/dnd/character-actions";
import type { CatalogFeatureEntry, CatalogFeatureMechanics, MaxFormula } from "@/lib/dnd/catalog-feature-mechanics";
import type { ActionCost } from "@/lib/schemas/character";

const MECHANICS_KINDS = [
  { value: "none", label: "None (display only)", shortLabel: "Display only" },
  { value: "action-only", label: "Action only (combat button)", shortLabel: "Action only" },
  { value: "uses", label: "Uses counter (limited per rest)", shortLabel: "Uses counter" },
  { value: "hp-pool", label: "HP pool (touch heal in combat)", shortLabel: "HP pool" },
] as const;

function mechanicsKindLabel(kind: string, short = false): string {
  const match = MECHANICS_KINDS.find((option) => option.value === kind);
  if (!match) return short ? "Display only" : "None (display only)";
  return short ? match.shortLabel : match.label;
}

const MAX_FORMULAS = [
  { value: "5 * level", label: "5 × level" },
  { value: "level", label: "Level" },
  { value: "chaMod", label: "Charisma modifier (min 1)" },
] as const;

function blankFeature(): CatalogFeatureEntry {
  return { name: "", description: "", slug: "" };
}

export function CatalogFeaturesEditor({
  label,
  features,
  onChange,
}: {
  label: string;
  features: CatalogFeatureEntry[];
  onChange: (features: CatalogFeatureEntry[]) => void;
}) {
  function updateFeature(index: number, patch: Partial<CatalogFeatureEntry>) {
    const next = [...features];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function updateMechanicsKind(
    index: number,
    kind: (typeof MECHANICS_KINDS)[number]["value"]
  ) {
    if (kind === "none") {
      updateFeature(index, { mechanics: undefined });
      return;
    }
    if (kind === "action-only") {
      updateFeature(index, {
        mechanics: { kind: "action-only", actionCost: "action" },
      });
      return;
    }
    if (kind === "uses") {
      updateFeature(index, {
        mechanics: {
          kind: "uses",
          max: 1,
          restReset: "long",
          usesAction: false,
          actionCost: "action",
        },
      });
      return;
    }
    updateFeature(index, {
      mechanics: {
        kind: "hp-pool",
        restReset: "long",
        maxFormula: "5 * level",
        usesAction: true,
        actionCost: "action",
        heal: { touchRangeFt: 5, targets: "allies-and-self" },
        cure: { cost: 5, conditions: ["poisoned"] },
      },
    });
  }

  function setMechanics(index: number, mechanics: CatalogFeatureMechanics) {
    updateFeature(index, { mechanics });
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-semibold">{label}</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...features, blankFeature()])}
        >
          Add feature
        </Button>
      </div>
      {features.length === 0 ? (
        <p className="text-xs text-muted-foreground">No features configured.</p>
      ) : null}
      {features.map((feature, index) => {
        const mechanicsKind = feature.mechanics?.kind ?? "none";
        return (
          <div key={index} className="space-y-2 rounded-md border border-dashed p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                placeholder="Name"
                value={feature.name}
                onChange={(e) => updateFeature(index, { name: e.target.value })}
              />
              <Input
                placeholder="Slug (optional)"
                value={feature.slug ?? ""}
                onChange={(e) => updateFeature(index, { slug: e.target.value })}
              />
            </div>
            <Textarea
              placeholder="Description"
              rows={2}
              value={feature.description}
              onChange={(e) => updateFeature(index, { description: e.target.value })}
            />
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Mechanics template</Label>
                <p className="text-xs text-muted-foreground">
                  Controls whether this feature is display-only or gets counters, pools, and combat actions.
                </p>
                <Select
                  value={mechanicsKind}
                  onValueChange={(value) =>
                    updateMechanicsKind(
                      index,
                      value as (typeof MECHANICS_KINDS)[number]["value"]
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{mechanicsKindLabel(mechanicsKind, true)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="min-w-[18rem]">
                    {MECHANICS_KINDS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {feature.mechanics && feature.mechanics.kind !== "action-only" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Rest reset</Label>
                  <Select
                    value={feature.mechanics.restReset ?? "long"}
                    onValueChange={(value) => {
                      const mechanics = feature.mechanics;
                      if (!mechanics || mechanics.kind === "action-only") return;
                      const restReset = value as "short" | "long" | "none";
                      if (mechanics.kind === "uses") {
                        setMechanics(index, { ...mechanics, restReset });
                      } else {
                        setMechanics(index, { ...mechanics, restReset });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="min-w-[12rem]">
                      <SelectItem value="long">Long rest</SelectItem>
                      <SelectItem value="short">Short rest</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            {feature.mechanics?.kind === "uses" ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Max uses</Label>
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    value={feature.mechanics.max === "chaMod" ? "" : feature.mechanics.max}
                    placeholder="Count"
                    onChange={(e) => {
                      const max = parseInt(e.target.value, 10);
                      const mechanics = feature.mechanics;
                      if (mechanics?.kind !== "uses") return;
                      setMechanics(index, {
                        ...mechanics,
                        max: Number.isFinite(max) ? max : 1,
                      });
                    }}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={feature.mechanics.usesAction ?? false}
                    onCheckedChange={(checked) => {
                      const mechanics = feature.mechanics;
                      if (mechanics?.kind !== "uses") return;
                      setMechanics(index, {
                        ...mechanics,
                        usesAction: checked === true,
                      });
                    }}
                  />
                  Uses action economy
                </label>
              </div>
            ) : null}
            {feature.mechanics?.kind === "hp-pool" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Pool max formula</Label>
                  <Select
                    value={String(feature.mechanics.maxFormula ?? "5 * level")}
                    onValueChange={(value) => {
                      if (!value) return;
                      const mechanics = feature.mechanics;
                      if (mechanics?.kind !== "hp-pool") return;
                      let maxFormula: MaxFormula;
                      if (value === "chaMod" || value === "level" || value === "5 * level") {
                        maxFormula = value;
                      } else {
                        maxFormula = Number.parseInt(value, 10) || 0;
                      }
                      setMechanics(index, { ...mechanics, maxFormula });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="min-w-[14rem]">
                      {MAX_FORMULAS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cure cost (0 = no cure)</Label>
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    value={feature.mechanics.cure?.cost ?? 0}
                    onChange={(e) => {
                      const cost = parseInt(e.target.value, 10) || 0;
                      const mechanics = feature.mechanics;
                      if (mechanics?.kind !== "hp-pool") return;
                      setMechanics(index, {
                        ...mechanics,
                        cure:
                          cost > 0
                            ? {
                                cost,
                                conditions: mechanics.cure?.conditions ?? ["poisoned"],
                              }
                            : undefined,
                      });
                    }}
                  />
                </div>
              </div>
            ) : null}
            {(feature.mechanics?.kind === "uses" && feature.mechanics.usesAction) ||
            feature.mechanics?.kind === "action-only" ||
            feature.mechanics?.kind === "hp-pool" ? (
              <div className="space-y-1">
                <Label className="text-xs">Action cost</Label>
                <Select
                  value={
                    feature.mechanics.kind === "action-only"
                      ? feature.mechanics.actionCost
                      : feature.mechanics.actionCost ?? "action"
                  }
                  onValueChange={(value) => {
                    const mechanics = feature.mechanics;
                    if (!mechanics) return;
                    if (mechanics.kind === "action-only") {
                      setMechanics(index, {
                        ...mechanics,
                        actionCost: value as ActionCost,
                      });
                    } else if (mechanics.kind === "uses") {
                      setMechanics(index, {
                        ...mechanics,
                        actionCost: value as ActionCost,
                      });
                    } else if (mechanics.kind === "hp-pool") {
                      setMechanics(index, {
                        ...mechanics,
                        actionCost: value as ActionCost,
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_COST_ORDER.filter((cost) => cost !== "movement").map((cost) => (
                      <SelectItem key={cost} value={cost}>
                        {ACTION_COST_LABELS[cost]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => onChange(features.filter((_, i) => i !== index))}
            >
              Remove feature
            </Button>
          </div>
        );
      })}
    </div>
  );
}
