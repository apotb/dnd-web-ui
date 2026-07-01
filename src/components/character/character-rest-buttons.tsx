"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import {
  applyLongRest,
  canTakeLongRest,
  describeLongRestEffects,
  getLongRestRestorations,
  getShortRestRestorations,
  startPendingShortRest,
} from "@/lib/dnd/rest";
import { resolveCharacterClass } from "@/lib/character/class-derivation";
import { isManagedGrantSpell } from "@/lib/character/spell-sources";
import type { CatalogSpellRow } from "@/lib/content/catalog-client";
import { getSpellsBySlugsClient } from "@/lib/content/catalog-client";
import { formatSpellPickerTooltip, getMaxCastableSpellLevel } from "@/lib/dnd/spell-display";
import {
  applyPreparedSelection,
  canReprepareSpellsOnLongRest,
  getSpellcastingLimits,
  isWizard,
  listPreparedLeveledSpells,
  syncSpellcastingFromClass,
} from "@/lib/dnd/spellcasting";
import { levelFromXp } from "@/lib/dnd/xp";
import type { HarptosDate } from "@/lib/dnd/harptos-calendar";
import type { CharacterData } from "@/lib/schemas/character";
import type { PhbClass, PhbSpecies } from "@/lib/dnd/phb/types";
import { SpellPreparationDialog } from "@/components/spells/spell-preparation-dialog";
import { useShowDmUi } from "@/components/layout/dm-view-provider";

interface CharacterRestButtonsProps {
  data: CharacterData;
  campaignDate: HarptosDate;
  isDm: boolean;
  classes?: PhbClass[];
  speciesList?: PhbSpecies[];
  onApply: (next: CharacterData) => void;
}

