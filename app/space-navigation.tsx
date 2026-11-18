"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function SpaceNavigation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <nav aria-label="Mon espace">
    {[{ href: "/groupes", label: "Mes groupes" }, { href: "/mes-cadeaux", label: "Ma liste" }].map(({ href, label }) =>
      <Link key={href} href={href} aria-current={pathname === href ? "page" : pathname.startsWith(href + "/") ? "location" : undefined}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {href === "/groupes" ? <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/></> : <><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M3 8h18M12 8v12M12 8H8a2.5 2.5 0 1 1 2.4-3.2L12 8Zm0 0h4a2.5 2.5 0 1 0-2.4-3.2L12 8Z"/></>}
        </svg>{label}
      </Link>)}
    <div className="session-actions">{children}</div>
  </nav>;
}
