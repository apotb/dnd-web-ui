"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Encounter } from "@/lib/types/database";

interface EncounterListProps {
  campaignId: string;
  encounters: Encounter[];
  isDm: boolean;
}

export function EncounterList({
  campaignId,
  encounters,
  isDm,
}: EncounterListProps) {
  const router = useRouter();
  const [name, setName] = useState("New Encounter");
  const [creating, setCreating] = useState(false);

  async function createEncounter() {
    setCreating(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("encounters")
      .insert({
        campaign_id: campaignId,
        name,
        round: 0,
        current_turn_index: 0,
        active: false,
      })
      .select("id")
      .single();

    if (!error && data) {
      router.push(`/campaigns/${campaignId}/combat/${data.id}`);
    }
    setCreating(false);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Combat</h1>

      {isDm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Encounter</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button onClick={createEncounter} disabled={creating}>
              {creating ? "Creating..." : "Create Encounter"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {encounters.map((enc) => (
          <Link key={enc.id} href={`/campaigns/${campaignId}/combat/${enc.id}`}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="text-lg">{enc.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {enc.active ? (
                  <span className="text-primary font-medium">
                    Active · Round {enc.round}
                  </span>
                ) : (
                  "Not started"
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {encounters.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No encounters yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
