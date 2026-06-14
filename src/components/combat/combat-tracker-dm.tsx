"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { optionLabel } from "@/lib/ui/select-display";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { Encounter } from "@/lib/types/database";
import type { ParsedCharacter, ParsedCombatant } from "@/lib/character/utils";

const COMBATANT_TYPE_OPTIONS = [
  { value: "player", label: "Player" },
  { value: "npc", label: "NPC" },
  { value: "monster", label: "Monster" },
] as const;
import {
  COMMON_CONDITIONS,
  createDefaultCombatantData,
  sortCombatantsByInitiative,
  type CombatantData,
  type CombatantType,
} from "@/lib/schemas/combat";
import { applyDamage, applyHealing } from "@/lib/dnd/calculations";
import { useRealtimeEncounter } from "@/lib/hooks/use-realtime-encounter";

interface CombatTrackerDmProps {
  encounter: Encounter;
  combatants: ParsedCombatant[];
  characters: ParsedCharacter[];
  campaignId: string;
}

export function CombatTrackerDm({
  encounter: initialEncounter,
  combatants: initialCombatants,
  characters,
  campaignId,
}: CombatTrackerDmProps) {
  const { encounter, combatants: rawCombatants } = useRealtimeEncounter(
    initialEncounter.id,
    { encounter: initialEncounter, combatants: initialCombatants }
  );

  const sorted = useMemo(
    () => sortCombatantsByInitiative(rawCombatants),
    [rawCombatants]
  );

  const currentCombatant = sorted[encounter.current_turn_index] ?? null;

  async function updateEncounter(patch: Partial<Encounter>) {
    const supabase = createClient();
    await supabase
      .from("encounters")
      .update(patch)
      .eq("id", encounter.id);
  }

  async function updateCombatant(
    id: string,
    patch: Partial<ParsedCombatant> & { data?: CombatantData }
  ) {
    const supabase = createClient();
    await supabase.from("encounter_combatants").update(patch).eq("id", id);
  }

  async function deleteCombatant(id: string) {
    const supabase = createClient();
    await supabase.from("encounter_combatants").delete().eq("id", id);
  }

  function clampTurnIndex(index: number) {
    if (sorted.length === 0) return 0;
    return Math.max(0, Math.min(index, sorted.length - 1));
  }

  return (
    <div className="space-y-4">
      <EncounterHeader
        encounter={encounter}
        sortedCount={sorted.length}
        currentCombatant={currentCombatant}
        onUpdateEncounter={updateEncounter}
      />

      <EncounterControls
        encounter={encounter}
        sortedLength={sorted.length}
        onUpdateEncounter={updateEncounter}
        clampTurnIndex={clampTurnIndex}
      />

      <div className="flex flex-wrap gap-2">
        <AddPartyDialog
          characters={characters}
          existingCharacterIds={sorted
            .map((c) => c.character_id)
            .filter(Boolean) as string[]}
          encounterId={encounter.id}
        />
        <AddCombatantDialog encounterId={encounter.id} />
      </div>

      <div className="space-y-3">
        {sorted.map((combatant, index) => (
          <CombatantRowDm
            key={combatant.id}
            combatant={combatant}
            isActive={encounter.active && index === encounter.current_turn_index}
            onUpdate={(patch) => updateCombatant(combatant.id, patch)}
            onDelete={() => deleteCombatant(combatant.id)}
          />
        ))}
        {sorted.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Add party members or monsters to begin.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function EncounterHeader({
  encounter,
  sortedCount,
  currentCombatant,
  onUpdateEncounter,
}: {
  encounter: Encounter;
  sortedCount: number;
  currentCombatant: ParsedCombatant | null;
  onUpdateEncounter: (patch: Partial<Encounter>) => Promise<void>;
}) {
  const [name, setName] = useState(encounter.name);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Input
          className="max-w-xs text-lg font-bold"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name !== encounter.name) onUpdateEncounter({ name });
          }}
        />
        <p className="mt-1 text-sm text-muted-foreground">
          Round {encounter.round || "—"} ·{" "}
          {encounter.active ? "Active" : "Not started"} · {sortedCount}{" "}
          combatants
        </p>
        {encounter.active && currentCombatant && (
          <p className="text-sm font-medium">
            Current turn: {currentCombatant.data.name}
          </p>
        )}
      </div>
      <Badge variant={encounter.active ? "default" : "secondary"}>
        {encounter.active ? "In Combat" : "Prep"}
      </Badge>
    </div>
  );
}

