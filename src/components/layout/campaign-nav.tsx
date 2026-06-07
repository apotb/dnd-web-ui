"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CampaignAuthHeader } from "@/components/layout/campaign-auth-header";

interface CampaignNavProps {
  campaignId: string;
  campaignName: string;
  userEmail: string | null;
}

export function CampaignNav({
  campaignId,
  campaignName,
  userEmail,
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
        <CampaignAuthHeader userEmail={userEmail} />
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
          New Character
        </Link>
      </nav>
    </>
  );
}
