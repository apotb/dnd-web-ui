"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { PartyInventory } from "@/components/campaign/party-inventory";
import { CampaignDayAdvance } from "@/components/campaign/campaign-day-advance";
import { HarptosCalendar } from "@/components/campaign/harptos-calendar";
import { CampaignMaps } from "@/components/campaign/campaign-maps";
import { CampaignNotables } from "@/components/campaign/campaign-notables";
import { useRealtimeCharacters } from "@/lib/hooks/use-realtime-characters";
import { getCharacterPortraitUrl } from "@/lib/character/portrait-storage";
import { createClient } from "@/lib/supabase/client";
import type { ParsedCharacter } from "@/lib/character/utils";
import {
  formatModifier,
  getAbilityModifiers,
} from "@/lib/dnd/calculations";
import { getTopSkills, skillShortLabel } from "@/lib/dnd/party-summary";
import type { ParsedCalendarEvent } from "@/lib/schemas/calendar-event";
import type { PartyData } from "@/lib/schemas/party";
import type { WorldData } from "@/lib/schemas/world";
import type { MapsData } from "@/lib/schemas/maps";
import type { NotablesData } from "@/lib/schemas/notables";

const OVERVIEW_TABS = [
  { id: "party", label: "Party" },
  { id: "world", label: "World" },
  { id: "maps", label: "Maps" },
  { id: "notables", label: "Notables" },
  { id: "factions", label: "Factions" },
] as const;

type OverviewTab = (typeof OVERVIEW_TABS)[number]["id"];

const DEFAULT_OVERVIEW_TAB: OverviewTab = "party";

function overviewTabStorageKey(campaignId: string) {
  return `campaign-overview-tab-${campaignId}`;
}

function parseStoredOverviewTab(stored: string | null): OverviewTab | null {
  if (stored === null) return null;
  if (stored === "") return null;
  return OVERVIEW_TABS.some((tab) => tab.id === stored)
    ? (stored as OverviewTab)
    : null;
}

interface CampaignOverviewProps {
  campaignId: string;
  initialPartyData: PartyData;
  initialWorldData: WorldData;
  initialMapsData: MapsData;
  initialNotablesData: NotablesData;
  initialCalendarEvents: ParsedCalendarEvent[];
  initialCharacters: ParsedCharacter[];
  isDm: boolean;
  userId: string | null;
  canManageCalendarEvents: boolean;
}

export function CampaignOverview({
  campaignId,
  initialPartyData,
  initialWorldData,
  initialMapsData,
  initialNotablesData,
  initialCalendarEvents,
  initialCharacters,
  isDm,
  userId,
  canManageCalendarEvents,
}: CampaignOverviewProps) {
  const characters = useRealtimeCharacters(campaignId, initialCharacters, isDm);
  const sortedCharacters = useMemo(() => {
    return [...characters].sort((a, b) => {
      const aOwned = !!userId && a.owner_user_id === userId;
      const bOwned = !!userId && b.owner_user_id === userId;
      if (aOwned !== bOwned) return aOwned ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [characters, userId]);
  const [activeTab, setActiveTab] = useState<OverviewTab | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    setRestored(false);
    setActiveTab(null);
  }, [campaignId]);

  useEffect(() => {
    if (!restored) {
      const stored = localStorage.getItem(overviewTabStorageKey(campaignId));
      if (stored === null) {
        setActiveTab(DEFAULT_OVERVIEW_TAB);
      } else if (stored === "") {
        setActiveTab(null);
      } else {
        setActiveTab(parseStoredOverviewTab(stored) ?? DEFAULT_OVERVIEW_TAB);
      }
      setRestored(true);
    }
  }, [campaignId, restored]);

  function selectTab(tabId: OverviewTab) {
    const next = activeTab === tabId ? null : tabId;
    setActiveTab(next);
    localStorage.setItem(
      overviewTabStorageKey(campaignId),
      next ?? ""
    );
  }

  return (
    <div>
      <h2 className="page-title">Overview</h2>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        {OVERVIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`candy-btn${activeTab === tab.id ? " candy-btn-active" : ""}`}
            style={{ flex: "0 1 auto" }}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "party" ? (
        <div className="retro-stack party-overview-stack">
          <section className="retro-box">
            <p className="retro-box-title">Party Members</p>
            {sortedCharacters.length === 0 ? (
              <p className="retro-muted">No characters yet.</p>
            ) : (
              <div className="retro-member-grid">
                {sortedCharacters.map((character) => (
                  <PartyMemberSummary
                    key={character.id}
                    character={character}
                    campaignId={campaignId}
                    userId={userId}
                  />
                ))}
              </div>
            )}
          </section>

          <PartyInventory
            campaignId={campaignId}
            initialPartyData={initialPartyData}
            characters={characters}
            isDm={isDm}
          />
        </div>
      ) : null}

      {activeTab === "world" ? (
        <div className="retro-stack">
          {isDm ? (
            <CampaignDayAdvance
              campaignId={campaignId}
              initialWorldData={initialWorldData}
            />
          ) : null}
          <HarptosCalendar
            campaignId={campaignId}
            initialWorldData={initialWorldData}
            initialEvents={initialCalendarEvents}
            isDm={isDm}
            userId={userId}
            canManageEvents={canManageCalendarEvents}
          />
        </div>
      ) : null}

      {activeTab === "maps" ? (
        <CampaignMaps
          campaignId={campaignId}
          initialMapsData={initialMapsData}
          isDm={isDm}
        />
      ) : null}

      {activeTab === "factions" ? (
        <section className="retro-box">
          <p className="retro-box-title">Factions</p>
          <p className="retro-muted">
            Organizations, guilds, and power groups will live here.
          </p>
        </section>
      ) : null}

      {activeTab === "notables" ? (
        <CampaignNotables
          campaignId={campaignId}
          initialNotablesData={initialNotablesData}
          initialWorldData={initialWorldData}
          isDm={isDm}
        />
      ) : null}
    </div>
  );
}

