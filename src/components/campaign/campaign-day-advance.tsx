"use client";

import { useMemo, useState } from "react";
import {
  advanceCampaignDay,
  characterNeedsDehydrationSaveAfterSupplies,
  type DmEndOfDayDehydrationSaveRolls,
  type DmEndOfDaySuppliesByCharacterId,
  type DmSoulmongerRolls,
} from "@/lib/campaign/advance-day";
import { formatHarptosDate } from "@/lib/dnd/harptos-calendar";
import { characterNeedsDmEndOfDaySupplies } from "@/lib/dnd/supplies";
import { useRealtimeSoulmongerData } from "@/lib/hooks/use-realtime-soulmonger-data";
import { useRealtimeWorldData } from "@/lib/hooks/use-realtime-world-data";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { SoulmongerData } from "@/lib/schemas/soulmonger";
import { getCampaignCalendarDate, type WorldData } from "@/lib/schemas/world";
import { createClient } from "@/lib/supabase/client";
import { DmEndOfDayDehydrationSavesModal } from "@/components/campaign/dm-end-of-day-dehydration-saves-modal";
import { DmEndOfDaySuppliesModal } from "@/components/campaign/dm-end-of-day-supplies-modal";
import { DmSoulmongerRollModal } from "@/components/campaign/dm-soulmonger-roll-modal";

interface CampaignDayAdvanceProps {
  campaignId: string;
  initialWorldData: WorldData;
  initialSoulmongerData: SoulmongerData;
  characters: ParsedCharacter[];
  userId: string | null;
}

