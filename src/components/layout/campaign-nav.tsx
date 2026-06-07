"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

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

  const links = [
    { href: base, label: "Dashboard", exact: true },
    { href: `${base}/characters`, label: "Characters" },
    { href: `${base}/combat`, label: "Combat" },
  ];

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/campaigns" className="text-sm text-muted-foreground">
              Campaigns
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold">{campaignName}</span>
            <Badge variant={isDm ? "default" : "secondary"}>
              {isDm ? "DM" : "Player"}
            </Badge>
          </div>
          <nav className="mt-2 flex flex-wrap gap-1">
            {links.map((link) => {
              const active = link.exact
                ? pathname === link.href
                : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <Button variant="outline" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