function EncounterControls({
  encounter,
  sortedLength,
  onUpdateEncounter,
  clampTurnIndex,
}: {
  encounter: Encounter;
  sortedLength: number;
  onUpdateEncounter: (patch: Partial<Encounter>) => Promise<void>;
  clampTurnIndex: (index: number) => number;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap gap-2 pt-4">
        <Button
          size="sm"
          onClick={() =>
            onUpdateEncounter({
              active: true,
              round: encounter.round > 0 ? encounter.round : 1,
              current_turn_index: 0,
            })
          }
          disabled={sortedLength === 0}
        >
          Start Encounter
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!encounter.active || sortedLength === 0}
          onClick={() =>
            onUpdateEncounter({
              current_turn_index: clampTurnIndex(
                encounter.current_turn_index + 1 >= sortedLength
                  ? 0
                  : encounter.current_turn_index + 1
              ),
              round:
                encounter.current_turn_index + 1 >= sortedLength
                  ? encounter.round + 1
                  : encounter.round,
            })
          }
        >
          Next Turn
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!encounter.active || sortedLength === 0}
          onClick={() =>
            onUpdateEncounter({
              current_turn_index: clampTurnIndex(
                encounter.current_turn_index - 1 < 0
                  ? sortedLength - 1
                  : encounter.current_turn_index - 1
              ),
              round:
                encounter.current_turn_index - 1 < 0 &&
                encounter.round > 1
                  ? encounter.round - 1
                  : encounter.round,
            })
          }
        >
          Previous Turn
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!encounter.active}
          onClick={() =>
            onUpdateEncounter({ round: encounter.round + 1 })
          }
        >
          Next Round
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() =>
            onUpdateEncounter({
              active: false,
              round: 0,
              current_turn_index: 0,
            })
          }
        >
          End Encounter
        </Button>
      </CardContent>
    </Card>
  );
}

