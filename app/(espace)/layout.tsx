import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/actions";
import { Brand } from "@/app/brand";
import { requireSession } from "@/lib/supabase";

export const metadata = { robots: { index: false } };

export default async function SpaceLayout({ children }: { children: ReactNode }) {
  await requireSession();
  return <>
    <header className="top">
      <div className="shell bar app-bar">
        <Brand/>
        <nav aria-label="Mon espace"><Link href="/groupes">Mes groupes</Link><Link href="/mes-cadeaux">Ma liste</Link>
          <form action={logout}><button className="text-button">Déconnexion</button></form>
        </nav>
      </div>
    </header>
    <main className="shell workspace">{children}</main>
  </>;
}
