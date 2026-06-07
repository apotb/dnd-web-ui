"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const base = `/campaigns/${campaignId}`;
  const onOverview = pathname === base;
  const onCharacters =
    pathname.startsWith(`${base}/characters`) &&
    !pathname.startsWith(`${base}/create-character`);
  const onCombat = pathname.startsWith(`${base}/combat`);
  const onCreate = pathname.startsWith(`${base}/create-character`);

  return (
    <>
      <div className="retro-header-row">
        <span className="retro-title">{campaignName}</span>
        <DmLoginInline isDm={isDm} />
      </div>

      <nav className="nav-row nav-row-primary">
        <Link
          href={base}
          className={`candy-btn${onOverview ? " candy-btn-active" : ""}`}
        >
          Overview
        </Link>
        <Link
          href={`${base}/characters`}
          className={`candy-btn${onCharacters ? " candy-btn-active" : ""}`}
        >
          Characters
        </Link>
        <Link
          href={`${base}/combat`}
          className={`candy-btn${onCombat ? " candy-btn-active" : ""}`}
        >
          Combat
        </Link>
        <Link
          href={`${base}/create-character`}
          className={`candy-btn${onCreate ? " candy-btn-active" : ""}`}
        >
          Create Character
        </Link>
      </nav>
    </>
  );
}