function CombatantRowDm({
  combatant,
  isActive,
  onUpdate,
  onDelete,
}: {
  combatant: ParsedCombatant;
  isActive: boolean;
  onUpdate: (
    patch: Partial<ParsedCombatant> & { data?: CombatantData }
  ) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [damageOpen, setDamageOpen] = useState(false);
  const [healOpen, setHealOpen] = useState(false);
  const [tempOpen, setTempOpen] = useState(false);
  const [conditionOpen, setConditionOpen] = useState(false);
  const d = combatant.data;

  async function applyHpChange(
    fn: (current: number, temp: number) => { currentHp: number; tempHp: number }
  ) {
    const result = fn(d.currentHp, d.tempHp);
    await onUpdate({
      data: { ...d, currentHp: result.currentHp, tempHp: result.tempHp },
    });
  }

  return (
    <Card className={isActive ? "border-primary ring-1 ring-primary" : ""}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {d.name}
              <Badge variant="outline">{d.type}</Badge>
              {isActive && <Badge>Turn</Badge>}
              {!combatant.visible_to_players && (
                <Badge variant="secondary">Hidden</Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Initiative {combatant.initiative} · AC {d.ac} · HP{" "}
              {d.currentHp}/{d.maxHp}
              {d.tempHp > 0 && ` (+${d.tempHp} temp)`}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDamageOpen(true)}
            >
              Damage
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setHealOpen(true)}
            >
              Heal
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTempOpen(true)}
            >
              Temp HP
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConditionOpen(true)}
            >
              Conditions
            </Button>
            <HpDialog
              open={damageOpen}
              onOpenChange={setDamageOpen}
              title="Apply Damage"
              onSubmit={async (amount) => {
                await applyHpChange((c, t) =>
                  applyDamage(c, t, amount)
                );
                setDamageOpen(false);
              }}
            />
            <HealDialog
              open={healOpen}
              onOpenChange={setHealOpen}
              onSubmit={async (amount) => {
                await onUpdate({
                  data: {
                    ...d,
                    currentHp: applyHealing(d.currentHp, d.maxHp, amount),
                  },
                });
                setHealOpen(false);
              }}
            />
            <TempHpDialog
              open={tempOpen}
              onOpenChange={setTempOpen}
              onSubmit={async (amount) => {
                await onUpdate({
                  data: {
                    ...d,
                    tempHp: Math.max(0, d.tempHp + amount),
                  },
                });
                setTempOpen(false);
              }}
            />
            <ConditionDialog
              open={conditionOpen}
              onOpenChange={setConditionOpen}
              conditions={d.conditions}
              onSubmit={async (conditions) => {
                await onUpdate({ data: { ...d, conditions } });
                setConditionOpen(false);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onUpdate({
                  data: {
                    ...d,
                    concentration: {
                      ...d.concentration,
                      active: !d.concentration.active,
                    },
                  },
                })
              }
            >
              {d.concentration.active ? "Drop Conc." : "Conc."}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onUpdate({
                  visible_to_players: !combatant.visible_to_players,
                })
              }
            >
              {combatant.visible_to_players ? "Hide" : "Reveal"}
            </Button>
            <Button size="sm" variant="destructive" onClick={onDelete}>
              Remove
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {d.conditions.map((c) => (
            <Badge key={c} variant="secondary">
              {c}
            </Badge>
          ))}
          {d.concentration.active && (
            <Badge>Concentrating: {d.concentration.spell || "?"}</Badge>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <div>
            <Label className="text-xs">Initiative</Label>
            <Input
              type="number"
              value={combatant.initiative}
              onChange={(e) =>
                onUpdate({ initiative: parseInt(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <Label className="text-xs">AC</Label>
            <Input
              type="number"
              value={d.ac}
              onChange={(e) =>
                onUpdate({
                  data: { ...d, ac: parseInt(e.target.value) || 0 },
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Current HP</Label>
            <Input
              type="number"
              value={d.currentHp}
              onChange={(e) =>
                onUpdate({
                  data: {
                    ...d,
                    currentHp: parseInt(e.target.value) || 0,
                  },
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Max HP</Label>
            <Input
              type="number"
              value={d.maxHp}
              onChange={(e) =>
                onUpdate({
                  data: { ...d, maxHp: parseInt(e.target.value) || 0 },
                })
              }
            />
          </div>
        </div>
        <Textarea
          placeholder="DM notes"
          rows={2}
          value={d.dmNotes}
          onChange={(e) =>
            onUpdate({ data: { ...d, dmNotes: e.target.value } })
          }
        />
      </CardContent>
    </Card>
  );
}

function HpDialog({
  open,
  onOpenChange,
  title,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onSubmit: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button
          onClick={() => onSubmit(parseInt(amount) || 0)}
          disabled={!amount}
        >
          Apply
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function HealDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply Healing</DialogTitle>
        </DialogHeader>
        <Input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button
          onClick={() => onSubmit(parseInt(amount) || 0)}
          disabled={!amount}
        >
          Apply
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function TempHpDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Temp HP (+/-)</DialogTitle>
        </DialogHeader>
        <Input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button
          onClick={() => onSubmit(parseInt(amount) || 0)}
          disabled={!amount}
        >
          Apply
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function ConditionDialog({
  open,
  onOpenChange,
  conditions,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conditions: string[];
  onSubmit: (conditions: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>(conditions);
  const [custom, setCustom] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) setSelected(conditions);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conditions</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {COMMON_CONDITIONS.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={selected.includes(c) ? "default" : "outline"}
              onClick={() =>
                setSelected((prev) =>
                  prev.includes(c)
                    ? prev.filter((x) => x !== c)
                    : [...prev, c]
                )
              }
            >
              {c}
            </Button>
          ))}
        </div>
        <Input
          placeholder="Custom condition"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <Button
          variant="outline"
          onClick={() => {
            if (custom.trim()) {
              setSelected((prev) => [...prev, custom.trim()]);
              setCustom("");
            }
          }}
        >
          Add Custom
        </Button>
        <Button onClick={() => onSubmit(selected)}>Save</Button>
      </DialogContent>
    </Dialog>
  );
}

function AddPartyDialog({
  characters,
  existingCharacterIds,
  encounterId,
}: {
  characters: ParsedCharacter[];
  existingCharacterIds: string[];
  encounterId: string;
}) {
  const available = characters.filter(
    (c) => !existingCharacterIds.includes(c.id)
  );

  const [open, setOpen] = useState(false);

  async function addCharacter(character: ParsedCharacter) {
    const supabase = createClient();
    const dexMod = Math.floor((character.data.abilityScores.dex - 10) / 2);
    const initiative =
      dexMod + (character.data.combat.initiativeBonus ?? 0);

    await supabase.from("encounter_combatants").insert({
      encounter_id: encounterId,
      character_id: character.id,
      initiative: initiative + Math.floor(Math.random() * 20) + 1,
      sort_order: Date.now(),
      visible_to_players: true,
      data: createDefaultCombatantData({
        name: character.name,
        type: "player",
        ac: character.data.combat.ac,
        maxHp: character.data.combat.maxHp,
        currentHp: character.data.combat.currentHp,
        tempHp: character.data.combat.tempHp,
        conditions: character.data.combat.conditions,
        concentration: character.data.combat.concentration,
      }),
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        variant="outline"
        disabled={available.length === 0}
        onClick={() => setOpen(true)}
      >
        Add Party
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Party Characters</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {available.map((c) => (
            <Button
              key={c.id}
              variant="outline"
              className="w-full justify-start"
              onClick={() => addCharacter(c)}
            >
              {c.name} ({c.player_name})
            </Button>
          ))}
          {available.length === 0 && (
            <p className="text-sm text-muted-foreground">
              All characters already in encounter.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddCombatantDialog({ encounterId }: { encounterId: string }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CombatantType>("monster");
  const [initiative, setInitiative] = useState("10");
  const [ac, setAc] = useState("12");
  const [maxHp, setMaxHp] = useState("10");
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState(false);

  async function submit() {
    const supabase = createClient();
    await supabase.from("encounter_combatants").insert({
      encounter_id: encounterId,
      character_id: null,
      initiative: parseInt(initiative) || 10,
      sort_order: Date.now(),
      visible_to_players: visible,
      data: createDefaultCombatantData({
        name,
        type,
        ac: parseInt(ac) || 10,
        maxHp: parseInt(maxHp) || 1,
        currentHp: parseInt(maxHp) || 1,
      }),
    });
    setOpen(false);
    setName("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        Add Combatant
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Combatant</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select value={type} onValueChange={(v) => setType(v as CombatantType)}>
            <SelectTrigger>
              <SelectValue>{optionLabel(COMBATANT_TYPE_OPTIONS, type)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="player">Player</SelectItem>
              <SelectItem value="npc">NPC</SelectItem>
              <SelectItem value="monster">Monster</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid grid-cols-3 gap-2">
            <Input
              type="number"
              placeholder="Initiative"
              value={initiative}
              onChange={(e) => setInitiative(e.target.value)}
            />
            <Input
              type="number"
              placeholder="AC"
              value={ac}
              onChange={(e) => setAc(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Max HP"
              value={maxHp}
              onChange={(e) => setMaxHp(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={visible} onCheckedChange={setVisible} />
            <Label>Visible to players</Label>
          </div>
          <Button onClick={submit} disabled={!name.trim()}>
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
