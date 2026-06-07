"use client";

import Link from "next/link";
import { PartyInventory } from "@/components/campaign/party-inventory";
import { useRealtimeCharacters } from "@/lib/hooks/use-realtime-characters";
import type { ParsedCharacter } from "@/lib/character/utils";
import {
  formatModifier,
  getAbilityModifiers,
} from "@/lib/dnd/calculations";
import { getTopSkills } from "@/lib/dnd/party-summary";
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
  const characters = useRealtimeCharacters(campaignId, initialCharacters);

  return (
    <div>
      <h2 className="page-title">Overview</h2>

      <div className="retro-stack">
        <PartyInventory
          campaignId={campaignId}
          initialPartyData={initialPartyData}
          characters={characters}
          isDm={isDm}
        />

        <section className="retro-box">
          <p className="retro-box-title">Party Members</p>
          {characters.length === 0 ? (
            <p className="retro-muted">No characters yet.</p>
          ) : (
            <div className="retro-stack">
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

  return (
    <div className="retro-member-box">
      <div className="retro-member-header">
        <strong>{character.name}</strong>
        <span className="retro-muted">
          Lv {basicInfo.level}
          {basicInfo.classes.length > 0
            ? ` ${basicInfo.classes.join("/")}`
            : basicInfo.class
              ? ` ${basicInfo.class}`
              : ""}
        </span>
      </div>
      <table className="retro-table retro-table-compact">
        <tbody>
          <tr>
            <td>HP</td>
            <td>
              {combat.currentHp}/{combat.maxHp}
              {combat.tempHp > 0 ? ` (+${combat.tempHp} temp)` : ""}
            </td>
            <td>AC</td>
            <td>{combat.ac}</td>
          </tr>
          <tr>
            <td>Speed</td>
            <td>{combat.speed} ft</td>
            <td>Init</td>
            <td>{formatModifier(combat.initiativeBonus + mods.dex)}</td>
          </tr>
          <tr>
            <td>STR</td>
            <td>
              {data.abilityScores.str} ({formatModifier(mods.str)})
            </td>
            <td>DEX</td>
            <td>
              {data.abilityScores.dex} ({formatModifier(mods.dex)})
            </td>
          </tr>
          <tr>
            <td>CON</td>
            <td>
              {data.abilityScores.con} ({formatModifier(mods.con)})
            </td>
            <td>INT</td>
            <td>
              {data.abilityScores.int} ({formatModifier(mods.int)})
            </td>
          </tr>
          <tr>
            <td>WIS</td>
            <td>
              {data.abilityScores.wis} ({formatModifier(mods.wis)})
            </td>
            <td>CHA</td>
            <td>
              {data.abilityScores.cha} ({formatModifier(mods.cha)})
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Top skills:</strong>{" "}
        {topSkills.map((s) => `${s.label} ${formatModifier(s.total)}`).join(" · ")}
      </p>
      {combat.conditions.length > 0 && (
        <p>
          <strong>Conditions:</strong> {combat.conditions.join(", ")}
        </p>
      )}
      {isDm && (
        <p>
          <Link href={`/campaigns/${campaignId}/characters/${character.id}`}>
            edit sheet →
          </Link>
        </p>
      )}
    </div>
  );
}
