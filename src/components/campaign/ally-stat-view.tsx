"use client";

import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveCombatImageUrl } from "@/lib/combat/storage";
import {
  formatAbilityScore,
  type EnemyData,
} from "@/lib/schemas/enemy";
import type { PartyAlly } from "@/lib/schemas/party";
import {
  getAllyRaceClassLine,
  getAllyInitiativeModifier,
  getAllyMaxHp,
  getAllyPassivePerception,
  parseAllySpeedFt,
} from "@/lib/dnd/party-allies";
import { formatModifier } from "@/lib/dnd/calculations";

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

export function AllyStatView({ ally }: { ally: PartyAlly }) {
  const data = ally.data;
  const supabase = useMemo(() => createClient(), []);
  const portraitUrl = data.portraitPath
    ? resolveCombatImageUrl(supabase, data.portraitPath)
    : null;
  const speedFt = parseAllySpeedFt(data.speed);
  const raceClassLine = getAllyRaceClassLine(ally);

  return (
    <div className="ally-stat-view space-y-4">
      {portraitUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={portraitUrl}
          alt=""
          className="portrait-cover-top h-24 w-24 rounded-lg"
        />
      ) : null}

      <div>
        <p className="text-lg font-semibold">{ally.name}</p>
        {raceClassLine ? (
          <p className="text-sm text-muted-foreground">{raceClassLine}</p>
        ) : data.sizeType ? (
          <p className="text-sm text-muted-foreground">{data.sizeType}</p>
        ) : null}
      </div>

      <p className="text-sm">
        <strong>AC</strong> {data.armorClass.value}
        {data.armorClass.note ? ` (${data.armorClass.note})` : ""}
        {" · "}
        <strong>HP</strong> {ally.currentHp}/{getAllyMaxHp(ally)}
        {data.hitPoints.formula ? ` (${data.hitPoints.formula})` : ""}
        {" · "}
        <strong>Speed</strong> {speedFt != null ? `${speedFt} ft.` : data.speed || "—"}
        {data.challengeRating ? (
          <>
            {" · "}
            <strong>CR</strong> {data.challengeRating}
          </>
        ) : null}
        {" · "}
        <strong>Init</strong> {formatModifier(getAllyInitiativeModifier(ally))}
        {" · "}
        <strong>PP</strong> {getAllyPassivePerception(ally)}
      </p>

      <div className="grid grid-cols-3 gap-2 text-sm sm:grid-cols-6">
        {ABILITY_KEYS.map((key) => (
          <span key={key}>
            <span className="uppercase font-medium">{key}</span>{" "}
            {formatAbilityScore(data.abilityScores[key] ?? 10)}
          </span>
        ))}
      </div>

      {data.skills.length > 0 ? (
        <p className="text-sm">
          <strong>Skills</strong>{" "}
          {data.skills.map((skill) => `${skill.name} ${formatModifier(skill.bonus)}`).join(", ")}
        </p>
      ) : null}

      {data.senses ? (
        <p className="text-sm">
          <strong>Senses</strong> {data.senses}
        </p>
      ) : null}

      {data.languages ? (
        <p className="text-sm">
          <strong>Languages</strong> {data.languages}
        </p>
      ) : null}

      {data.description ? (
        <p className="text-sm whitespace-pre-wrap">{data.description}</p>
      ) : null}

      {renderNamedBlocks("Traits", data.traits)}
      {renderNamedBlocks("Actions", data.actions)}

      {ally.notes ? (
        <p className="text-sm">
          <strong>Notes</strong> {ally.notes}
        </p>
      ) : null}
    </div>
  );
}

function renderNamedBlocks(title: string, blocks: EnemyData["traits"]) {
  const filled = blocks.filter((block) => block.name.trim() || block.description.trim());
  if (filled.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{title}</p>
      {filled.map((block, index) => (
        <div key={`${title}-${index}`} className="text-sm">
          {block.name ? <strong>{block.name}. </strong> : null}
          <span className="whitespace-pre-wrap">{block.description}</span>
        </div>
      ))}
    </div>
  );
}