export function CampaignDayAdvance({
  campaignId,
  initialWorldData,
  initialSoulmongerData,
  characters,
  userId,
}: CampaignDayAdvanceProps) {
  const worldData = useRealtimeWorldData(campaignId, initialWorldData);
  const soulmongerData = useRealtimeSoulmongerData(
    campaignId,
    initialSoulmongerData
  );
  const today = getCampaignCalendarDate(worldData);
  const [advancing, setAdvancing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [suppliesModalOpen, setSuppliesModalOpen] = useState(false);
  const [dehydrationModalOpen, setDehydrationModalOpen] = useState(false);
  const [soulmongerModalOpen, setSoulmongerModalOpen] = useState(false);
  const [pendingSuppliesChoices, setPendingSuppliesChoices] =
    useState<DmEndOfDaySuppliesByCharacterId | null>(null);
  const [pendingDehydrationCharacters, setPendingDehydrationCharacters] =
    useState<ParsedCharacter[]>([]);
  const [pendingDehydrationRolls, setPendingDehydrationRolls] =
    useState<DmEndOfDayDehydrationSaveRolls | null>(null);
  const [hadDehydrationStep, setHadDehydrationStep] = useState(false);

  const charactersNeedingDmSupplies = useMemo(() => {
    if (!worldData.dailySuppliesActive) return [];
    return characters.filter((character) =>
      characterNeedsDmEndOfDaySupplies(character.owner_user_id, userId)
    );
  }, [characters, userId, worldData.dailySuppliesActive]);

  const activeSouls = soulmongerData.active;

  function resetAdvanceFlow() {
    setSuppliesModalOpen(false);
    setDehydrationModalOpen(false);
    setSoulmongerModalOpen(false);
    setPendingSuppliesChoices(null);
    setPendingDehydrationCharacters([]);
    setPendingDehydrationRolls(null);
    setHadDehydrationStep(false);
  }

  async function runAdvanceDay(
    dmSuppliesByCharacterId?: DmEndOfDaySuppliesByCharacterId,
    dehydrationSaveRolls?: DmEndOfDayDehydrationSaveRolls,
    soulmongerRolls?: DmSoulmongerRolls
  ) {
    setAdvancing(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await advanceCampaignDay(
      supabase,
      campaignId,
      worldData,
      dmSuppliesByCharacterId,
      dehydrationSaveRolls,
      soulmongerRolls,
      soulmongerRolls ? soulmongerData : undefined
    );

    if (error) {
      setMessage(error);
    } else {
      resetAdvanceFlow();
    }

    setAdvancing(false);
  }

  function getCharactersNeedingDehydrationSave(
    choices: DmEndOfDaySuppliesByCharacterId
  ) {
    return charactersNeedingDmSupplies.filter((character) => {
      const choice = choices[character.id];
      if (!choice) return false;
      return characterNeedsDehydrationSaveAfterSupplies(
        character.data,
        today,
        worldData,
        choice
      );
    });
  }

  function openSoulmongerOrAdvance(
    suppliesChoices?: DmEndOfDaySuppliesByCharacterId,
    dehydrationSaveRolls?: DmEndOfDayDehydrationSaveRolls
  ) {
    if (activeSouls.length > 0) {
      if (suppliesChoices) {
        setPendingSuppliesChoices(suppliesChoices);
      }
      if (dehydrationSaveRolls) {
        setPendingDehydrationRolls(dehydrationSaveRolls);
      }
      setSoulmongerModalOpen(true);
      return;
    }

    void runAdvanceDay(suppliesChoices, dehydrationSaveRolls);
  }

  function onSuppliesConfirm(choices: DmEndOfDaySuppliesByCharacterId) {
    const needingSave = getCharactersNeedingDehydrationSave(choices);

    if (needingSave.length > 0) {
      setPendingSuppliesChoices(choices);
      setPendingDehydrationCharacters(needingSave);
      setSuppliesModalOpen(false);
      setDehydrationModalOpen(true);
      return;
    }

    setSuppliesModalOpen(false);
    openSoulmongerOrAdvance(choices);
  }

  function onDehydrationConfirm(rolls: DmEndOfDayDehydrationSaveRolls) {
    if (!pendingSuppliesChoices) return;
    setHadDehydrationStep(true);
    setDehydrationModalOpen(false);
    openSoulmongerOrAdvance(pendingSuppliesChoices, rolls);
  }

  function onDehydrationBack() {
    if (advancing || !pendingSuppliesChoices) return;
    setDehydrationModalOpen(false);
    setPendingDehydrationCharacters([]);
    setSuppliesModalOpen(true);
  }

  function onSoulmongerConfirm(rolls: DmSoulmongerRolls) {
    void runAdvanceDay(
      pendingSuppliesChoices ?? undefined,
      pendingDehydrationRolls ?? undefined,
      rolls
    );
  }

  function onSoulmongerBack() {
    if (advancing) return;
    setSoulmongerModalOpen(false);

    if (hadDehydrationStep && pendingSuppliesChoices) {
      setDehydrationModalOpen(true);
      return;
    }

    if (pendingSuppliesChoices) {
      setSuppliesModalOpen(true);
      return;
    }

    resetAdvanceFlow();
  }

  function advanceDay() {
    if (charactersNeedingDmSupplies.length > 0) {
      setSuppliesModalOpen(true);
      return;
    }

    openSoulmongerOrAdvance();
  }

  return (
    <>
      <section className="retro-box campaign-day-advance">
        <p className="retro-box-title">Today</p>
        <p className="campaign-day-advance-date">{formatHarptosDate(today)}</p>
        <button
          type="button"
          className="candy-btn campaign-day-advance-btn"
          onClick={advanceDay}
          disabled={advancing}
        >
          {advancing ? "..." : "Next Day"}
        </button>
        {message ? <p className="retro-muted">{message}</p> : null}
      </section>
      {suppliesModalOpen ? (
        <DmEndOfDaySuppliesModal
          characters={charactersNeedingDmSupplies}
          endingDate={today}
          worldData={worldData}
          initialChoices={pendingSuppliesChoices ?? undefined}
          saving={advancing}
          onCancel={() => {
            if (!advancing) {
              resetAdvanceFlow();
            }
          }}
          onConfirm={onSuppliesConfirm}
        />
      ) : null}
      {dehydrationModalOpen && pendingSuppliesChoices ? (
        <DmEndOfDayDehydrationSavesModal
          characters={pendingDehydrationCharacters}
          suppliesChoices={pendingSuppliesChoices}
          endingDate={today}
          worldData={worldData}
          saving={advancing}
          onCancel={onDehydrationBack}
          onConfirm={onDehydrationConfirm}
        />
      ) : null}
      {soulmongerModalOpen && activeSouls.length > 0 ? (
        <DmSoulmongerRollModal
          souls={activeSouls}
          endingDate={today}
          saving={advancing}
          onCancel={() => {
            if (!advancing) {
              resetAdvanceFlow();
            }
          }}
          onBack={onSoulmongerBack}
          onConfirm={onSoulmongerConfirm}
        />
      ) : null}
    </>
  );
}
