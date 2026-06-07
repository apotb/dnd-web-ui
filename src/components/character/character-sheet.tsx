"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CharacterData, AbilityKey, SkillKey } from "@/lib/schemas/character";
import {
  ABILITY_FULL_LABELS,
  ABILITY_LABELS,
  SKILL_ABILITY_MAP,
  SKILL_LABELS,
  abilityModifier,
  formatModifier,
  getAbilityModifiers,
  getPassivePerception,
  getProficiencyBonus,
  getSavingThrowTotal,
  getSkillTotal,
  getSpellAttackBonus,
  getSpellSaveDc,
} from "@/lib/dnd/calculations";

interface CharacterSheetProps {
  data: CharacterData;
  isDm: boolean;
  editable?: boolean;
  onChange?: (data: CharacterData) => void;
}

function Field({
  label,
  value,
  editable,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  editable?: boolean;
  onChange?: (v: string) => void;
  type?: "text" | "number";
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editable && onChange ? (
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <p className="text-sm font-medium">{value || "—"}</p>
      )}
    </div>
  );
}

export function CharacterSheet({
  data,
  isDm,
  editable = false,
  onChange,
}: CharacterSheetProps) {
  const update = (patch: Partial<CharacterData>) => {
    onChange?.({ ...data, ...patch });
  };

  const updateBasic = (patch: Partial<CharacterData["basicInfo"]>) => {
    update({ basicInfo: { ...data.basicInfo, ...patch } });
  };

  const updateAbility = (key: AbilityKey, value: number) => {
    update({
      abilityScores: { ...data.abilityScores, [key]: value },
    });
  };

  const updateCombat = (patch: Partial<CharacterData["combat"]>) => {
    update({ combat: { ...data.combat, ...patch } });
  };

  const mods = getAbilityModifiers(data.abilityScores);
  const profBonus = getProficiencyBonus(data);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {data.basicInfo.name || "Unnamed Character"}
          </h1>
          <p className="text-muted-foreground">
            Level {data.basicInfo.level}
            {(data.basicInfo.classes.length > 0 || data.basicInfo.class) && (
              <>
                {" "}
                ·{" "}
                {data.basicInfo.classes.length > 0
                  ? data.basicInfo.classes.join(" / ")
                  : data.basicInfo.class}
              </>
            )}
            {data.basicInfo.playerName && (
              <> · Player: {data.basicInfo.playerName}</>
            )}
          </p>
        </div>
        <Badge variant="outline">Proficiency {formatModifier(profBonus)}</Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="abilities">Abilities/Skills</TabsTrigger>
          <TabsTrigger value="combat">Combat</TabsTrigger>
          <TabsTrigger value="attacks">Attacks/Spells</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Species"
              value={data.basicInfo.species}
              editable={editable}
              onChange={(v) => updateBasic({ species: v })}
            />
            <Field
              label="Background"
              value={data.basicInfo.background}
              editable={editable}
              onChange={(v) => updateBasic({ background: v })}
            />
            <Field
              label="Alignment"
              value={data.basicInfo.alignment}
              editable={editable}
              onChange={(v) => updateBasic({ alignment: v })}
            />
            <Field
              label="Subclass"
              value={data.basicInfo.subclass}
              editable={editable}
              onChange={(v) => updateBasic({ subclass: v })}
            />
            <Field
              label="Level"
              value={data.basicInfo.level}
              editable={editable}
              type="number"
              onChange={(v) => updateBasic({ level: parseInt(v) || 1 })}
            />
            <Field
              label="Portrait URL"
              value={data.basicInfo.portrait}
              editable={editable}
              onChange={(v) => updateBasic({ portrait: v })}
            />
          </div>
          {data.basicInfo.portrait && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.basicInfo.portrait}
              alt={data.basicInfo.name}
              className="max-h-48 rounded-md border object-cover"
            />
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="AC" value={data.combat.ac} />
              <Stat
                label="HP"
                value={`${data.combat.currentHp}/${data.combat.maxHp}`}
              />
              <Stat label="Speed" value={`${data.combat.speed} ft`} />
              <Stat
                label="Passive Perception"
                value={getPassivePerception(data)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="abilities" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(ABILITY_LABELS) as AbilityKey[]).map((key) => (
              <Card key={key}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {ABILITY_FULL_LABELS[key]}
                    </p>
                    {editable ? (
                      <Input
                        type="number"
                        className="mt-1 w-20"
                        value={data.abilityScores[key]}
                        onChange={(e) =>
                          updateAbility(key, parseInt(e.target.value) || 10)
                        }
                      />
                    ) : (
                      <p className="text-2xl font-bold">
                        {data.abilityScores[key]}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Mod</p>
                    <p className="text-xl font-semibold">
                      {formatModifier(mods[key])}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Checkbox
                        checked={data.savingThrows[key]?.proficient ?? false}
                        disabled={!editable}
                        onCheckedChange={(checked) =>
                          update({
                            savingThrows: {
                              ...data.savingThrows,
                              [key]: { proficient: !!checked },
                            },
                          })
                        }
                      />
                      <span className="text-xs">
                        Save {formatModifier(getSavingThrowTotal(data, key))}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Skills</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(Object.keys(SKILL_LABELS) as SkillKey[]).map((skill) => {
                const skillData = data.skills[skill] ?? {
                  proficient: false,
                  expertise: false,
                };
                return (
                  <div
                    key={skill}
                    className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      {editable && (
                        <>
                          <Checkbox
                            checked={skillData.proficient}
                            onCheckedChange={(checked) =>
                              update({
                                skills: {
                                  ...data.skills,
                                  [skill]: {
                                    ...skillData,
                                    proficient: !!checked,
                                  },
                                },
                              })
                            }
                          />
                          <Checkbox
                            checked={skillData.expertise}
                            onCheckedChange={(checked) =>
                              update({
                                skills: {
                                  ...data.skills,
                                  [skill]: {
                                    ...skillData,
                                    expertise: !!checked,
                                  },
                                },
                              })
                            }
                          />
                        </>
                      )}
                      <span className="text-sm">
                        {SKILL_LABELS[skill]} ({ABILITY_LABELS[SKILL_ABILITY_MAP[skill]]})
                      </span>
                    </div>
                    <span className="font-mono text-sm">
                      {formatModifier(getSkillTotal(data, skill))}
                    </span>
                  </div>
                );
              })}
              {editable && (
                <p className="text-xs text-muted-foreground">
                  First checkbox = proficient, second = expertise
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="combat" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="AC"
              value={data.combat.ac}
              editable={editable}
              type="number"
              onChange={(v) => updateCombat({ ac: parseInt(v) || 0 })}
            />
            <Field
              label="Max HP"
              value={data.combat.maxHp}
              editable={editable}
              type="number"
              onChange={(v) => updateCombat({ maxHp: parseInt(v) || 0 })}
            />
            <Field
              label="Current HP"
              value={data.combat.currentHp}
              editable={editable}
              type="number"
              onChange={(v) => updateCombat({ currentHp: parseInt(v) || 0 })}
            />
            <Field
              label="Temp HP"
              value={data.combat.tempHp}
              editable={editable}
              type="number"
              onChange={(v) => updateCombat({ tempHp: parseInt(v) || 0 })}
            />
            <Field
              label="Initiative Bonus"
              value={data.combat.initiativeBonus}
              editable={editable}
              type="number"
              onChange={(v) =>
                updateCombat({ initiativeBonus: parseInt(v) || 0 })
              }
            />
            <Field
              label="Speed"
              value={data.combat.speed}
              editable={editable}
              type="number"
              onChange={(v) => updateCombat({ speed: parseInt(v) || 0 })}
            />
            <Field
              label="Hit Dice"
              value={data.combat.hitDice}
              editable={editable}
              onChange={(v) => updateCombat({ hitDice: v })}
            />
            <Field
              label="Exhaustion"
              value={data.combat.exhaustion}
              editable={editable}
              type="number"
              onChange={(v) =>
                updateCombat({ exhaustion: parseInt(v) || 0 })
              }
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Death Saves</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-6">
              <div>
                <Label className="text-xs">Successes</Label>
                {editable ? (
                  <Input
                    type="number"
                    min={0}
                    max={3}
                    value={data.combat.deathSaves.successes}
                    onChange={(e) =>
                      updateCombat({
                        deathSaves: {
                          ...data.combat.deathSaves,
                          successes: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                ) : (
                  <p>{data.combat.deathSaves.successes}/3</p>
                )}
              </div>
              <div>
                <Label className="text-xs">Failures</Label>
                {editable ? (
                  <Input
                    type="number"
                    min={0}
                    max={3}
                    value={data.combat.deathSaves.failures}
                    onChange={(e) =>
                      updateCombat({
                        deathSaves: {
                          ...data.combat.deathSaves,
                          failures: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                ) : (
                  <p>{data.combat.deathSaves.failures}/3</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conditions & Concentration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {data.combat.conditions.length === 0 ? (
                  <span className="text-sm text-muted-foreground">None</span>
                ) : (
                  data.combat.conditions.map((c) => (
                    <Badge key={c} variant="secondary">
                      {c}
                    </Badge>
                  ))
                )}
              </div>
              {editable && (
                <Input
                  placeholder="Conditions (comma-separated)"
                  value={data.combat.conditions.join(", ")}
                  onChange={(e) =>
                    updateCombat({
                      conditions: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={data.combat.concentration.active}
                  disabled={!editable}
                  onCheckedChange={(checked) =>
                    updateCombat({
                      concentration: {
                        ...data.combat.concentration,
                        active: !!checked,
                      },
                    })
                  }
                />
                <span className="text-sm">Concentrating on:</span>
                {editable ? (
                  <Input
                    className="max-w-xs"
                    value={data.combat.concentration.spell}
                    onChange={(e) =>
                      updateCombat({
                        concentration: {
                          ...data.combat.concentration,
                          spell: e.target.value,
                        },
                      })
                    }
                  />
                ) : (
                  <span>{data.combat.concentration.spell || "—"}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attacks" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Attacks</CardTitle>
              {editable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update({
                      attacks: [
                        ...data.attacks,
                        {
                          id: crypto.randomUUID(),
                          name: "",
                          attackBonus: 0,
                          damageDice: "",
                          damageType: "",
                          range: "",
                          notes: "",
                        },
                      ],
                    })
                  }
                >
                  Add Attack
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {data.attacks.length === 0 && (
                <p className="text-sm text-muted-foreground">No attacks.</p>
              )}
              {data.attacks.map((attack, i) => (
                <div key={attack.id} className="rounded-md border p-3 space-y-2">
                  {editable ? (
                    <>
                      <Input
                        placeholder="Name"
                        value={attack.name}
                        onChange={(e) => {
                          const attacks = [...data.attacks];
                          attacks[i] = { ...attack, name: e.target.value };
                          update({ attacks });
                        }}
                      />
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                          type="number"
                          placeholder="Attack bonus"
                          value={attack.attackBonus}
                          onChange={(e) => {
                            const attacks = [...data.attacks];
                            attacks[i] = {
                              ...attack,
                              attackBonus: parseInt(e.target.value) || 0,
                            };
                            update({ attacks });
                          }}
                        />
                        <Input
                          placeholder="Damage (e.g. 1d8+3)"
                          value={attack.damageDice}
                          onChange={(e) => {
                            const attacks = [...data.attacks];
                            attacks[i] = {
                              ...attack,
                              damageDice: e.target.value,
                            };
                            update({ attacks });
                          }}
                        />
                        <Input
                          placeholder="Damage type"
                          value={attack.damageType}
                          onChange={(e) => {
                            const attacks = [...data.attacks];
                            attacks[i] = {
                              ...attack,
                              damageType: e.target.value,
                            };
                            update({ attacks });
                          }}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          update({
                            attacks: data.attacks.filter((a) => a.id !== attack.id),
                          })
                        }
                      >
                        Remove
                      </Button>
                    </>
                  ) : (
                    <div>
                      <p className="font-medium">{attack.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatModifier(attack.attackBonus)} to hit ·{" "}
                        {attack.damageDice} {attack.damageType}
                        {attack.range && ` · ${attack.range}`}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Spellcasting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                {editable ? (
                  <Select
                    value={data.spells.spellcastingAbility ?? ""}
                    onValueChange={(v) =>
                      update({
                        spells: {
                          ...data.spells,
                          spellcastingAbility: v as AbilityKey,
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ability" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ABILITY_LABELS) as AbilityKey[]).map(
                        (k) => (
                          <SelectItem key={k} value={k}>
                            {ABILITY_FULL_LABELS[k]}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <Stat
                    label="Spellcasting Ability"
                    value={
                      data.spells.spellcastingAbility
                        ? ABILITY_FULL_LABELS[data.spells.spellcastingAbility]
                        : "—"
                    }
                  />
                )}
                <Stat
                  label="Spell Save DC"
                  value={getSpellSaveDc(data) ?? "—"}
                />
                <Stat
                  label="Spell Attack"
                  value={
                    getSpellAttackBonus(data) !== null
                      ? formatModifier(getSpellAttackBonus(data)!)
                      : "—"
                  }
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Known Spells</Label>
                  {editable && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        update({
                          spells: {
                            ...data.spells,
                            known: [
                              ...data.spells.known,
                              {
                                id: crypto.randomUUID(),
                                name: "",
                                level: 0,
                                prepared: false,
                                notes: "",
                              },
                            ],
                          },
                        })
                      }
                    >
                      Add Spell
                    </Button>
                  )}
                </div>
                {data.spells.known.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No spells.</p>
                ) : (
                  data.spells.known.map((spell, i) => (
                    <div
                      key={spell.id}
                      className="flex items-center justify-between border-b py-2"
                    >
                      {editable ? (
                        <Input
                          value={spell.name}
                          onChange={(e) => {
                            const known = [...data.spells.known];
                            known[i] = { ...spell, name: e.target.value };
                            update({ spells: { ...data.spells, known } });
                          }}
                        />
                      ) : (
                        <span>
                          {spell.name}
                          {spell.level > 0 && ` (Level ${spell.level})`}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Currency</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-5 gap-2">
              {(["cp", "sp", "ep", "gp", "pp"] as const).map((coin) => (
                <Field
                  key={coin}
                  label={coin.toUpperCase()}
                  value={data.inventory.currency[coin]}
                  editable={editable}
                  type="number"
                  onChange={(v) =>
                    update({
                      inventory: {
                        ...data.inventory,
                        currency: {
                          ...data.inventory.currency,
                          [coin]: parseInt(v) || 0,
                        },
                      },
                    })
                  }
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Items</CardTitle>
              {editable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update({
                      inventory: {
                        ...data.inventory,
                        items: [
                          ...data.inventory.items,
                          {
                            id: crypto.randomUUID(),
                            name: "",
                            quantity: 1,
                            equipped: false,
                            magicItem: false,
                            notes: "",
                          },
                        ],
                      },
                    })
                  }
                >
                  Add Item
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {data.inventory.items.map((item, i) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center gap-2 border-b py-2"
                >
                  {editable ? (
                    <>
                      <Input
                        className="flex-1"
                        value={item.name}
                        onChange={(e) => {
                          const items = [...data.inventory.items];
                          items[i] = { ...item, name: e.target.value };
                          update({ inventory: { ...data.inventory, items } });
                        }}
                      />
                      <Input
                        type="number"
                        className="w-16"
                        value={item.quantity}
                        onChange={(e) => {
                          const items = [...data.inventory.items];
                          items[i] = {
                            ...item,
                            quantity: parseInt(e.target.value) || 0,
                          };
                          update({ inventory: { ...data.inventory, items } });
                        }}
                      />
                      <Checkbox
                        checked={item.equipped}
                        onCheckedChange={(checked) => {
                          const items = [...data.inventory.items];
                          items[i] = { ...item, equipped: !!checked };
                          update({ inventory: { ...data.inventory, items } });
                        }}
                      />
                      <span className="text-xs">Equipped</span>
                      <Checkbox
                        checked={item.magicItem}
                        onCheckedChange={(checked) => {
                          const items = [...data.inventory.items];
                          items[i] = { ...item, magicItem: !!checked };
                          update({ inventory: { ...data.inventory, items } });
                        }}
                      />
                      <span className="text-xs">Magic</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {item.name} ×{item.quantity}
                      </span>
                      {item.equipped && <Badge>Equipped</Badge>}
                      {item.magicItem && <Badge variant="secondary">Magic</Badge>}
                    </>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Features & Traits</CardTitle>
              {editable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update({
                      features: [
                        ...data.features,
                        {
                          id: crypto.randomUUID(),
                          name: "",
                          description: "",
                          restReset: "long" as const,
                        },
                      ],
                    })
                  }
                >
                  Add Feature
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {data.features.map((feature, i) => (
                <div key={feature.id} className="rounded-md border p-3 space-y-2">
                  {editable ? (
                    <>
                      <Input
                        placeholder="Name"
                        value={feature.name}
                        onChange={(e) => {
                          const features = [...data.features];
                          features[i] = { ...feature, name: e.target.value };
                          update({ features });
                        }}
                      />
                      <Textarea
                        placeholder="Description"
                        value={feature.description}
                        onChange={(e) => {
                          const features = [...data.features];
                          features[i] = {
                            ...feature,
                            description: e.target.value,
                          };
                          update({ features });
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <p className="font-medium">{feature.name}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {feature.description}
                      </p>
                      {feature.uses && (
                        <p className="text-xs">
                          Uses: {feature.uses.current}/{feature.uses.max} (
                          {feature.restReset} rest)
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Public Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {editable ? (
                <Textarea
                  rows={6}
                  value={data.basicInfo.publicNotes}
                  onChange={(e) =>
                    updateBasic({ publicNotes: e.target.value })
                  }
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm">
                  {data.basicInfo.publicNotes || "No notes."}
                </p>
              )}
            </CardContent>
          </Card>

          {isDm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">DM Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {editable ? (
                  <Textarea
                    rows={6}
                    value={data.basicInfo.dmNotes}
                    onChange={(e) => updateBasic({ dmNotes: e.target.value })}
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-sm">
                    {data.basicInfo.dmNotes || "No DM notes."}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