export function CharacterRestButtons({
  data,
  campaignDate,
  isDm,
  classes,
  speciesList,
  onApply,
}: CharacterRestButtonsProps) {
  const showDmUi = useShowDmUi(isDm);
  const [longOpen, setLongOpen] = useState(false);
  const [shortOpen, setShortOpen] = useState(false);
  const [prepPromptOpen, setPrepPromptOpen] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);
  const [preparedSpellCatalog, setPreparedSpellCatalog] = useState<
    Record<string, CatalogSpellRow>
  >({});

  const resolvedClass = useMemo(
    () => resolveCharacterClass(data, classes),
    [data, classes]
  );
  const characterLevel = levelFromXp(data.basicInfo.xp ?? 0);
  const spellLimits = useMemo(
    () =>
      resolvedClass?.spellcasting
        ? getSpellcastingLimits(resolvedClass, characterLevel, data.abilityScores)
        : null,
    [resolvedClass, characterLevel, data.abilityScores]
  );
  const canReprepare = resolvedClass
    ? canReprepareSpellsOnLongRest(resolvedClass)
    : false;
  const classSpellListId = resolvedClass?.spellcasting?.spellListId;
  const maxCastableSpellLevel = useMemo(
    () => getMaxCastableSpellLevel(characterLevel, data.spells.slots),
    [characterLevel, data.spells.slots]
  );
  const preparedLeveledSlugs = useMemo(
    () =>
      listPreparedLeveledSpells(data.spells.known)
        .map((spell) => spell.spellId)
        .filter((slug): slug is string => !!slug),
    [data.spells.known]
  );
  const preparedLeveledSpells = useMemo(
    () => listPreparedLeveledSpells(data.spells.known),
    [data.spells.known]
  );
  const spellbookSlugs = useMemo(() => {
    if (!resolvedClass || !isWizard(resolvedClass)) return undefined;
    return data.spells.known
      .filter(
        (spell) =>
          spell.level > 0 && !isManagedGrantSpell(spell) && !!spell.spellId
      )
      .map((spell) => spell.spellId!);
  }, [data.spells.known, resolvedClass]);

  const longAvailability = useMemo(
    () => canTakeLongRest(data, campaignDate, showDmUi),
    [data, campaignDate, showDmUi]
  );
  const longRestEffects = useMemo(
    () => describeLongRestEffects(data, classes, speciesList),
    [data, classes, speciesList]
  );
  const longRestRestorations = useMemo(
    () => getLongRestRestorations(data, classes, speciesList),
    [data, classes, speciesList]
  );
  const shortRestRestorations = useMemo(
    () => getShortRestRestorations(data, classes, speciesList),
    [data, classes, speciesList]
  );

  const pendingShortRest = data.combat.pendingShortRest;

  useEffect(() => {
    if (!prepPromptOpen || preparedLeveledSlugs.length === 0) {
      setPreparedSpellCatalog({});
      return;
    }
    void getSpellsBySlugsClient(preparedLeveledSlugs).then(setPreparedSpellCatalog);
  }, [prepPromptOpen, preparedLeveledSlugs]);

  function handleLongRestConfirm() {
    const rested = applyLongRest(data, campaignDate, classes, speciesList);
    onApply(rested);
    setLongOpen(false);
    if (canReprepare) {
      setPrepPromptOpen(true);
    }
  }

  function handleKeepCurrentPrep() {
    setPrepPromptOpen(false);
  }

  function handleOpenPrepDialog() {
    setPrepPromptOpen(false);
    setPrepOpen(true);
  }

  function beginShortRestHeal() {
    onApply(startPendingShortRest(data));
    setShortOpen(false);
  }

  function handleConfirmPreparedSpells(selected: CatalogSpellRow[]) {
    if (!resolvedClass || !spellLimits?.preparedSpells) {
      setPrepOpen(false);
      return;
    }

    const known = applyPreparedSelection(
      data.spells.known,
      selected.map((spell) => ({
        slug: spell.slug,
        name: spell.name,
        level: spell.level,
        school: spell.school,
      })),
      spellLimits.preparedSpells,
      { wizardSpellbook: isWizard(resolvedClass) }
    );
    const next = {
      ...data,
      spells: syncSpellcastingFromClass(
        { ...data, spells: { ...data.spells, known } },
        resolvedClass,
        characterLevel
      ),
    };
    onApply(next);
    setPrepOpen(false);
  }

  const longDisabled = !longAvailability.ok;
  const longDisabledReason = longAvailability.ok ? null : longAvailability.reason;
  const canOpenReprepare =
    canReprepare &&
    spellLimits?.preparedSpells != null &&
    classSpellListId &&
    (!isWizard(resolvedClass!) || (spellbookSlugs?.length ?? 0) > 0);

  return (
    <>
      <div className="character-rest-actions">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full"
          disabled={pendingShortRest}
          onClick={() => setShortOpen(true)}
        >
          Short Rest
        </Button>
        {longDisabled && longDisabledReason ? (
          <Tooltip content={longDisabledReason}>
            <span className="inline-flex w-full">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                disabled
              >
                Long Rest
              </Button>
            </span>
          </Tooltip>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => setLongOpen(true)}
          >
            Long Rest
          </Button>
        )}
      </div>

      <Dialog open={longOpen} onOpenChange={setLongOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take a long rest?</DialogTitle>
          </DialogHeader>
          {longRestEffects.length > 0 ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                A long rest will apply the following:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                {longRestEffects.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {longRestRestorations.length > 0 ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                The following features will recharge:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                {longRestRestorations.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {!showDmUi ? (
            <p className="text-xs text-muted-foreground">
              Each character can take one long rest per in-game day.
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLongOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleLongRestConfirm}>
              Long Rest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={prepPromptOpen} onOpenChange={setPrepPromptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Prepared spells</DialogTitle>
            <DialogDescription>
              After a long rest, you may change which spells you have prepared.
            </DialogDescription>
          </DialogHeader>
          {preparedLeveledSpells.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Currently prepared:{" "}
              {preparedLeveledSpells.map((spell, index) => {
                const catalogSpell = spell.spellId
                  ? preparedSpellCatalog[spell.spellId]
                  : undefined;
                const displayName =
                  catalogSpell?.name ?? (spell.name || "Unknown spell");
                const tooltip = formatSpellPickerTooltip(
                  catalogSpell ?? { name: displayName }
                );
                return (
                  <span key={spell.id}>
                    {index > 0 ? ", " : null}
                    <Tooltip content={tooltip}>
                      <span className="cursor-default">{displayName}</span>
                    </Tooltip>
                  </span>
                );
              })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No leveled spells prepared.
            </p>
          )}
          {canReprepare && isWizard(resolvedClass!) && !canOpenReprepare ? (
            <p className="text-xs text-muted-foreground">
              Add spells to your spellbook before you can prepare them.
            </p>
          ) : null}
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button
              type="button"
              className="w-full"
              disabled={!canOpenReprepare}
              onClick={handleOpenPrepDialog}
            >
              {isWizard(resolvedClass!)
                ? "Change prepared spells from spellbook"
                : "Change prepared spells"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleKeepCurrentPrep}
            >
              Keep current preparation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canReprepare &&
      spellLimits?.preparedSpells != null &&
      classSpellListId ? (
        <SpellPreparationDialog
          open={prepOpen}
          onClose={() => setPrepOpen(false)}
          onConfirm={handleConfirmPreparedSpells}
          classListId={classSpellListId}
          maxSpellLevel={maxCastableSpellLevel}
          prepareLimit={spellLimits.preparedSpells}
          currentlyPreparedSlugs={preparedLeveledSlugs}
          spellbookSlugs={
            isWizard(resolvedClass!) ? spellbookSlugs : undefined
          }
          title={
            isWizard(resolvedClass!)
              ? "Prepare spells from spellbook"
              : "Prepare spells"
          }
          confirmLabel="Confirm preparation"
        />
      ) : null}

      <Dialog open={shortOpen} onOpenChange={setShortOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take a short rest?</DialogTitle>
            {shortRestRestorations.length > 0 ? (
              <DialogDescription>
                The following will recharge when you finish your short rest:
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {shortRestRestorations.length > 0 ? (
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {shortRestRestorations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-sm text-muted-foreground">
            You can heal with Hit Dice after clicking Short Rest.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShortOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={beginShortRestHeal}>
              Short Rest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
