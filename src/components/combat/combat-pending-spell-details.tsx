"use client";

import { SpellMaterialLine } from "@/components/spells/spell-glossary-meta";
import type { PendingSpellDetails } from "@/lib/schemas/combat-state";

interface CombatPendingSpellDetailsProps {
  details: PendingSpellDetails;
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="combat-pending-spell-meta-line">
      <span className="combat-pending-spell-meta-label">{label}</span> {value}
    </p>
  );
}

export function CombatPendingSpellDetails({ details }: CombatPendingSpellDetailsProps) {
  const headerParts = [
    details.school,
    details.concentration ? "Concentration" : null,
    details.ritual ? "Ritual" : null,
  ].filter(Boolean);

  return (
    <div className="combat-pending-spell-details">
      {headerParts.length > 0 ? (
        <p className="combat-pending-spell-school retro-muted">{headerParts.join(" · ")}</p>
      ) : null}

      {details.castSlotLabel ? (
        <MetaLine label="Cast using:" value={`${details.castSlotLabel} slot`} />
      ) : details.spellLevel === 0 ? (
        <MetaLine label="Cast using:" value="Cantrip" />
      ) : null}

      {details.castingTime ? <MetaLine label="Cast time:" value={details.castingTime} /> : null}
      {details.range ? <MetaLine label="Range:" value={details.range} /> : null}
      {details.duration ? <MetaLine label="Duration:" value={details.duration} /> : null}
      {details.components ? <MetaLine label="Components:" value={details.components} /> : null}

      {details.materialLine && details.components ? (
        <SpellMaterialLine
          components={details.components}
          className="combat-pending-spell-material"
        />
      ) : null}

      {details.targetingSummary ? (
        <p className="combat-pending-spell-targeting">{details.targetingSummary}</p>
      ) : null}

      {details.description ? (
        <p className="combat-pending-spell-description">{details.description}</p>
      ) : null}
    </div>
  );
}
