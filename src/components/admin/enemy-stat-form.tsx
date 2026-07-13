"use client";

import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveCombatImageUrl } from "@/lib/combat/storage";
import {
  formatAbilityScore,
  type EnemyData,
  type EnemyNamedBlock,
} from "@/lib/schemas/enemy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;

function emptyBlock(): EnemyNamedBlock {
  return { name: "", description: "" };
}

export interface EnemyStatFormProps {
  form: EnemyData;
  onChange: (next: EnemyData) => void;
  portraitFile: File | null;
  onPortraitFileChange: (file: File | null) => void;
  /** When set, portrait uploads use this slug for storage paths. */
  portraitSlug?: string;
  showSizeType?: boolean;
}

export function EnemyStatForm({
  form,
  onChange,
  portraitFile,
  onPortraitFileChange,
  showSizeType = true,
}: EnemyStatFormProps) {
  const supabase = useMemo(() => createClient(), []);

  const previewPortrait = useMemo(() => {
    if (portraitFile) return URL.createObjectURL(portraitFile);
    if (!form.portraitPath) return null;
    return resolveCombatImageUrl(supabase, form.portraitPath);
  }, [form.portraitPath, portraitFile, supabase]);

  function updateBlockList(
    key: "traits" | "actions",
    index: number,
    patch: Partial<EnemyNamedBlock>
  ) {
    onChange({
      ...form,
      [key]: form[key].map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    });
  }

  function addBlock(key: "traits" | "actions") {
    onChange({ ...form, [key]: [...form[key], emptyBlock()] });
  }

  function removeBlock(key: "traits" | "actions", index: number) {
    onChange({ ...form, [key]: form[key].filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          {showSizeType ? (
            <div className="space-y-1.5">
              <Label htmlFor="enemy-size-type">Size / type / alignment</Label>
              <Input
                id="enemy-size-type"
                value={form.sizeType}
                onChange={(event) => onChange({ ...form, sizeType: event.target.value })}
              />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="enemy-ac">Armor class</Label>
              <Input
                id="enemy-ac"
                type="number"
                value={form.armorClass.value}
                onChange={(event) =>
                  onChange({
                    ...form,
                    armorClass: { ...form.armorClass, value: Number(event.target.value) || 0 },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enemy-ac-note">AC note</Label>
              <Input
                id="enemy-ac-note"
                value={form.armorClass.note}
                onChange={(event) =>
                  onChange({
                    ...form,
                    armorClass: { ...form.armorClass, note: event.target.value },
                  })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="enemy-hp">Hit points</Label>
              <Input
                id="enemy-hp"
                type="number"
                value={form.hitPoints.average}
                onChange={(event) =>
                  onChange({
                    ...form,
                    hitPoints: { ...form.hitPoints, average: Number(event.target.value) || 0 },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enemy-hp-formula">HP formula</Label>
              <Input
                id="enemy-hp-formula"
                value={form.hitPoints.formula}
                onChange={(event) =>
                  onChange({
                    ...form,
                    hitPoints: { ...form.hitPoints, formula: event.target.value },
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="enemy-speed">Speed</Label>
            <Input
              id="enemy-speed"
              value={form.speed}
              onChange={(event) => onChange({ ...form, speed: event.target.value })}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Portrait</Label>
            {previewPortrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewPortrait}
                alt=""
                className="portrait-cover-top mb-2 h-32 w-32 rounded-lg"
              />
            ) : null}
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => onPortraitFileChange(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ability scores</Label>
            <div className="grid grid-cols-3 gap-2">
              {ABILITIES.map((key) => (
                <div key={key}>
                  <Label htmlFor={`enemy-${key}`} className="uppercase text-xs">
                    {key}
                  </Label>
                  <Input
                    id={`enemy-${key}`}
                    type="number"
                    value={form.abilityScores[key] ?? 10}
                    onChange={(event) =>
                      onChange({
                        ...form,
                        abilityScores: {
                          ...form.abilityScores,
                          [key]: Number(event.target.value) || 10,
                        },
                      })
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    {formatAbilityScore(form.abilityScores[key] ?? 10)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="enemy-cr">Challenge rating</Label>
              <Input
                id="enemy-cr"
                value={form.challengeRating}
                onChange={(event) =>
                  onChange({ ...form, challengeRating: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enemy-xp">XP</Label>
              <Input
                id="enemy-xp"
                type="number"
                value={form.xp}
                onChange={(event) =>
                  onChange({ ...form, xp: Number(event.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enemy-pb">Proficiency</Label>
              <Input
                id="enemy-pb"
                type="number"
                value={form.proficiencyBonus}
                onChange={(event) =>
                  onChange({
                    ...form,
                    proficiencyBonus: Number(event.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="enemy-skills">Skills</Label>
          <Input
            id="enemy-skills"
            placeholder="Intimidation +2"
            value={form.skills.map((skill) => `${skill.name} +${skill.bonus}`).join(", ")}
            onChange={(event) => {
              const skills = event.target.value
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean)
                .map((part) => {
                  const match = part.match(/^(.+?)\s*([+-]\d+)$/);
                  if (!match) return { name: part, bonus: 0 };
                  return {
                    name: match[1].trim(),
                    bonus: Number(match[2]) || 0,
                  };
                });
              onChange({ ...form, skills });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="enemy-senses">Senses</Label>
          <Input
            id="enemy-senses"
            value={form.senses}
            onChange={(event) => onChange({ ...form, senses: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="enemy-languages">Languages</Label>
          <Input
            id="enemy-languages"
            value={form.languages}
            onChange={(event) => onChange({ ...form, languages: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="enemy-habitat">Habitat</Label>
          <Input
            id="enemy-habitat"
            value={form.habitat}
            onChange={(event) => onChange({ ...form, habitat: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="enemy-tags">Tags (comma-separated)</Label>
          <Input
            id="enemy-tags"
            value={form.tags.join(", ")}
            onChange={(event) =>
              onChange({
                ...form,
                tags: event.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="enemy-description">Description</Label>
        <Textarea
          id="enemy-description"
          rows={3}
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
        />
      </div>

      {(["traits", "actions"] as const).map((section) => (
        <div key={section}>
          <div className="mb-2 flex items-center justify-between">
            <Label className="capitalize">{section}</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => addBlock(section)}>
              Add {section.slice(0, -1)}
            </Button>
          </div>
          <div className="space-y-3">
            {form[section].map((block, index) => (
              <div key={`${section}-${index}`} className="rounded border p-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Name"
                    value={block.name}
                    onChange={(event) =>
                      updateBlockList(section, index, { name: event.target.value })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBlock(section, index)}
                  >
                    Remove
                  </Button>
                </div>
                <Textarea
                  placeholder="Description"
                  rows={3}
                  value={block.description}
                  onChange={(event) =>
                    updateBlockList(section, index, { description: event.target.value })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
