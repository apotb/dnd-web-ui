"use client";

import Link from "next/link";
import { DmLoginInline } from "@/components/layout/dm-login-inline";

interface CampaignNavProps {
  campaignId: string;
  campaignName: string;
  isDm: boolean;
}

export function CampaignNav({
  campaignId,
  campaignName,
  isDm,
}: CampaignNavProps) {
  const base = `/campaigns/${campaignId}`;

  return (
    <>
      <div className="retro-header-row">
        <span className="retro-title">{campaignName}</span>
        <DmLoginInline isDm={isDm} />
      </div>

      <nav className="candy-nav">
        <Link href={base} className="candy-btn">
          Overview
        </Link>
        <Link href={`${base}/combat`} className="candy-btn">
          Combat
        </Link>
        {isDm && (
          <Link href={`${base}/characters/new`} className="candy-btn">
            + New character
          </Link>
        )}
      </nav>

      <div className="retro-spacer-lg" />
    </>
  );
}
