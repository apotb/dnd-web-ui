"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PartyInventory } from "@/components/campaign/party-inventory";
import { HarptosCalendar } from "@/components/campaign/harptos-calendar";
import { CampaignMaps } from "@/components/campaign/campaign-maps";
import { useRealtimeCharacters } from "@/lib/hooks/use-realtime-characters";
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

const OVERVIEW_TABS = [
  { id: "party", label: "Party" },
  { id: "world", label: "World" },
  { id: "maps", label: "Maps" },
  { id: "factions", label: "Factions" },
  { id: "notables", label: "Notables" },
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
  initialCalendarEvents,
  initialCharacters,
  isDm,
  userId,
  canManageCalendarEvents,
}: CampaignOverviewProps) {
  const characters = useRealtimeCharacters(campaignId, initialCharacters, isDm);
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
        <div className="retro-stack">
          <section className="retro-box">
            <p className="retro-box-title">Party Members</p>
            {characters.length === 0 ? (
              <p className="retro-muted">No characters yet.</p>
            ) : (
              <div className="retro-member-grid">
                {characters.map((character) => (
                  <PartyMemberSummary
                    key={character.id}
                    character={character}
                    campaignId={campaignId}
                    isDm={isDm}
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
        <section className="retro-box">
          <p className="retro-box-title">Notables</p>
          <p className="retro-muted">
            NPCs, factions, and other notable figures will live here.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function PartyMemberSummary({
  character,
  campaignId,
  isDm,
}: {
  character: ParsedCharacter;
  campaignId: string;
  isDm: boolean;
}) {
  const data = character.data;
  const mods = getAbilityModifiers(data.abilityScores);
  const topSkills = getTopSkills(character, 3);
  const { combat, basicInfo } = data;
  const classLabel =
    basicInfo.classes.length > 0
      ? basicInfo.classes.join("/")
      : basicInfo.class ?? "";
  const abilityKeys = ["str", "dex", "con", "int", "wis", "cha"] as const;

  return (
    <div className="retro-member-box">
      <div className="retro-member-header">
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <strong>{character.name}</strong>
          {isDm && (
            <Link
              href={`/campaigns/${campaignId}/characters/${character.id}`}
              className="retro-inline-link"
              style={{ fontWeight: "normal", fontSize: "11px" }}
            >
              edit
            </Link>
          )}
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
  );
}
