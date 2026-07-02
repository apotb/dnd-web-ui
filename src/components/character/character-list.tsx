"use client";

import Link from "next/link";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ParsedCharacter } from "@/lib/character/utils";
import { getCharacterLevel } from "@/lib/dnd/xp";

interface CharacterListProps {
  campaignId: string;
  characters: ParsedCharacter[];
  isDm: boolean;
}

export function CharacterList({
  campaignId,
  characters,
  isDm,
}: CharacterListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Characters</h1>
        {isDm && (
          <LinkButton href={`/campaigns/${campaignId}/characters/new`}>
            New Character
          </LinkButton>
        )}
      </div>

      {characters.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No characters yet.
            {isDm && " Create one to get started."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((character) => (
            <Link
              key={character.id}
              href={`/campaigns/${campaignId}/characters/${character.id}`}
            >
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg">{character.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>
                    Level {getCharacterLevel(character.data)}{" "}
                    {character.data.basicInfo.classes.join(" / ") ||
                      character.data.basicInfo.class ||
                      "Adventurer"}
                  </p>
                  {character.player_name && (
                    <p>Player: {character.player_name}</p>
                  )}
                  <p>
                    HP: {character.data.combat.currentHp}/
                    {character.data.combat.maxHp} · AC{" "}
                    {character.data.combat.ac}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
