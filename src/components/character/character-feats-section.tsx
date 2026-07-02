"use client";

import { useMemo, useState } from "react";
import { FeatPicker } from "@/components/character-creator/feat-picker";
import { GrantFeatureRow } from "@/components/character/grant-feature-row";
import { useGatedFeatureEdit } from "@/components/character/use-gated-feature-edit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addDmGrantedFeat,
  changeCharacterFeat,
  getAllCharacterFeatIds,
  getCharacterSheetFeats,
  removeCharacterFeat,
  sheetFeatSourceLabel,
  type SheetFeatEntry,
} from "@/lib/character/character-feats";
import { clearMagicInitiateChoices } from "@/lib/character/feature-grant-sync";
import { deriveMagicInitiateGrantFeature } from "@/lib/character/feature-grant-features";
import { getFeatAbilityBonusConfig } from "@/lib/dnd/feat-ability-bonuses";
import { ABILITY_LABELS } from "@/lib/dnd/calculations";
import { ABILITY_KEYS } from "@/lib/dnd/phb/point-buy";
import { getFeat, PHB_FEATS } from "@/lib/dnd/phb/feats";
import type { CharacterData } from "@/lib/schemas/character";

interface CharacterFeatsSectionProps {
  data: CharacterData;
  editable?: boolean;
  showDmUi: boolean;
  onApply: (patch: Partial<CharacterData>) => void;
}

type PendingFeatAction =
  | { kind: "add"; featId: string; choiceIndex?: number }
  | { kind: "change"; key: string; featId: string; choiceIndex?: number };

