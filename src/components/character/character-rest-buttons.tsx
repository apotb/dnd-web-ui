"use client";

import { useMemo, useState } from "react";
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
import type { HarptosDate } from "@/lib/dnd/harptos-calendar";
import type { CharacterData } from "@/lib/schemas/character";
import type { PhbClass, PhbSpecies } from "@/lib/dnd/phb/types";

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
  const [longOpen, setLongOpen] = useState(false);
  const [shortOpen, setShortOpen] = useState(false);

  const longAvailability = useMemo(
    () => canTakeLongRest(data, campaignDate, isDm),
    [data, campaignDate, isDm]
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

  function handleLongRest() {
    const next = applyLongRest(data, campaignDate, classes, speciesList);
    onApply(next);
    setLongOpen(false);
  }

  function beginShortRestHeal() {
    onApply(startPendingShortRest(data));
    setShortOpen(false);
  }

  const longDisabled = !longAvailability.ok;
  const longDisabledReason = longAvailability.ok ? null : longAvailability.reason;

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
            {longRestEffects.length > 0 || longRestRestorations.length > 0 ? (
              <DialogDescription>
                A long rest will apply the following:
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {longRestEffects.length > 0 ? (
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {longRestEffects.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
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
          {!isDm ? (
            <p className="text-xs text-muted-foreground">
              Each character can take one long rest per in-game day.
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLongOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleLongRest}>
              Long Rest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
