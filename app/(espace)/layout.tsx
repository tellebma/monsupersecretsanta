import type { ReactNode } from "react";
import { logout } from "@/app/actions";
import { Brand } from "@/app/brand";
import SpaceNavigation from "@/app/space-navigation";
import { requireSession } from "@/lib/supabase";

export const metadata = { robots: { index: false } };

export default async function SpaceLayout({ children }: { children: ReactNode }) {
  await requireSession();
  return <>
    <a className="skip-link" href="#main-content">Aller au contenu</a>
    <header className="top">
      <div className="shell bar app-bar">
        <Brand/>
        <SpaceNavigation>
          <form action={logout}><button className="text-button">Déconnexion</button></form>
        </SpaceNavigation>
      </div>
    </header>
    <main id="main-content" tabIndex={-1} className="shell workspace">{children}</main>
  </>;
}
