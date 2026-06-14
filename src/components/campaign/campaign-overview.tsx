"use client";

import Link from "next/link";
import { PartyInventory } from "@/components/campaign/party-inventory";
import { useRealtimeCharacters } from "@/lib/hooks/use-realtime-characters";
import type { ParsedCharacter } from "@/lib/character/utils";
import {
  formatModifier,
  getAbilityModifiers,
} from "@/lib/dnd/calculations";
import { getTopSkills, skillShortLabel } from "@/lib/dnd/party-summary";
import type { PartyData } from "@/lib/schemas/party";

interface CampaignOverviewProps {
  campaignId: string;
  initialPartyData: PartyData;
  initialCharacters: ParsedCharacter[];
  isDm: boolean;
}

export function CampaignOverview({
  campaignId,
  initialPartyData,
  initialCharacters,
  isDm,
}: CampaignOverviewProps) {
  const characters = useRealtimeCharacters(campaignId, initialCharacters, isDm);

  return (
    <div>
      <h2 className="page-title">Overview</h2>

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
