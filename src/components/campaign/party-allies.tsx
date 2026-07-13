"use client";

import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadEnemyPortrait, resolveCombatImageUrl } from "@/lib/combat/storage";
import type { EnemyRecord } from "@/lib/combat/state-utils";
import { EnemyStatForm } from "@/components/admin/enemy-stat-form";
import { AllyStatView } from "@/components/campaign/ally-stat-view";
import { AddEnemyDialog } from "@/components/combat/add-enemy-dialog";
import { useShowDmUi } from "@/components/layout/dm-view-provider";
import { formatModifier, getAbilityModifiers } from "@/lib/dnd/calculations";
import { skillShortLabel } from "@/lib/dnd/party-summary";
import {
  createPartyAllyFromEnemy,
  getAllyRaceClassLine,
  getAllyInitiativeModifier,
  getAllyMaxHp,
  getAllyPassivePerception,
  listPartyAllies,
  parseAllySpeedFt,
} from "@/lib/dnd/party-allies";
import { findSpeciesByDisplayName } from "@/lib/content/catalog-tooltip";
import { resolveSpeciesDisplayName } from "@/lib/dnd/species-display";
import { PHB_SPECIES } from "@/lib/dnd/phb/species";
import { useRealtimePartyData } from "@/lib/hooks/use-realtime-party-data";
import { parseEnemyData } from "@/lib/schemas/enemy";
import { partyAllySchema, type PartyAlly, type PartyData } from "@/lib/schemas/party";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

interface PartyAlliesProps {
  campaignId: string;
  initialPartyData: PartyData;
  enemies: EnemyRecord[];
  isDm: boolean;
}

