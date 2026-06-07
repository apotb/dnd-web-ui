"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ParsedCombatant } from "@/lib/character/utils";
import type { Encounter } from "@/lib/types/database";
import {
  getHealthLabel,
  sortCombatantsByInitiative,
} from "@/lib/schemas/combat";
import { useRealtimeEncounter } from "@/lib/hooks/use-realtime-encounter";

interface CombatTrackerPlayerProps {
  encounter: Encounter;
  combatants: ParsedCombatant[];
}

export function CombatTrackerPlayer({
  encounter: initialEncounter,
  combatants: initialCombatants,
}: CombatTrackerPlayerProps) {
  const { encounter, combatants } = useRealtimeEncounter(
    initialEncounter.id,
    { encounter: initialEncounter, combatants: initialCombatants }
  );

  const sorted = useMemo(
    () => sortCombatantsByInitiative(combatants),
    [combatants]
  );

  const currentCombatant = sorted[encounter.current_turn_index] ?? null;
  const party = sorted.filter((c) => c.data.type === "player");
  const enemies = sorted.filter(
    (c) => c.data.type !== "player" && c.visible_to_players
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{encounter.name}</h1>
        <p className="text-muted-foreground">
          {encounter.active ? (
            <>
              Round {encounter.round} ·{" "}
              {currentCombatant
                ? `${currentCombatant.data.name}'s turn`
                : "Waiting..."}
            </>
          ) : (
            "Combat not started"
          )}
        </p>
      </div>

      {encounter.active && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Initiative Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sorted.map((c, i) => (
              <div
                key={c.id}
                className={`flex items-center justify-between rounded-md px-3 py-2 ${
                  i === encounter.current_turn_index
                    ? "bg-primary/10 font-medium"
                    : ""
                }`}
              >
                <span>{c.data.name}</span>
                <span className="text-sm text-muted-foreground">
                  Init {c.initiative}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Party</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {party.length === 0 ? (
            <p className="text-sm text-muted-foreground">No party members.</p>
          ) : (
            party.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0"
              >
                <span className="font-medium">{c.data.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {c.data.currentHp}/{c.data.maxHp} HP
                  </span>
                  {c.data.tempHp > 0 && (
                    <Badge variant="outline">+{c.data.tempHp} temp</Badge>
                  )}
                  {c.data.conditions.map((cond) => (
                    <Badge key={cond} variant="secondary">
                      {cond}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enemies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {enemies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No visible enemies.
            </p>
          ) : (
            enemies.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0"
              >
                <span className="font-medium">{c.data.name}</span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      getHealthLabel(c.data.currentHp, c.data.maxHp) ===
                      "Defeated"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {getHealthLabel(c.data.currentHp, c.data.maxHp)}
                  </Badge>
                  {c.data.conditions.map((cond) => (
                    <Badge key={cond} variant="secondary">
                      {cond}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
