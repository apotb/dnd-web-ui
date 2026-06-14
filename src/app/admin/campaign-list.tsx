"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface CampaignRow {
  id: string;
  name: string;
  is_main: boolean;
  characterCount: number;
}

interface CampaignListProps {
  campaigns: CampaignRow[];
  onSetMain: (campaignId: string | null) => Promise<void>;
}

export function CampaignList({ campaigns, onSetMain }: CampaignListProps) {
  const initialMain = campaigns.find((c) => c.is_main)?.id ?? null;
  // Track what's actually saved in state so dirty/saved stay accurate after a save
  const [currentMain, setCurrentMain] = useState<string | null>(initialMain);
  const [selectedMain, setSelectedMain] = useState<string | null>(initialMain);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const dirty = selectedMain !== currentMain;

  function select(id: string | null) {
    setSelectedMain(id);
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      await onSetMain(selectedMain);
      setCurrentMain(selectedMain);
      setSaved(true);
    });
  }

  return (
    <div className="retro-box">
      <p className="text-xs text-muted-foreground mb-3">
        Select the main campaign to send players to when they visit the site.
        Choose &ldquo;None&rdquo; to always show the campaign list.
      </p>

      {/* Single grid so all rows share the same column widths */}
      <div className="grid grid-cols-[auto_1fr_5rem_4rem] gap-x-3 items-center mb-4">
        {/* Header */}
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground pb-1.5">Main</span>
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground pb-1.5">Campaign</span>
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground pb-1.5 text-right">Characters</span>
        <span className="pb-1.5" />
        <div className="col-span-4 border-b mb-1" />

        {/* None option */}
        <label className="col-span-4 grid grid-cols-subgrid items-center py-1.5 cursor-pointer">
          <input
            type="radio"
            name="main-campaign"
            checked={selectedMain === null}
            onChange={() => select(null)}
            className="h-4 w-4"
          />
          <span className="text-sm italic text-muted-foreground col-span-3">None — show campaign list</span>
        </label>

        {campaigns.length === 0 && (
          <p className="text-sm text-muted-foreground py-2 col-span-4">No campaigns yet.</p>
        )}

        {campaigns.map((campaign) => (
          <label
            key={campaign.id}
            className="col-span-4 grid grid-cols-subgrid items-center py-1.5 cursor-pointer"
          >
            <input
              type="radio"
              name="main-campaign"
              checked={selectedMain === campaign.id}
              onChange={() => select(campaign.id)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium">{campaign.name}</span>
            <span className="text-sm text-muted-foreground text-right">
              {campaign.characterCount}
            </span>
            <Link
              href={`/campaigns/${campaign.id}`}
              className="retro-inline-link text-xs text-right"
              onClick={(e) => e.stopPropagation()}
            >
              Open →
            </Link>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={!dirty || isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        {saved && !dirty && (
          <span className="text-xs text-muted-foreground">Saved.</span>
        )}
      </div>
    </div>
  );
}
