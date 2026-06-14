"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CampaignAuthHeader } from "@/components/layout/campaign-auth-header";

interface CampaignNavProps {
  campaignId: string;
  campaignName: string;
  userEmail: string | null;
  isDm?: boolean;
}

export function CampaignNav({
  campaignId,
  campaignName,
  userEmail,
  isDm = false,
}: CampaignNavProps) {
  const pathname = usePathname();
  const base = `/campaigns/${campaignId}`;
  const onOverview = pathname === base;
  const onCharacters = pathname.startsWith(`${base}/characters`);
  const onCombat = pathname.startsWith(`${base}/combat`);
  const onNotebook = pathname.startsWith(`${base}/notebook`);
  const onAdmin = pathname.startsWith("/admin");

  return (
    <>
      <div className="retro-header-row">
        <span className="retro-title">{campaignName}</span>
        {isDm && (
          <Link href="/admin" className="retro-inline-link">
            DM Admin
          </Link>
        )}
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
          href={`${base}/notebook`}
          className={`candy-btn${onNotebook ? " candy-btn-active" : ""}`}
        >
          Notebook
        </Link>
      </nav>
    </>
  );
}
