"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function SpaceNavigation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <nav aria-label="Mon espace">
    {[{ href: "/groupes", label: "Mes groupes" }, { href: "/mes-cadeaux", label: "Ma liste" }].map(({ href, label }) =>
      <Link key={href} href={href} aria-current={pathname === href ? "page" : pathname.startsWith(href + "/") ? "location" : undefined}>
        {label}
      </Link>)}
    {children}
  </nav>;
}