export function PartyAllies({
  campaignId,
  initialPartyData,
  enemies,
  isDm,
}: PartyAlliesProps) {
  const showDmUi = useShowDmUi(isDm);
  const livePartyData = useRealtimePartyData(campaignId, initialPartyData);
  const partyData = livePartyData;
  const allies = listPartyAllies(partyData);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [editAlly, setEditAlly] = useState<PartyAlly | null>(null);
  const [viewAlly, setViewAlly] = useState<PartyAlly | null>(null);
  const [draftAlly, setDraftAlly] = useState<PartyAlly | null>(null);

  function handleEnemyPicked(enemy: EnemyRecord) {
    setPickerOpen(false);
    const ally = createPartyAllyFromEnemy(enemy);
    setDraftAlly(ally);
    setEditAlly(ally);
  }

  function handleCardClick(ally: PartyAlly) {
    if (showDmUi) {
      setDraftAlly(ally);
      setEditAlly(ally);
    } else {
      setViewAlly(ally);
    }
  }

  return (
    <section className="retro-box">
      <div className="retro-section-header animals-section-header">
        <p className="retro-box-title">Allies</p>
        {showDmUi ? (
          <button
            type="button"
            className="retro-inline-link"
            onClick={() => setPickerOpen(true)}
          >
            + Add ally
          </button>
        ) : null}
      </div>

      {allies.length === 0 ? (
        <p className="retro-muted">No allies yet.</p>
      ) : (
        <div className="retro-member-grid">
          {allies.map((ally) => (
            <AllySummary key={ally.id} ally={ally} onClick={() => handleCardClick(ally)} />
          ))}
        </div>
      )}

      <AddEnemyDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        enemies={enemies}
        onSelect={handleEnemyPicked}
      />

      <AllyEditDialog
        open={editAlly != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditAlly(null);
            setDraftAlly(null);
          }
        }}
        campaignId={campaignId}
        ally={draftAlly}
        partyData={partyData}
        isNew={draftAlly != null && !partyData.allies.some((entry) => entry.id === draftAlly.id)}
        onSaved={() => {
          setEditAlly(null);
          setDraftAlly(null);
        }}
        onDeleted={() => {
          setEditAlly(null);
          setDraftAlly(null);
        }}
      />

      <Dialog open={viewAlly != null} onOpenChange={(open) => !open && setViewAlly(null)}>
        <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewAlly?.name ?? "Ally"}</DialogTitle>
          </DialogHeader>
          {viewAlly ? <AllyStatView ally={viewAlly} /> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function AllySummary({
  ally,
  onClick,
}: {
  ally: PartyAlly;
  onClick: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const data = ally.data;
  const portraitUrl = data.portraitPath
    ? resolveCombatImageUrl(supabase, data.portraitPath)
    : null;
  const speedFt = parseAllySpeedFt(data.speed);
  const mods = getAbilityModifiers(data.abilityScores);
  const topSkills = [...data.skills]
    .sort((a, b) => b.bonus - a.bonus)
    .slice(0, 3);

  return (
    <button
      type="button"
      className={`retro-member-box retro-member-box-button${portraitUrl ? " retro-member-box-portrait" : ""}`}
      style={
        portraitUrl
          ? ({ "--member-portrait-url": `url("${portraitUrl}")` } as CSSProperties)
          : undefined
      }
      onClick={onClick}
    >
      <div className="retro-member-box-content">
        <div className="retro-member-header">
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <strong>{ally.name}</strong>
          </div>
          <span className="retro-member-meta">{getAllyRaceClassLine(ally)}</span>
        </div>
        <p className="retro-member-line retro-member-line-nowrap">
          HP {ally.currentHp}/{getAllyMaxHp(ally)}
          {" · "}AC {data.armorClass.value}
          {" · "}
          {speedFt != null ? `${speedFt}ft` : data.speed || "—"}
          {" · "}Init {formatModifier(getAllyInitiativeModifier(ally))}
          {" · "}PP {getAllyPassivePerception(ally)}
        </p>
        <div className="retro-member-abilities">
          {ABILITY_KEYS.map((key) => (
            <span key={key}>
              {key.toUpperCase()} {data.abilityScores[key]}
              ({formatModifier(mods[key])})
            </span>
          ))}
        </div>
        {topSkills.length > 0 ? (
          <p className="retro-member-line retro-member-line-nowrap">
            <strong>Skills:</strong>{" "}
            {topSkills
              .map((skill) => `${skillShortLabel(skill.name)} ${formatModifier(skill.bonus)}`)
              .join(" · ")}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function AllyEditDialog({
  open,
  onOpenChange,
  campaignId,
  ally,
  partyData,
  isNew,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  ally: PartyAlly | null;
  partyData: PartyData;
  isNew: boolean;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [currentHp, setCurrentHp] = useState(1);
  const [speciesId, setSpeciesId] = useState("");
  const [subspeciesId, setSubspeciesId] = useState("");
  const [form, setForm] = useState(ally?.data ?? parseEnemyData({}));
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !ally) return;
    setName(ally.name);
    setNotes(ally.notes);
    setCurrentHp(ally.currentHp);
    setForm(parseEnemyData(ally.data));
    setPortraitFile(null);
    setFormError(null);
    const speciesMatch = findSpeciesByDisplayName(ally.race, PHB_SPECIES);
    setSpeciesId(speciesMatch?.species.id ?? "");
    setSubspeciesId(speciesMatch?.subspecies?.id ?? "");
  }, [open, ally]);

  const selectedSpecies = PHB_SPECIES.find((entry) => entry.id === speciesId);

  if (!ally) return null;

  function handleSave() {
    if (!ally || !name.trim()) {
      setFormError("Name is required.");
      return;
    }

    const allyId = ally.id;

    startTransition(async () => {
      let portraitPath = form.portraitPath;
      if (portraitFile) {
        const supabase = createClient();
        const upload = await uploadEnemyPortrait(supabase, `ally-${allyId}`, portraitFile);
        if (upload.error) {
          setFormError(upload.error);
          return;
        }
        portraitPath = upload.path ?? portraitPath;
      }

      const data = parseEnemyData({ ...form, portraitPath });
      const maxHp = data.hitPoints.average;
      const race = speciesId
        ? resolveSpeciesDisplayName(speciesId, subspeciesId || undefined, {
            species: PHB_SPECIES,
          })
        : "";
      const saved = partyAllySchema.parse({
        ...ally,
        name: name.trim(),
        notes,
        race,
        data,
        currentHp: Math.min(Math.max(0, currentHp), maxHp),
      });

      const nextAllies = isNew
        ? [...partyData.allies, saved]
        : partyData.allies.map((entry) => (entry.id === saved.id ? saved : entry));

      const supabase = createClient();
      const { error } = await supabase
        .from("campaigns")
        .update({ party_data: { ...partyData, allies: nextAllies } })
        .eq("id", campaignId);

      if (error) {
        setFormError(error.message);
        return;
      }

      onSaved();
    });
  }

  function handleDelete() {
    if (!ally) return;
    if (!confirm(`Remove ally "${ally.name}" from the party?`)) return;

    startTransition(async () => {
      const nextAllies = partyData.allies.filter((entry) => entry.id !== ally.id);
      const supabase = createClient();
      const { error } = await supabase
        .from("campaigns")
        .update({ party_data: { ...partyData, allies: nextAllies } })
        .eq("id", campaignId);

      if (error) {
        setFormError(error.message);
        return;
      }

      onDeleted();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto p-8">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-xl">
            {isNew ? "New ally" : `Edit ally: ${ally.name}`}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="ally-name">Name *</Label>
            <Input
              id="ally-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ally-species">Species</Label>
            <select
              id="ally-species"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={speciesId}
              onChange={(event) => {
                setSpeciesId(event.target.value);
                setSubspeciesId("");
              }}
            >
              <option value="">— choose —</option>
              {PHB_SPECIES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>
          {selectedSpecies?.subspecies?.length ? (
            <div className="space-y-1.5">
              <Label htmlFor="ally-subspecies">Subspecies</Label>
              <select
                id="ally-subspecies"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={subspeciesId}
                onChange={(event) => setSubspeciesId(event.target.value)}
              >
                <option value="">— choose —</option>
                {selectedSpecies.subspecies.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ally-current-hp">Current HP</Label>
            <Input
              id="ally-current-hp"
              type="number"
              min={0}
              value={currentHp}
              onChange={(event) => setCurrentHp(Number(event.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ally-notes">Notes</Label>
            <Input
              id="ally-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>

        <EnemyStatForm
          form={form}
          onChange={setForm}
          portraitFile={portraitFile}
          onPortraitFileChange={setPortraitFile}
          portraitSlug={`ally-${ally.id}`}
        />

        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

        <DialogFooter className="mt-6 -mx-8 -mb-8 flex-wrap gap-2">
          {!isNew ? (
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
              Remove ally
            </Button>
          ) : null}
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || !name.trim()}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