function featAbilityChoiceSelect(
  featId: string,
  value: number | undefined,
  onChange: (choiceIndex: number) => void
) {
  const bonus = getFeatAbilityBonusConfig(featId);
  if (bonus?.mode !== "choice" || !bonus.choices?.length) return null;

  return (
    <Select
      value={value != null ? String(value) : undefined}
      onValueChange={(next) => {
        if (next == null) return;
        onChange(parseInt(next, 10));
      }}
    >
      <SelectTrigger className="h-9">
        <SelectValue placeholder="Choose ability bonus" />
      </SelectTrigger>
      <SelectContent>
        {bonus.choices.map((choice, idx) => {
          const label = ABILITY_KEYS.filter((k) => choice[k])
            .map((k) => `${ABILITY_LABELS[k]} +${choice[k]}`)
            .join(", ");
          return (
            <SelectItem key={idx} value={String(idx)}>
              {label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function SpeciesFeatRow({
  entry,
  data,
  editable,
  onApply,
}: {
  entry: SheetFeatEntry;
  data: CharacterData;
  editable?: boolean;
  onApply: (patch: Partial<CharacterData>) => void;
}) {
  const feat = getFeat(entry.featId);
  const {
    gated,
    isEditing,
    workingData,
    startEdit,
    save,
    cancel,
    canSave,
    draftApply,
  } = useGatedFeatureEdit({
    featureId: "feat:species",
    editable,
    savedData: data,
    isDraftDirty: (saved, draft) =>
      (saved.featureChoices?.variantHumanFeat ?? "") !==
      (draft.featureChoices?.variantHumanFeat ?? ""),
    onCommit: (draft) => onApply(draft),
  });

  const showEditors = editable && (!gated || isEditing);
  const choiceValue = workingData.featureChoices?.variantHumanFeat ?? "";

  return (
    <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{feat?.name ?? entry.featId}</p>
          <Badge variant="outline" className="text-xs shrink-0">
            {sheetFeatSourceLabel(entry)}
          </Badge>
        </div>
        {editable && gated && !isEditing ? (
          <Button type="button" size="sm" variant="outline" onClick={startEdit}>
            Edit
          </Button>
        ) : null}
        {editable && gated && isEditing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={cancel}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={!canSave}>
              Save
            </Button>
          </div>
        ) : null}
      </div>
      {showEditors ? (
        <Select
          value={choiceValue || undefined}
          onValueChange={(value) => {
            const nextChoices = clearMagicInitiateChoices(
              {
                ...(workingData.featureChoices ?? {}),
                variantHumanFeat: value ?? "",
              },
              workingData
            );
            const patch = { featureChoices: nextChoices };
            if (gated && isEditing) {
              draftApply(patch);
            } else {
              onApply(patch);
            }
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Choose a feat" />
          </SelectTrigger>
          <SelectContent>
            {PHB_FEATS.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {feat?.description ?? "Choose a feat (Variant Human)."}
      </p>
    </div>
  );
}

function DmFeatRow({
  entry,
  data,
  editable,
  onApply,
  onRequestChange,
}: {
  entry: SheetFeatEntry;
  data: CharacterData;
  editable?: boolean;
  onApply: (next: CharacterData) => void;
  onRequestChange: (action: PendingFeatAction) => void;
}) {
  const feat = getFeat(entry.featId);

  return (
    <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{feat?.name ?? entry.featId}</p>
          <Badge variant="outline" className="text-xs shrink-0">
            {sheetFeatSourceLabel(entry)}
          </Badge>
        </div>
        {editable ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => onApply(removeCharacterFeat(data, entry.key))}
          >
            Remove
          </Button>
        ) : null}
      </div>
      {editable ? (
        <FeatPicker
          selectedId={entry.featId}
          excludedIds={getAllCharacterFeatIds(data).filter((id) => id !== entry.featId)}
          onChange={(featId) => {
            if (!featId) {
              onApply(removeCharacterFeat(data, entry.key));
              return;
            }
            const bonus = getFeatAbilityBonusConfig(featId);
            if (bonus?.mode === "choice" && bonus.choices?.length) {
              onRequestChange({ kind: "change", key: entry.key, featId });
              return;
            }
            onApply(changeCharacterFeat(data, entry.key, featId));
          }}
        />
      ) : null}
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {feat?.description ?? ""}
      </p>
    </div>
  );
}

function ReadOnlyFeatRow({ entry }: { entry: SheetFeatEntry }) {
  const feat = getFeat(entry.featId);
  return (
    <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{feat?.name ?? entry.featId}</p>
        <Badge variant="outline" className="text-xs shrink-0">
          {sheetFeatSourceLabel(entry)}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {feat?.description ?? ""}
      </p>
    </div>
  );
}

export function CharacterFeatsSection({
  data,
  editable,
  showDmUi,
  onApply,
}: CharacterFeatsSectionProps) {
  const sheetFeats = useMemo(() => getCharacterSheetFeats(data), [data]);
  const magicInitiateFeature = useMemo(
    () => deriveMagicInitiateGrantFeature(data),
    [data]
  );
  const [addingFeat, setAddingFeat] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingFeatAction | null>(
    null
  );

  const visible = showDmUi || sheetFeats.length > 0;
  if (!visible) return null;

  const canManageFeats = showDmUi && editable;

  function commitPending(choiceIndex?: number) {
    if (!pendingAction) return;
    if (pendingAction.kind === "add") {
      onApply(
        addDmGrantedFeat(data, pendingAction.featId, choiceIndex ?? pendingAction.choiceIndex)
      );
    } else {
      onApply(
        changeCharacterFeat(
          data,
          pendingAction.key,
          pendingAction.featId,
          choiceIndex ?? pendingAction.choiceIndex
        )
      );
    }
    setPendingAction(null);
    setAddingFeat(false);
  }

  function handleAddFeat(featId: string) {
    if (!featId) return;
    const bonus = getFeatAbilityBonusConfig(featId);
    if (bonus?.mode === "choice" && bonus.choices?.length) {
      setPendingAction({ kind: "add", featId });
      return;
    }
    onApply(addDmGrantedFeat(data, featId));
    setAddingFeat(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Feats</CardTitle>
        {canManageFeats ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAddingFeat((open) => !open);
              setPendingAction(null);
            }}
          >
            Add Feat
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {sheetFeats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No feats.</p>
        ) : null}

        {sheetFeats.map((entry) => {
          const row =
            canManageFeats ? (
              <DmFeatRow
                key={entry.key}
                entry={entry}
                data={data}
                editable={editable}
                onApply={(next) => onApply(next)}
                onRequestChange={setPendingAction}
              />
            ) : entry.source === "species" && editable ? (
              <SpeciesFeatRow
                key={entry.key}
                entry={entry}
                data={data}
                editable={editable}
                onApply={onApply}
              />
            ) : (
              <ReadOnlyFeatRow key={entry.key} entry={entry} />
            );

          return (
            <div key={entry.key} className="space-y-3">
              {row}
              {entry.featId === "magic-initiate" && magicInitiateFeature ? (
                <GrantFeatureRow
                  feature={magicInitiateFeature}
                  data={data}
                  editable={editable}
                  onApply={onApply}
                />
              ) : null}
            </div>
          );
        })}

        {canManageFeats && addingFeat ? (
          <div className="rounded-md border p-3 space-y-2">
            <FeatPicker
              selectedId=""
              excludedIds={getAllCharacterFeatIds(data)}
              onChange={handleAddFeat}
            />
          </div>
        ) : null}

        {pendingAction ? (
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm font-medium">
              {getFeat(pendingAction.featId)?.name ?? pendingAction.featId} — choose
              ability bonus
            </p>
            {featAbilityChoiceSelect(
              pendingAction.featId,
              pendingAction.choiceIndex,
              (choiceIndex) => {
                setPendingAction({ ...pendingAction, choiceIndex });
              }
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPendingAction(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pendingAction.choiceIndex == null}
                onClick={() => commitPending(pendingAction.choiceIndex)}
              >
                Confirm
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
