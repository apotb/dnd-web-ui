import { getAuthUser } from "@/lib/auth/campaign-access";
import { RetroShell } from "@/components/layout/retro-shell";
import { CampaignAuthHeader } from "@/components/layout/campaign-auth-header";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();

  return (
    <RetroShell>
      <div className="retro-header-row">
        <span className="retro-title">DM Admin</span>
        <CampaignAuthHeader userEmail={user?.email ?? null} />
      </div>
      <AdminNav />
      {children}
    </RetroShell>
  );
}
