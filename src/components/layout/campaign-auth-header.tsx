"use client";

import { AuthInline } from "@/components/layout/auth-inline";

interface CampaignAuthHeaderProps {
  userEmail: string | null;
}

export function CampaignAuthHeader({ userEmail }: CampaignAuthHeaderProps) {
  return (
    <div className="retro-header-auth-row">
      <AuthInline userEmail={userEmail} />
    </div>
  );
}
