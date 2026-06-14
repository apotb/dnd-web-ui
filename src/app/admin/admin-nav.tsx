"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin",          label: "Campaigns" },
  { href: "/admin/database", label: "Database" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="nav-row nav-row-primary">
      {NAV_ITEMS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`candy-btn${pathname === href || (href !== "/admin" && pathname.startsWith(href)) ? " candy-btn-active" : ""}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