function characterSheetHref(campaignId: string, characterId: string) {
  return `/campaigns/${campaignId}/characters?character=${characterId}`;
}

function PartyMemberSummary({
  character,
  campaignId,
  userId,
}: {
  character: ParsedCharacter;
  campaignId: string;
  userId: string | null;
}) {
  const isUserCharacter = !!userId && character.owner_user_id === userId;
  const data = character.data;
  const mods = getAbilityModifiers(data.abilityScores);
  const topSkills = getTopSkills(character, 3);
  const { combat, basicInfo } = data;
  const portraitUrl = useMemo(() => {
    if (!basicInfo.portrait) return null;
    return getCharacterPortraitUrl(createClient(), basicInfo.portrait);
  }, [basicInfo.portrait]);
  const classLabel =
    basicInfo.classes.length > 0
      ? basicInfo.classes.join("/")
      : basicInfo.class ?? "";
  const abilityKeys = ["str", "dex", "con", "int", "wis", "cha"] as const;

  return (
    <div
      className={`retro-member-box${portraitUrl ? " retro-member-box-portrait" : ""}`}
      style={
        portraitUrl
          ? ({ "--member-portrait-url": `url("${portraitUrl}")` } as CSSProperties)
          : undefined
      }
    >
      <div className="retro-member-box-content">
        <div className="retro-member-header">
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            {isUserCharacter ? (
              <span className="character-owned-star" aria-hidden>
                ★
              </span>
            ) : null}
            <Link
              href={characterSheetHref(campaignId, character.id)}
              className="retro-member-name-link"
            >
              <strong>{character.name}</strong>
            </Link>
          </div>
          <span className="retro-member-meta">
            Lv {basicInfo.level}
            {classLabel ? ` ${classLabel}` : ""}
          </span>
        </div>
        <p className="retro-member-line retro-member-line-nowrap">
        HP {combat.currentHp}/{combat.maxHp}
        {combat.tempHp > 0 ? ` (+${combat.tempHp})` : ""}
        {" · "}AC {combat.ac}
        {" · "}
        {combat.speed}ft
        {" · "}Init {formatModifier(combat.initiativeBonus + mods.dex)}
        </p>
        <div className="retro-member-abilities">
        {abilityKeys.map((key) => (
          <span key={key}>
            {key.toUpperCase()} {data.abilityScores[key]}
            ({formatModifier(mods[key])})
          </span>
        ))}
      </div>
      <p className="retro-member-line retro-member-line-nowrap">
        <strong>Skills:</strong>{" "}
        {topSkills
          .map(
            (s) =>
              `${skillShortLabel(s.label)} ${formatModifier(s.total)}`
          )
          .join(" · ")}
        </p>
        {combat.conditions.length > 0 && (
          <p className="retro-member-line">
            <strong>Cond:</strong> {combat.conditions.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
